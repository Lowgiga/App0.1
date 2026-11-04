#!/usr/bin/env node
// OMEGA-Kommandozeile fuer den Windows-Knoten (und jeden anderen Rechner mit Node >= 22.18).
// Zustand liegt in --state (Standard: $OMEGA_STATE_DIR oder ~/.omega).
import { parseArgs } from 'node:util';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NodeService, initIdentity, loadIdentity } from '../node/service.mjs';
import { startServer } from '../node/server.mjs';
import { probeHost } from '../node/probes.mjs';
import { verifyJournalText, pairingCode, PEER_ROLES, TASKER_ACTIONS } from '../runtime/index.mjs';

const print = (value) => process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
class UsageError extends Error {}

const STATE = { state: { type: 'string', default: process.env.OMEGA_STATE_DIR ?? join(homedir(), '.omega') } };

/** Liest das Geheimnis; vertraegt UTF-8-BOM und UTF-16LE (Umleitung ">" in Windows PowerShell 5.1). */
export function decodeSecretFile(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString('utf16le').trim();
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return bytes.subarray(3).toString('utf8').trim();
  return bytes.toString('utf8').trim();
}

function readSecret(path) {
  const text = decodeSecretFile(readFileSync(path));
  const secret = Buffer.from(text, 'base64url');
  if (secret.length < 32 || secret.toString('base64url') !== text) throw new UsageError('Geheimnis ungueltig (base64url, mindestens 32 Byte)');
  return secret;
}

function withService(stateDir, fn) {
  const service = new NodeService({ stateDir });
  try {
    return fn(service);
  } finally {
    service.close();
  }
}

const COMMANDS = {
  init: {
    help: 'Neue Knoten-Identitaet anlegen (Ed25519, Schluessel nur lokal)',
    options: { ...STATE, label: { type: 'string', default: 'omega-node' }, role: { type: 'string', default: 'windows' } },
    run: ({ values }) => {
      if (!PEER_ROLES.includes(values.role)) throw new UsageError(`--role: ${PEER_ROLES.join('|')}`);
      return initIdentity(values.state, { label: values.label, role: values.role });
    },
  },
  id: {
    help: 'Eigene Knoten-ID und oeffentlichen Schluessel zeigen',
    options: STATE,
    run: ({ values }) => {
      const { privateKey, ...identity } = loadIdentity(values.state);
      return identity;
    },
  },
  status: {
    help: 'Zustand: Stufe, Kill-Switch, Fehler, Journal, Peers',
    options: STATE,
    run: ({ values }) => withService(values.state, (service) => service.health()),
  },
  'pair-code': {
    help: 'Kopplungscode fuer einen fremden Schluessel (auf beiden Geraeten vergleichen)',
    options: { ...STATE, 'peer-key': { type: 'string' } },
    run: ({ values }) => {
      if (!values['peer-key']) throw new UsageError('--peer-key fehlt');
      return { code: pairingCode(loadIdentity(values.state).publicKey, values['peer-key']) };
    },
  },
  'peer-add': {
    help: 'Peer koppeln: --code ist der Code, den das ANDERE Geraet anzeigt',
    options: { ...STATE, 'peer-key': { type: 'string' }, role: { type: 'string' }, label: { type: 'string' }, code: { type: 'string' } },
    run: ({ values }) => {
      for (const key of ['peer-key', 'role', 'label', 'code']) if (!values[key]) throw new UsageError(`--${key} fehlt`);
      return withService(values.state, (service) => {
        const result = service.addPeer({ publicKey: values['peer-key'], role: values.role, label: values.label, code: values.code });
        if (!result.ok) throw new UsageError(`Kopplung abgelehnt: ${result.reason}`);
        return result;
      });
    },
  },
  'peer-revoke': {
    help: 'Peer endgueltig widerrufen',
    options: { ...STATE, node: { type: 'string' } },
    run: ({ values }) => {
      if (!values.node) throw new UsageError('--node fehlt');
      return withService(values.state, (service) => ({ revoked: service.revokePeer(values.node) }));
    },
  },
  peers: {
    help: 'Gekoppelte Peers auflisten',
    options: STATE,
    run: ({ values }) => withService(values.state, (service) => service.peers.list()),
  },
  secret: {
    help: 'Neues HMAC-Geheimnis fuer Tasker (32 Byte, base64url); --out schreibt es ohne Terminal-Ausgabe',
    options: { out: { type: 'string' } },
    run: ({ values }) => {
      const secret = randomBytes(32).toString('base64url');
      if (!values.out) return secret;
      writeFileSync(values.out, `${secret}\n`, { mode: 0o600, flag: 'wx' });
      return { written: values.out };
    },
  },
  'tasker-cmd': {
    help: 'Signierten Tasker-Befehl erzeugen (optional mit --send senden)',
    options: {
      ...STATE,
      'secret-file': { type: 'string' },
      action: { type: 'string' },
      params: { type: 'string', default: '{}' },
      task: { type: 'string' },
      ttl: { type: 'string', default: '120' },
      risk: { type: 'string', default: '1' },
      confirm: { type: 'boolean', default: false },
      send: { type: 'string' },
    },
    run: async ({ values }) => {
      if (!values['secret-file'] || !values.action) throw new UsageError('--secret-file und --action sind Pflicht');
      if (!Object.hasOwn(TASKER_ACTIONS, values.action)) throw new UsageError(`--action: ${Object.keys(TASKER_ACTIONS).join('|')}`);
      let params;
      try {
        params = JSON.parse(values.params);
      } catch {
        throw new UsageError('--params ist kein JSON');
      }
      const result = withService(values.state, (service) => service.issueTaskerCommand({
        action: values.action,
        params,
        taskId: values.task ?? values.action.toLowerCase(),
        ttlMs: Number(values.ttl) * 1000,
        risk: Number(values.risk),
        secret: readSecret(values['secret-file']),
        confirmed: values.confirm,
      }));
      if (!result.ok) throw new UsageError(`Befehl abgelehnt: ${result.reason}`);
      if (!values.send) return result.http;
      const response = await fetch(values.send, { method: 'POST', headers: result.http.headers, body: result.http.body, signal: AbortSignal.timeout(10_000) });
      return { sent: values.send, status: response.status };
    },
  },
  kill: {
    help: 'Kill-Switch ein (Standard) oder mit --release --confirm-human aus',
    options: { ...STATE, release: { type: 'boolean', default: false }, 'confirm-human': { type: 'boolean', default: false } },
    run: ({ values }) => withService(values.state, (service) => (values.release
      ? service.releaseKill({ confirmedByHuman: values['confirm-human'] })
      : service.engageKill('cli'))),
  },
  repair: {
    help: 'Defekten Zustand kontrolliert reparieren (Kill-Switch bleibt an)',
    options: { ...STATE, 'confirm-human': { type: 'boolean', default: false } },
    run: ({ values }) => withService(values.state, (service) => service.repair({ confirmedByHuman: values['confirm-human'] })),
  },
  'journal-verify': {
    help: 'Hash-Kette eines Journals pruefen (Standard: Journal im --state)',
    options: { ...STATE, file: { type: 'string' } },
    run: ({ values }) => {
      const file = values.file ?? join(values.state, 'journal', 'events.jsonl');
      const result = verifyJournalText(readFileSync(file, 'utf8'));
      if (!result.ok) {
        process.exitCode = 2;
        return { ok: false, reason: result.reason, line: result.line };
      }
      return { ok: true, count: result.count, head: result.head, partialTail: result.partialTail };
    },
  },
  probe: {
    help: 'adb, scrcpy und Geraet pruefen; Faehigkeiten mit Nachweis zeigen',
    options: { ...STATE, adb: { type: 'string', default: 'adb' }, scrcpy: { type: 'string', default: 'scrcpy' } },
    run: async ({ values }) => {
      const service = new NodeService({ stateDir: values.state });
      try {
        for (const cap of await probeHost({ node: service.identity.node, adb: values.adb, scrcpy: values.scrcpy })) service.capabilities.upsert(cap);
        return service.capabilities.list();
      } finally {
        service.close();
      }
    },
  },
  serve: {
    help: 'Knotendienst starten (/api/omega/v1, Standard 127.0.0.1:7341)',
    options: {
      ...STATE,
      host: { type: 'string', default: '127.0.0.1' },
      port: { type: 'string', default: '7341' },
      'allow-external': { type: 'boolean', default: false },
    },
    run: async ({ values }) => {
      const service = new NodeService({ stateDir: values.state });
      const refresh = async () => {
        for (const cap of await probeHost({ node: service.identity.node })) service.capabilities.upsert(cap);
      };
      await refresh();
      const timer = setInterval(() => refresh().catch(() => {}), 4 * 60_000);
      const handle = await startServer(service, { host: values.host, port: Number(values.port), allowExternal: values['allow-external'] });
      const stop = async () => {
        clearInterval(timer);
        await handle.close();
        service.close();
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
      return { listening: handle.url, node: service.identity.node, killed: service.kernel.killed };
    },
  },
};

/**
 * "--name wert" -> "--name=wert" fuer Text-Optionen. Noetig, weil base64url-Schluessel in 1 von 64
 * Faellen mit "-" beginnen und parseArgs solche Werte sonst als mehrdeutig ablehnt.
 */
export function normalizeArgs(args, options) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const name = arg.startsWith('--') && !arg.includes('=') ? arg.slice(2) : null;
    if (name && Object.hasOwn(options, name) && options[name].type === 'string' && i + 1 < args.length) {
      out.push(`--${name}=${args[i + 1]}`);
      i += 1;
    } else {
      out.push(arg);
    }
  }
  return out;
}

function usage() {
  const lines = Object.entries(COMMANDS).map(([name, cmd]) => `  ${name.padEnd(15)} ${cmd.help}`);
  return `omega <befehl> [optionen]\n\n${lines.join('\n')}\n\nGemeinsam: --state <ordner> (Standard: $OMEGA_STATE_DIR oder ~/.omega)`;
}

export async function main(argv) {
  const [name, ...rest] = argv;
  if (!name || name === 'help' || name === '--help') {
    print(usage());
    return 0;
  }
  const command = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;
  if (!command) {
    process.stderr.write(`omega: unbekannter Befehl "${name}"\n\n${usage()}\n`);
    return 1;
  }
  try {
    const parsed = parseArgs({ args: normalizeArgs(rest, command.options), options: command.options, strict: true, allowPositionals: false });
    const result = await command.run(parsed);
    if (result !== undefined) print(result);
    return process.exitCode ?? 0;
  } catch (error) {
    process.stderr.write(`omega: ${error.message}\n`);
    return error instanceof UsageError || error?.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' ? 1 : 2;
  }
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main(process.argv.slice(2)).then((code) => {
    if (code !== 0) process.exitCode = code;
  });
}
