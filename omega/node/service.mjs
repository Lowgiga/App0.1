// OMEGA-Knotendienst: Identitaet, Peers, Journal, Leases und Trust Kernel mit dauerhaftem Zustand.
// Regeln: das Journal ist die Quelle fuer den Replay-Schutz; jeder defekte Zustand schaltet den
// Kill-Switch ein (fail-safe) und blockiert die Annahme, bis ein Mensch eingreift.
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  generateNodeKeys, exportPublicKey, keyId, nodeIdFromKey, HybridLogicalClock, TrustKernel, PeerRegistry,
  EventVerifier, EventEmitterNode, EventJournal, LeaseManager, CapabilityRegistry, writeJsonAtomic, readJson,
  createPeerEntry, pairingCode, buildTaskerCommand, toTaskerHttp, TASKER_ACTIONS, validateTaskerParams, assertSecret,
  salvageSequenceFloor, NODE_ID,
} from '../runtime/index.mjs';

const FILES = Object.freeze({
  identity: 'identity.json', key: 'node.key', trust: 'trust.json', peers: 'peers.json', leases: 'leases.json',
  journal: join('journal', 'events.jsonl'),
});

export function initIdentity(stateDir, { label = 'omega-node', role = 'windows' } = {}) {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const keyPath = join(stateDir, FILES.key);
  if (existsSync(keyPath)) throw new Error(`Identitaet existiert bereits: ${keyPath}`);
  const { publicKey, privateKey } = generateNodeKeys();
  writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  const identity = { schema: 'omega.identity/v1', node: nodeIdFromKey(publicKey), publicKey, keyId: keyId(publicKey), role, label };
  writeJsonAtomic(join(stateDir, FILES.identity), identity);
  writeJsonAtomic(join(stateDir, FILES.trust), new TrustKernel({ level: 'E1' }).snapshot());
  return identity;
}

export function loadIdentity(stateDir) {
  const stored = readJson(join(stateDir, FILES.identity));
  if (!stored.ok || !stored.value) throw new Error('Keine Identitaet - zuerst "omega init" ausfuehren');
  const identity = stored.value;
  const privateKey = createPrivateKey(readFileSync(join(stateDir, FILES.key)));
  const derived = exportPublicKey(createPublicKey(privateKey));
  if (derived !== identity.publicKey || nodeIdFromKey(derived) !== identity.node) throw new Error('Identitaet inkonsistent (Schluessel passt nicht)');
  return { ...identity, privateKey };
}

const REASON_STATUS = Object.freeze({
  'unknown-peer': 401, 'bad-signature': 401, 'peer-id-mismatch': 401, 'bad-peer-key': 401, unsigned: 401,
  replay: 409, 'clock-drift': 409,
});

export class NodeService {
  constructor({ stateDir, now = () => Date.now() }) {
    this.stateDir = stateDir;
    this.now = now;
    this.faults = [];
    this.ingestBlocked = false;
    this.identity = loadIdentity(stateDir);
    this.clock = new HybridLogicalClock({ node: this.identity.node, now });
    this.path = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, join(stateDir, f)]));
    this.capabilities = new CapabilityRegistry({ now });

    const trust = readJson(this.path.trust);
    this.kernel = TrustKernel.restore(trust.ok ? trust.value : null);
    if (this.kernel.failSafe) this.faults.push('trust-state');

    const confirmers = new Map([[this.identity.node, this.identity.publicKey]]);
    const peers = readJson(this.path.peers);
    const peerState = peers.ok ? (peers.value ?? { schema: 'omega.peer-state/v1', peers: [], revoked: [] }) : null;
    const restoredPeers = PeerRegistry.restore(peerState, { trustedConfirmers: confirmers });
    this.peers = restoredPeers.registry;
    if (!peers.ok || restoredPeers.rejected.length > 0) this.faults.push(`peer-state:${restoredPeers.rejected.join('|') || 'unreadable'}`);

    const leases = readJson(this.path.leases);
    try {
      if (!leases.ok) throw new Error('unreadable');
      this.leases = LeaseManager.restore(leases.value, { now });
    } catch {
      this.leases = new LeaseManager({ now });
      this.faults.push('lease-state');
    }

    mkdirSync(join(stateDir, 'journal'), { recursive: true, mode: 0o700 });
    try {
      this.journal = new EventJournal(this.path.journal);
      if (this.journal.recovered) this.faults.push('journal-tail-recovered');
    } catch (error) {
      this.journal = null;
      this.ingestBlocked = true;
      this.faults.push(`journal:${error.reason ?? 'unreadable'}`);
    }
    this.#initReplayState();

    const hardFaults = this.faults.filter((f) => f !== 'journal-tail-recovered');
    if (hardFaults.length > 0 && !this.kernel.killed) {
      this.kernel.engageKillSwitch();
      this.#saveTrust();
    }
  }

  /** Replay-Schutz aus dem Journal; Untergrenzen nur aus eigenen Rotationen (nie von Peers). */
  #initReplayState() {
    const lastSeq = this.journal ? this.journal.lastSeq() : {};
    for (const rotation of this.journal ? this.journal.rotations() : []) {
      if (rotation.node !== this.identity.node) continue;
      for (const [node, seq] of Object.entries(rotation.floor)) {
        if (NODE_ID.test(node) && Number.isSafeInteger(seq) && seq > (lastSeq[node] ?? 0)) lastSeq[node] = seq;
      }
    }
    this.verifier = EventVerifier.restore({ schema: 'omega.verifier-state/v1', lastSeq }, { peers: this.peers, clock: this.clock });
    this.emitter = new EventEmitterNode({ clock: this.clock, privateKey: this.identity.privateKey, startSeq: lastSeq[this.identity.node] ?? 0 });
  }

  /**
   * Kontrollierte Reparatur durch einen Menschen: defekte Zustaende neu schreiben, ein defektes
   * Journal in Quarantaene verschieben (Sequenz-Untergrenze bleibt erhalten). Der Kill-Switch
   * bleibt danach AN - die Freigabe ist ein zweiter, eigener Schritt.
   */
  repair({ confirmedByHuman } = {}) {
    if (confirmedByHuman !== true) throw new Error('Reparatur nur durch einen Menschen (--confirm-human)');
    const actions = [];
    if (this.faults.includes('trust-state') || this.kernel.failSafe) {
      this.kernel = new TrustKernel({ level: 'E0', killed: true });
      actions.push('trust-reset-E0-killed');
    }
    this.kernel.engageKillSwitch();
    this.#saveTrust();
    if (this.faults.some((f) => f.startsWith('peer-state'))) {
      this.#savePeers();
      actions.push('peers-rewritten');
    }
    if (this.faults.includes('lease-state')) {
      this.#saveLeases();
      actions.push('leases-reset');
    }
    if (!this.journal) {
      const text = existsSync(this.path.journal) ? readFileSync(this.path.journal, 'utf8') : '';
      const floor = salvageSequenceFloor(text);
      const quarantined = `${this.path.journal}.corrupt-${this.now()}`;
      if (existsSync(this.path.journal)) renameSync(this.path.journal, quarantined);
      this.journal = new EventJournal(this.path.journal);
      this.ingestBlocked = false;
      this.#initReplayState();
      // Eigene Sequenz oberhalb der alten fortsetzen, schon fuer das Rotationsereignis selbst.
      this.emitter = new EventEmitterNode({ clock: this.clock, privateKey: this.identity.privateKey, startSeq: floor[this.identity.node] ?? 0 });
      this.emitLocal('journal.rotated', { floor, quarantined: quarantined.split(/[\\/]/).pop(), reason: this.faults.find((f) => f.startsWith('journal:')) ?? 'unknown' });
      this.#initReplayState();
      actions.push('journal-quarantined');
    }
    this.faults = [];
    this.emitLocal('node.repaired', { actions });
    return { repaired: actions, killed: this.kernel.killed, level: this.kernel.level };
  }

  #saveTrust() {
    writeJsonAtomic(this.path.trust, this.kernel.snapshot());
  }

  #saveLeases() {
    writeJsonAtomic(this.path.leases, this.leases.snapshot());
  }

  #savePeers() {
    writeJsonAtomic(this.path.peers, this.peers.snapshot());
  }

  /** Lokales Ereignis signieren und ins Journal schreiben. */
  emitLocal(type, payload = {}, options = {}) {
    if (!this.journal) throw new Error('Journal blockiert');
    const ev = this.emitter.emit(type, payload, options);
    this.journal.append(ev);
    return ev;
  }

  /** Eingehendes Ereignis eines Peers pruefen und journalisieren. */
  ingest(ev) {
    if (this.ingestBlocked || !this.journal) return { ok: false, status: 503, reason: 'state-corrupt' };
    if (ev?.dataClass === 'secret') return { ok: false, status: 422, reason: 'secret-not-transferable' };
    const verdict = this.verifier.accept(ev);
    if (!verdict.ok) return { ok: false, status: REASON_STATUS[verdict.reason] ?? 400, reason: verdict.reason };
    const { index, hash } = this.journal.append(ev);
    if (ev.type === 'control.kill') this.engageKill(`peer:${ev.node}`);
    return { ok: true, status: 202, index, hash };
  }

  engageKill(reason = 'local') {
    this.kernel.engageKillSwitch();
    const revoked = this.leases.revokeAll();
    this.#saveTrust();
    this.#saveLeases();
    if (this.journal) this.emitLocal('control.kill.engaged', { reason, revokedLeases: revoked });
    return { killed: true, revokedLeases: revoked };
  }

  releaseKill({ confirmedByHuman } = {}) {
    if (this.faults.some((f) => f !== 'journal-tail-recovered')) throw new Error(`Zustand defekt (${this.faults.join(', ')}) - erst reparieren`);
    this.kernel.releaseKillSwitch({ confirmedByHuman });
    this.#saveTrust();
    this.emitLocal('control.kill.released', { level: this.kernel.level });
    return { killed: false, level: this.kernel.level };
  }

  pairingCodeFor(peerPublicKey) {
    return pairingCode(this.identity.publicKey, peerPublicKey);
  }

  /** Kopplung: der Mensch tippt den Code ab, den das andere Geraet zeigt. */
  addPeer({ publicKey, role, label, code }) {
    const expected = this.pairingCodeFor(publicKey);
    const matched = typeof code === 'string' && code === expected;
    const entry = createPeerEntry({ publicKey, role, label, addedHlc: this.clock.tick() }, this.identity);
    const result = this.peers.add(entry, { confirmedByHuman: true, pairingCodeMatched: matched });
    if (!result.ok) return result.reason === 'human-confirmation-missing' ? { ok: false, reason: 'pairing-code-mismatch' } : result;
    this.#savePeers();
    this.emitLocal('peer.added', { node: entry.node, role, keyId: entry.keyId });
    return result;
  }

  revokePeer(node) {
    const removed = this.peers.revoke(node);
    this.#savePeers();
    this.emitLocal('peer.revoked', { node });
    return removed;
  }

  /**
   * Erzeugt einen Tasker-Befehl. Der Trust Kernel entscheidet schon beim Absender:
   * deny = Abbruch, approve = nur mit ausdruecklicher menschlicher Bestaetigung (confirmed).
   */
  issueTaskerCommand({ action, params = {}, taskId = action.toLowerCase(), ttlMs = 120_000, secret, risk = 1, confirmed = false }) {
    assertSecret(secret);
    const problem = validateTaskerParams(action, params);
    if (problem) return { ok: false, reason: problem };
    const decision = this.kernel.decide({ cls: TASKER_ACTIONS[action].cls, risk });
    if (decision.verdict === 'deny') return { ok: false, reason: decision.reason };
    if (decision.verdict === 'approve' && confirmed !== true) return { ok: false, reason: `approval-required:${decision.reason}` };
    const acquired = this.leases.acquire(taskId, this.identity.node, ttlMs);
    if (!acquired.ok) return { ok: false, reason: acquired.reason };
    this.#saveLeases();
    const cmd = buildTaskerCommand({ action, params, lease: acquired.lease, hlc: this.clock.tick() }, secret);
    this.emitLocal('tasker.command.issued', { action, taskId, fencingToken: cmd.fencingToken, verdict: decision.verdict });
    return { ok: true, command: cmd, http: toTaskerHttp(cmd) };
  }

  health() {
    return {
      node: this.identity.node,
      label: this.identity.label,
      role: this.identity.role,
      level: this.kernel.level,
      killed: this.kernel.killed,
      failSafe: this.kernel.failSafe,
      faults: [...this.faults],
      ingestBlocked: this.ingestBlocked,
      journal: this.journal ? { length: this.journal.length, head: this.journal.head } : null,
      peers: this.peers.list().length,
    };
  }

  close() {
    this.journal?.close();
  }
}
