// omega.task/v1-Leases mit Fencing-Token (OMG-03): genau ein Halter je Aufgabe; jeder neue Lease
// bekommt einen hoeheren Token, damit ein abgeloester Halter nichts mehr ausfuehren kann.
// Tokens sind mindestens die aktuelle Uhrzeit in ms: selbst ohne gespeicherten Zustand liegt
// ein neuer Token nach einem Neustart ueber allen alten (Uhr-Ruecksprung => Ablehnung, nie Doppelausfuehrung).
import { randomUUID } from 'node:crypto';

export class LeaseManager {
  #leases = new Map();
  #tokens = new Map();

  constructor({ now = () => Date.now(), maxTtlMs = 15 * 60_000 } = {}) {
    this.now = now;
    this.maxTtlMs = maxTtlMs;
  }

  acquire(taskId, holder, ttlMs) {
    this.#assertTtl(ttlMs);
    const t = this.now();
    const current = this.#leases.get(taskId);
    if (current && current.expiresAt > t && current.holder !== holder) {
      return { ok: false, reason: 'held', holder: current.holder, expiresAt: current.expiresAt };
    }
    const fencingToken = Math.max((this.#tokens.get(taskId) ?? 0) + 1, this.now());
    this.#tokens.set(taskId, fencingToken);
    const lease = { taskId, holder, leaseId: randomUUID(), fencingToken, expiresAt: t + ttlMs };
    this.#leases.set(taskId, lease);
    return { ok: true, lease: { ...lease } };
  }

  renew(taskId, leaseId, ttlMs) {
    this.#assertTtl(ttlMs);
    const current = this.#leases.get(taskId);
    const t = this.now();
    if (!current || current.leaseId !== leaseId) return { ok: false, reason: 'no-lease' };
    if (current.expiresAt <= t) return { ok: false, reason: 'expired' };
    current.expiresAt = t + ttlMs;
    return { ok: true, lease: { ...current } };
  }

  check(taskId, fencingToken) {
    const current = this.#leases.get(taskId);
    if (!current) return { ok: false, reason: 'no-lease' };
    if (current.expiresAt <= this.now()) return { ok: false, reason: 'expired' };
    if (current.fencingToken !== fencingToken) return { ok: false, reason: 'stale-token' };
    return { ok: true };
  }

  release(taskId, leaseId) {
    const current = this.#leases.get(taskId);
    if (!current || current.leaseId !== leaseId) return false;
    this.#leases.delete(taskId);
    return true;
  }

  /** Kill-Switch: alle Leases widerrufen. Tokens bleiben, alte Tokens werden nie wieder gueltig. */
  revokeAll() {
    const count = this.#leases.size;
    this.#leases.clear();
    return count;
  }

  snapshot() {
    return {
      schema: 'omega.lease-state/v1',
      tokens: Object.fromEntries([...this.#tokens].sort()),
      leases: [...this.#leases.values()].map((lease) => ({ ...lease })),
    };
  }

  static restore(snapshot, options) {
    const manager = new LeaseManager(options);
    if (snapshot === undefined) return manager;
    if (snapshot?.schema !== 'omega.lease-state/v1') throw new TypeError('LeaseManager: Zustand defekt');
    for (const [taskId, token] of Object.entries(snapshot.tokens ?? {})) {
      if (!Number.isSafeInteger(token) || token < 1) throw new TypeError('LeaseManager: Zustand defekt');
      manager.#tokens.set(taskId, token);
    }
    for (const lease of snapshot.leases ?? []) {
      if (lease?.fencingToken !== manager.#tokens.get(lease?.taskId)) continue;
      manager.#leases.set(lease.taskId, { ...lease });
    }
    return manager;
  }

  #assertTtl(ttlMs) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > this.maxTtlMs) {
      throw new RangeError(`Lease: ttlMs muss 1..${this.maxTtlMs} sein`);
    }
  }
}

/** Ausfuehrerseite: merkt sich den hoechsten Token je Ressource und weist kleinere ab. */
export class FencedResource {
  #highest = new Map();

  admit(resource, fencingToken) {
    if (!Number.isSafeInteger(fencingToken) || fencingToken < 1) return { ok: false, reason: 'bad-token' };
    const highest = this.#highest.get(resource) ?? 0;
    if (fencingToken < highest) return { ok: false, reason: 'fenced' };
    this.#highest.set(resource, fencingToken);
    return { ok: true };
  }

  snapshot() {
    return { schema: 'omega.fence-state/v1', highest: Object.fromEntries([...this.#highest].sort()) };
  }

  static restore(snapshot) {
    const fence = new FencedResource();
    if (snapshot === undefined) return fence;
    if (snapshot?.schema !== 'omega.fence-state/v1') throw new TypeError('FencedResource: Zustand defekt');
    for (const [resource, token] of Object.entries(snapshot.highest ?? {})) {
      if (!Number.isSafeInteger(token) || token < 1) throw new TypeError('FencedResource: Zustand defekt');
      fence.#highest.set(resource, token);
    }
    return fence;
  }
}
