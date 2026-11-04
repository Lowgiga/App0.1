export type PlacementStatus = 'scanning' | 'surface-found' | 'placed';
export const placementStatusNames: Record<PlacementStatus, string> = { scanning: 'Kamera langsam auf eine gut beleuchtete Fläche richten.', 'surface-found': 'Fläche gefunden. Mit „Hier platzieren“ bestätigen.', placed: 'Modell auf der erkannten Fläche platziert. Kein dauerhafter Raumanker.' };

/** Keep the latest hit only. Placement is explicit; a lost hit never leaves a stale target. */
export function createPlacementState() {
  let candidate: number[] | null = null, placed: number[] | null = null;
  return {
    get status(): PlacementStatus { return placed ? 'placed' : candidate ? 'surface-found' : 'scanning'; },
    get candidate() { return candidate?.slice() ?? null; },
    get placed() { return placed?.slice() ?? null; },
    update(matrix: ArrayLike<number> | null) {
      if (placed) return;
      const values = matrix ? Array.from(matrix) : [];
      candidate = values.length === 16 && values.every(Number.isFinite) ? values : null;
    },
    place() { if (!placed && candidate) placed = candidate.slice(); return placed?.slice() ?? null; },
    reset() { candidate = null; placed = null; },
  };
}

/** Abort observation immediately; late browser promises remain handled by the caller. */
export function withAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => { cleanup(); reject(new DOMException('AR operation ended.', 'AbortError')); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    operation.then(value => { cleanup(); if (signal.aborted) abort(); else resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
}

/** Ends observation immediately and cancels even a browser source delivered after abort/unmount. */
export async function acquireHitTestSource(session: XRSession, isStale: () => boolean, signal?: AbortSignal) {
  let source: XRHitTestSource | null = null, disposed = false;
  const lifecycle = new AbortController();
  const release = () => { const current = source; source = null; try { current?.cancel(); } catch { /* Already ended by the browser. */ } };
  const dispose = () => { if (disposed) return; disposed = true; lifecycle.abort(); session.removeEventListener('end', dispose); signal?.removeEventListener('abort', dispose); release(); };
  const abortError = () => new DOMException('AR placement setup ended.', 'AbortError');
  session.addEventListener('end', dispose);
  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted || isStale()) dispose();
  try {
    if (disposed) throw abortError();
    const viewer = await withAbort(session.requestReferenceSpace('viewer'), lifecycle.signal);
    if (disposed || isStale()) throw abortError();
    if (!session.requestHitTestSource) throw new DOMException('Hit-test is unavailable.', 'NotSupportedError');
    const sourceRequest = Promise.resolve(session.requestHitTestSource({ space: viewer, entityTypes: ['plane'] })).then(next => {
      if (!next) throw new DOMException('Hit-test is unavailable.', 'NotSupportedError');
      if (disposed || isStale()) { try { next.cancel(); } catch { /* Browser already released it. */ } throw abortError(); }
      source = next; return next;
    });
    await withAbort(sourceRequest, lifecycle.signal);
    return { get source() { return source; }, dispose };
  } catch (error) { dispose(); throw error; }
}
