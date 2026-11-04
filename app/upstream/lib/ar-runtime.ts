/** WebXR lifecycle boundary. It owns no camera data, network or persistence. */
export type ARPlacementMode = 'surface' | 'free';
export type ARPhase = 'inactive' | 'starting' | 'tracking' | 'searching' | 'surface-found' | 'placed' | 'free-placed' | 'tracking-lost' | 'end-unknown';
export type ARState = { phase: ARPhase; mode: ARPlacementMode; canPlace: boolean };
export type ARStage = 'capability' | 'session' | 'renderer' | 'hit-test' | 'end';
export type ARDiagnosis = { stage: ARStage; name: string; message: string; hint: string; observedAt: string; related?: { stage: ARStage; name: string; message: string } };

export class ARStartFailure extends Error {
  stage: ARStage;
  original: unknown;
  constructor(stage: ARStage, original: unknown) {
    super('AR-Start fehlgeschlagen'); this.name = 'ARStartFailure'; this.stage = stage; this.original = original;
  }
}
/** A rejected end without an end event leaves ownership with the caller. Never retry automatically. */
export class AREndFailure extends ARStartFailure {
  session: XRSession;
  startFailure?: ARStartFailure;
  constructor(session: XRSession, original: unknown, startFailure?: ARStartFailure) {
    super('end', original); this.name = 'AREndFailure'; this.session = session; this.startFailure = startFailure;
  }
}
/** Native end invalidates the start, but only its own finally can release the lock. */
export class ARStartLock {
  private generation = 0;
  private operation: number | null = null;
  get busy() { return this.operation !== null; }
  begin(): number | null { if (this.busy) return null; return this.operation = ++this.generation; }
  current(id: number) { return this.operation === id && this.generation === id; }
  invalidate() { ++this.generation; }
  finish(id: number) { if (this.operation !== id) return false; this.operation = null; return true; }
}
const clean = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
export function diagnoseARFailure(error: unknown, fallback: ARStage = 'session', now = new Date()): ARDiagnosis {
  const stage = error instanceof ARStartFailure ? error.stage : fallback;
  const cause = error instanceof ARStartFailure ? error.original : error;
  const name = cause instanceof Error ? cause.name : 'UnknownError';
  const message = cause instanceof Error ? cause.message : 'Der Browser hat keinen genaueren Fehler zurückgegeben.';
  const hint = stage === 'end' ? 'Das Sitzungsende wurde nicht bestätigt. Nutze „AR beenden“ erneut oder die AR-Beenden-Funktion des Browsers. Ein neuer AR-Start bleibt bis zum bestätigten Ende gesperrt.' : name === 'NotAllowedError' || name === 'SecurityError'
    ? 'AR wurde nicht freigegeben oder durch eine Browser-/Einbettungsrichtlinie blockiert. Öffne die private App direkt in einem AR-fähigen Browser, prüfe dessen Berechtigungen und starte bewusst erneut.'
    : name === 'NotSupportedError'
      ? stage === 'hit-test' || stage === 'session' ? 'Dieser AR-Modus braucht passende Geräteunterstützung. Tischplatzierung benötigt Hit-Test und DOM-Overlay. Freies AR kannst du separat wählen; 2D und 3D bleiben nutzbar.' : 'Die benötigte WebXR-Funktion ist in diesem Browser nicht verfügbar. Öffne die App direkt in einem unterstützten Browser.'
      : name === 'InvalidStateError'
        ? 'Eine Sitzung ist bereits aktiv oder wurde während des Starts beendet. Beende sie und starte aus der normalen 3D-Ansicht neu.'
        : name === 'AbortError' ? 'Der AR-Start wurde abgebrochen. Die normale Ansicht bleibt erhalten; starte erneut, wenn du bereit bist.'
          : stage === 'renderer' ? 'Die AR-Grafikbindung ist fehlgeschlagen. Lade die 3D-Ansicht neu; bei erneutem Fehler nutze 2D und den Diagnosebericht.'
            : 'Prüfe Geräteunterstützung und Browserberechtigungen. Der genaue Fehler und seine Phase stehen im Diagnosebericht.';
  const related = error instanceof AREndFailure && error.startFailure ? diagnoseARFailure(error.startFailure, 'session', now) : null;
  return { stage, name: clean(name, 80), message: clean(message, 500), hint, observedAt: now.toISOString(), ...(related ? { related: { stage: related.stage, name: related.name, message: related.message } } : {}) };
}
export const arPhaseText: Record<ARPhase, string> = {
  inactive: 'Keine AR-Sitzung aktiv.', starting: 'Der Browser wird um eine AR-Sitzung gebeten.',
  tracking: 'AR-Sitzung gestartet. Auf gültiges räumliches Tracking warten.',
  searching: 'Bewege das Gerät langsam über eine gut beleuchtete, strukturierte waagerechte Fläche.',
  'surface-found': 'Waagerechte Fläche getroffen. Jetzt bewusst platzieren.',
  placed: 'Modell an der gewählten räumlichen Position platziert. Neuplatzieren bleibt möglich.',
  'free-placed': 'Freies AR-Modell vor dir platziert. Keine Flächenerkennung in diesem Modus.',
  'tracking-lost': 'Räumliches Tracking derzeit nicht verfügbar. Platzieren bleibt gesperrt.',
  'end-unknown': 'Sitzungsende nicht bestätigt. AR beenden bleibt verfügbar; kein neuer Start.',
};

/** Copies of pose matrices are safe outside the lifetime of an XRFrame. */
export function horizontalHit(matrix: ArrayLike<number>): boolean {
  if (matrix.length !== 16 || Array.from(matrix).some(v => !Number.isFinite(v))) return false;
  const normalLength = Math.hypot(matrix[4], matrix[5], matrix[6]);
  return normalLength > .9 && normalLength < 1.1 && matrix[5] / normalLength >= .94;
}
export function surfaceOffset(matrix: ArrayLike<number>, pivot: readonly number[], scale: number): [number, number, number] {
  if (!horizontalHit(matrix) || pivot.length !== 3 || pivot.some(v => !Number.isFinite(v)) || !Number.isFinite(scale) || scale <= 0) throw new Error('Ungültige AR-Platzierung.');
  return [0, 1, 2].map(i => matrix[12 + i] - scale * (matrix[i] * pivot[0] + matrix[4 + i] * pivot[1] + matrix[8 + i] * pivot[2])) as [number, number, number];
}
export function freshSurface(hitAt: number | null, now: number, tracking: boolean): boolean {
  return tracking && hitAt !== null && now >= hitAt && now - hitAt <= 500;
}

type StartOptions = {
  xr: Pick<XRSystem, 'requestSession'>; mode: ARPlacementMode; overlay: HTMLElement;
  cancelled: () => boolean; bind: (session: XRSession) => Promise<void>;
  phase: (phase: ARPhase) => void;
};
export type OpenAR = { session: XRSession; hitSource: XRHitTestSource | null };
/** Must be invoked directly from a user gesture: requestSession is the first await. */
export async function openAR({ xr, mode, overlay, cancelled, bind, phase }: StartOptions): Promise<OpenAR | null> {
  let session: XRSession | null = null, hitSource: XRHitTestSource | null = null, stage: ARStage = 'session', ended = false;
  const stop = async (startFailure?: ARStartFailure) => {
    try { hitSource?.cancel(); } catch { /* It may already be cancelled by session end. */ } hitSource = null;
    if (session && !ended) {
      try { await session.end(); ended = true; }
      catch (error) { if (!ended) throw new AREndFailure(session, error, startFailure); }
    }
  };
  try {
    phase('starting');
    session = await xr.requestSession('immersive-ar', { requiredFeatures: mode === 'surface' ? ['hit-test', 'dom-overlay'] : ['dom-overlay'], domOverlay: { root: overlay } });
    session.addEventListener('end', () => { ended = true; }, { once: true });
    if (cancelled() || ended) { await stop(); return null; }
    stage = 'renderer'; await bind(session);
    if (cancelled() || ended) { await stop(); return null; }
    if (mode === 'surface') {
      stage = 'hit-test';
      const viewer = await session.requestReferenceSpace('viewer');
      if (cancelled() || ended) { await stop(); return null; }
      if (!session.requestHitTestSource) throw new DOMException('WebXR Hit-Test ist in dieser Sitzung nicht verfügbar.', 'NotSupportedError');
      hitSource = await session.requestHitTestSource({ space: viewer, entityTypes: ['plane'] }) || null;
      if (!hitSource) throw new DOMException('Der Browser hat keine Hit-Test-Quelle erstellt.', 'NotSupportedError');
      if (cancelled() || ended) { await stop(); return null; }
    }
    phase('tracking'); return { session, hitSource };
  } catch (error) {
    if (error instanceof AREndFailure) throw error;
    const failure = new ARStartFailure(stage, error); await stop(failure); throw failure;
  }
}
