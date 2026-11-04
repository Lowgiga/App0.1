// omega.tasker/v1: Befehle an Tasker nur aus einer festen Allowlist (Tasks mit Praefix OMEGA_),
// mit gueltigem Lease (Ablaufzeit + Fencing-Token), HLC-Stempel und HMAC. Freie Shell-Befehle gibt es nicht.
import { canonicalize } from './canonical.mjs';
import { macObject, verifyMac } from './signing.mjs';
import { parseHlc } from './hlc.mjs';

export const TASKER_SCHEMA = 'omega.tasker/v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const TASKER_ACTIONS = Object.freeze({
  OMEGA_KILL: { cls: 'safety', params: {} },
  OMEGA_ADB_OFF: { cls: 'safety', params: {} },
  OMEGA_STATUS: { cls: 'observe', params: {} },
  OMEGA_ADB_ON: { cls: 'reversible', params: { minutes: { type: 'int', min: 1, max: 30 } } },
  OMEGA_WIFI_ON: { cls: 'reversible', params: {} },
  OMEGA_NOTIFY: {
    cls: 'reversible',
    params: { title: { type: 'string', maxLength: 80 }, text: { type: 'string', maxLength: 500 } },
  },
  OMEGA_SCENE_APPROVAL: {
    cls: 'reversible',
    params: {
      approvalId: { type: 'uuid' },
      title: { type: 'string', maxLength: 80 },
      summary: { type: 'string', maxLength: 500 },
      risk: { type: 'int', min: 1, max: 10 },
      timeoutSec: { type: 'int', min: 10, max: 600 },
    },
  },
});

function checkParam(spec, value) {
  if (spec.type === 'int') return Number.isSafeInteger(value) && value >= spec.min && value <= spec.max;
  if (spec.type === 'uuid') return typeof value === 'string' && UUID.test(value);
  if (spec.type === 'string') {
    // Steuerzeichen verboten: Tasker-Variablen landen in Benachrichtigungen und Scenes.
    return typeof value === 'string' && value.length <= spec.maxLength && !/[\u0000-\u001f\u007f]/.test(value);
  }
  return false;
}

export function validateTaskerParams(action, params) {
  // Object.hasOwn: geerbte Namen wie 'toString' oder '__proto__' sind keine Tasks.
  if (typeof action !== 'string' || !Object.hasOwn(TASKER_ACTIONS, action)) return 'action-not-allowlisted';
  const def = TASKER_ACTIONS[action];
  if (params === null || typeof params !== 'object' || Array.isArray(params)) return 'bad-params';
  for (const key of Object.keys(params)) if (!(key in def.params)) return `unknown-param:${key}`;
  for (const [key, spec] of Object.entries(def.params)) {
    if (!(key in params)) return `missing-param:${key}`;
    if (!checkParam(spec, params[key])) return `invalid-param:${key}`;
  }
  return null;
}

export function buildTaskerCommand({ action, params = {}, lease, hlc }, secret) {
  const problem = validateTaskerParams(action, params);
  if (problem) throw new TypeError(`omega.tasker/v1: ${problem}`);
  const cmd = {
    schema: TASKER_SCHEMA,
    action,
    params,
    taskId: lease.taskId,
    leaseId: lease.leaseId,
    fencingToken: lease.fencingToken,
    leaseExpiresAt: lease.expiresAt,
    hlc,
  };
  return { ...cmd, mac: macObject(cmd, secret) };
}

/**
 * Referenzpruefung der Empfaengerseite (identisch nachzubauen in Tasker/Java).
 * Reihenfolge: Form -> MAC -> Allowlist/Parameter -> Replay je Absender -> Lease-Ablauf -> Uhr
 * -> Fencing -> Trust Kernel. Ein abgewiesener Befehl verbraucht Replay- und Fencing-Stand nur,
 * wenn er bis zum Fencing kam (danach kann er nie erneut eingespielt werden).
 */
export class TaskerCommandGate {
  #lastHlc = new Map();

  constructor({ secret, clock, fence, kernel }) {
    this.secret = secret;
    this.clock = clock;
    this.fence = fence;
    this.kernel = kernel;
  }

  snapshot() {
    return { schema: 'omega.gate-state/v1', lastHlc: Object.fromEntries([...this.#lastHlc].sort()), fence: this.fence.snapshot() };
  }

  /** Stellt Replay- und Fencing-Stand wieder her; ein defekter Zustand wirft (Aufrufer: Kill-Switch). */
  restoreState(snapshot) {
    if (snapshot === undefined) return;
    if (snapshot?.schema !== 'omega.gate-state/v1') throw new TypeError('TaskerCommandGate: Zustand defekt');
    for (const [node, stamp] of Object.entries(snapshot.lastHlc ?? {})) {
      if (parseHlc(stamp).node !== node) throw new TypeError('TaskerCommandGate: Zustand defekt');
      this.#lastHlc.set(node, stamp);
    }
  }

  admit(cmd, { risk = 1 } = {}) {
    if (cmd === null || typeof cmd !== 'object' || cmd.schema !== TASKER_SCHEMA) return { ok: false, reason: 'wrong-schema' };
    const allowed = new Set(['schema', 'action', 'params', 'taskId', 'leaseId', 'fencingToken', 'leaseExpiresAt', 'hlc', 'mac']);
    for (const key of Object.keys(cmd)) if (!allowed.has(key)) return { ok: false, reason: `unknown-field:${key}` };
    if (!verifyMac(cmd, this.secret)) return { ok: false, reason: 'bad-mac' };
    const problem = validateTaskerParams(cmd.action, cmd.params);
    if (problem) return { ok: false, reason: problem };
    if (typeof cmd.taskId !== 'string' || cmd.taskId.length === 0 || cmd.taskId.length > 128) return { ok: false, reason: 'bad-task' };
    let sender;
    try {
      sender = parseHlc(cmd.hlc).node;
    } catch {
      return { ok: false, reason: 'bad-hlc' };
    }
    if (cmd.hlc <= (this.#lastHlc.get(sender) ?? '')) return { ok: false, reason: 'replay' };
    if (!Number.isSafeInteger(cmd.leaseExpiresAt) || cmd.leaseExpiresAt <= this.clock.now()) return { ok: false, reason: 'lease-expired' };
    try {
      this.clock.receive(cmd.hlc);
    } catch {
      return { ok: false, reason: 'clock-drift' };
    }
    const fenced = this.fence.admit(cmd.taskId, cmd.fencingToken);
    if (!fenced.ok) return { ok: false, reason: fenced.reason };
    this.#lastHlc.set(sender, cmd.hlc);
    const { cls } = TASKER_ACTIONS[cmd.action];
    const decision = this.kernel.decide({ cls, risk });
    if (decision.verdict === 'deny') return { ok: false, reason: decision.reason };
    return { ok: true, verdict: decision.verdict, reason: decision.reason, action: cmd.action, params: cmd.params };
  }
}

/**
 * HTTP-Transport fuer Taskers Ereignis "HTTP Request": Body = kanonisches JSON ohne mac,
 * Header X-Omega-Mac = HMAC ueber exakt diese Bytes. So prueft Tasker (Java-Code-Aktion,
 * javax.crypto.Mac "HmacSHA256") den Rohtext, ohne JSON neu serialisieren zu muessen.
 */
export function toTaskerHttp(cmd) {
  const body = { ...cmd };
  delete body.mac;
  return { body: canonicalize(body), headers: { 'content-type': 'application/json', 'x-omega-mac': cmd.mac } };
}

export function fromTaskerHttp(body, macHeader) {
  const parsed = JSON.parse(body);
  if (canonicalize(parsed) !== body) throw new TypeError('omega.tasker/v1: Body ist nicht kanonisch');
  return { ...parsed, mac: macHeader };
}
