// Hybrid Logical Clock (Kulkarni et al. 2014). Stempel sind fest breit und damit
// lexikografisch sortierbar: <wall 15 Stellen>.<logical 6 Stellen>.<node>.
const WALL_DIGITS = 15;
const LOGICAL_DIGITS = 6;
const MAX_LOGICAL = 10 ** LOGICAL_DIGITS - 1;
export const NODE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const STAMP = /^(\d{15})\.(\d{6})\.([a-z0-9][a-z0-9-]{0,62})$/;

export function formatHlc({ wall, logical, node }) {
  if (!Number.isSafeInteger(wall) || wall < 0) throw new RangeError('HLC: wall ungueltig');
  if (!Number.isSafeInteger(logical) || logical < 0 || logical > MAX_LOGICAL) {
    throw new RangeError('HLC: logical ungueltig');
  }
  if (!NODE_ID.test(node)) throw new TypeError('HLC: Knoten-ID ungueltig');
  return `${String(wall).padStart(WALL_DIGITS, '0')}.${String(logical).padStart(LOGICAL_DIGITS, '0')}.${node}`;
}

export function parseHlc(stamp) {
  const m = typeof stamp === 'string' ? STAMP.exec(stamp) : null;
  if (!m) throw new TypeError(`HLC: Stempel fehlerhaft: ${JSON.stringify(stamp)}`);
  return { wall: Number(m[1]), logical: Number(m[2]), node: m[3] };
}

export function compareHlc(a, b) {
  parseHlc(a);
  parseHlc(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

export class HybridLogicalClock {
  #wall = 0;
  #logical = 0;

  constructor({ node, now = () => Date.now(), maxDriftMs = 60_000 } = {}) {
    if (!NODE_ID.test(node ?? '')) throw new TypeError('HLC: Knoten-ID ungueltig');
    this.node = node;
    this.now = now;
    this.maxDriftMs = maxDriftMs;
  }

  /** Lokales Ereignis oder Senden. */
  tick() {
    const pt = this.now();
    if (pt > this.#wall) {
      this.#wall = pt;
      this.#logical = 0;
    } else {
      this.#setLogical(this.#logical + 1);
    }
    return this.#stamp();
  }

  /** Empfang eines entfernten Stempels; lehnt Uhren ab, die zu weit vorgehen. */
  receive(remote) {
    const r = typeof remote === 'string' ? parseHlc(remote) : remote;
    const pt = this.now();
    if (r.wall - pt > this.maxDriftMs) {
      throw new RangeError(`HLC: entfernte Uhr ${r.wall - pt} ms voraus (max ${this.maxDriftMs})`);
    }
    const wall = Math.max(this.#wall, r.wall, pt);
    let logical;
    if (wall === this.#wall && wall === r.wall) logical = Math.max(this.#logical, r.logical) + 1;
    else if (wall === this.#wall) logical = this.#logical + 1;
    else if (wall === r.wall) logical = r.logical + 1;
    else logical = 0;
    this.#wall = wall;
    this.#setLogical(logical);
    return this.#stamp();
  }

  #setLogical(value) {
    if (value > MAX_LOGICAL) throw new RangeError('HLC: Ueberlauf des logischen Zaehlers');
    this.#logical = value;
  }

  #stamp() {
    return formatHlc({ wall: this.#wall, logical: this.#logical, node: this.node });
  }
}
