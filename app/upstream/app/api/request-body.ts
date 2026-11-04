/** Bounded same-origin JSON requests. Origin/Fetch Metadata supplement dispatcher auth. */
export async function readJsonRequest(request: Request, limit = 2000000): Promise<{ body: unknown } | { response: Response }> {
  const fail = (error: string, status: number) => ({ response: Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } }) });
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) return fail('Same-origin request required', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return fail('JSON required', 415);
  if (Number(request.headers.get('content-length') || 0) > limit) return fail('Payload too large', 413);
  try {
    const reader = request.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    if (reader) {
      try {
        while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > limit) { await reader.cancel(); return fail('Payload too large', 413); } chunks.push(part.value); }
      } finally { reader.releaseLock(); }
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch { return fail('Invalid JSON or request body', 400); }
}
