// HTTP-Schnittstelle des Knotens (/api/omega/v1). Grundsaetze: standardmaessig nur Loopback,
// nie Wildcard-Bind, Host-Pruefung gegen DNS-Rebinding, keine Browser-Herkunft (kein CORS),
// Groessen- und Zeitlimits, Ratenbegrenzung je Absenderadresse.
import { createServer } from 'node:http';

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);
export const MAX_BODY_BYTES = 96 * 1024;

function formatHost(host, port) {
  return host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`;
}

export function startServer(service, {
  host = '127.0.0.1', port = 7341, allowExternal = false, capacity = 60, refillPerSec = 30, now = () => Date.now(),
} = {}) {
  if (host === '0.0.0.0' || host === '::') throw new Error('Wildcard-Bind verboten - konkrete Mesh-IP angeben');
  if (!LOOPBACK.has(host) && !allowExternal) throw new Error('Nur Loopback erlaubt, ausser mit allowExternal (Mesh-IP)');
  const buckets = new Map();

  const allow = (key) => {
    const t = now();
    const bucket = buckets.get(key) ?? { tokens: capacity, at: t };
    bucket.tokens = Math.min(capacity, bucket.tokens + ((t - bucket.at) / 1000) * refillPerSec);
    bucket.at = t;
    buckets.set(key, bucket);
    if (buckets.size > 1024) for (const [k, b] of buckets) if (t - b.at > 60_000) buckets.delete(k);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  };

  const server = createServer(async (req, res) => {
    const send = (status, payload, extra = {}) => {
      const body = JSON.stringify(payload);
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'content-length': Buffer.byteLength(body),
        ...extra,
      });
      res.end(body);
    };
    try {
      if (!allow(req.socket.remoteAddress ?? '?')) return send(429, { error: 'rate-limited' }, { 'retry-after': '1' });
      const actualPort = server.address().port;
      const allowedHosts = new Set([formatHost(host, actualPort)]);
      if (LOOPBACK.has(host)) for (const h of ['127.0.0.1', 'localhost', '::1']) allowedHosts.add(formatHost(h, actualPort));
      if (!allowedHosts.has(req.headers.host)) return send(421, { error: 'host-not-allowed' });
      if (req.headers.origin !== undefined) return send(403, { error: 'origin-not-allowed' });
      const { pathname } = new URL(req.url, 'http://omega.invalid');

      if (pathname === '/api/omega/v1/health') {
        if (req.method !== 'GET') return send(405, { error: 'method-not-allowed' }, { allow: 'GET' });
        return send(200, service.health());
      }
      if (pathname === '/api/omega/v1/capabilities') {
        if (req.method !== 'GET') return send(405, { error: 'method-not-allowed' }, { allow: 'GET' });
        return send(200, { capabilities: service.capabilities.list() });
      }
      if (pathname === '/api/omega/v1/events') {
        if (req.method !== 'POST') return send(405, { error: 'method-not-allowed' }, { allow: 'POST' });
        if (!/^application\/json(;|$)/.test(req.headers['content-type'] ?? '')) return send(415, { error: 'json-required' });
        const declared = Number(req.headers['content-length'] ?? 0);
        if (declared > MAX_BODY_BYTES) return send(413, { error: 'too-large' }, { connection: 'close' });
        const body = await readBody(req, MAX_BODY_BYTES);
        if (body === null) return send(413, { error: 'too-large' }, { connection: 'close' });
        let event;
        try {
          event = JSON.parse(body.toString('utf8'));
        } catch {
          return send(400, { error: 'bad-json' });
        }
        const result = service.ingest(event);
        return send(result.status, result.ok ? { accepted: true, index: result.index, hash: result.hash } : { error: result.reason });
      }
      return send(404, { error: 'not-found' });
    } catch {
      if (!res.headersSent) send(500, { error: 'internal' });
      return undefined;
    }
  });
  server.headersTimeout = 5_000;
  server.requestTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 50;

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        server,
        url: `http://${formatHost(host, address.port)}`,
        port: address.port,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

/** Liest den Body mit Obergrenze; null bei Ueberschreitung. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let exceeded = false;
    req.on('data', (chunk) => {
      if (exceeded) return;
      size += chunk.length;
      if (size > limit) {
        exceeded = true;
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!exceeded) resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}
