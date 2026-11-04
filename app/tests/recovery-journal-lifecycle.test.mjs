import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory, IDBObjectStore, forceCloseDatabase} from 'fake-indexeddb';
import {WorkflowJournalStore} from '../src/studio/workflow-journal.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
const hash = 'sha256:' + 'a'.repeat(64);
function journal() {
  return {
    schema: 'cue.workflow-journal/v1', createdAt: '2026-10-04T00:00:00.000Z',
    updatedAt: '2026-10-04T00:00:00.000Z', sourceUpdatedAt: null, sourceHash: hash,
    spec: {namespace: 'cue.local-pipeline/v1', pipelineId: 'close-regression',
      limits: {maxSteps: 8, maxElapsedMs: 1000},
      steps: [{stepId: 'step-1', kind: 'run-offline-skill', skillId: 'cue.source-status',
        version: '1.0.0', versionHash: hash, input: {sources: []}}]},
    checkpoint: {namespace: 'cue.local-checkpoint/v1', pipelineId: 'close-regression',
      revisionHash: hash, nextStepIndex: 0, completed: [], state: 'paused'},
    pendingStepId: null
  };
}
function fixture() {
  const factory = new IDBFactory(), connections = [];
  const open = factory.open.bind(factory);
  factory.open = (...args) => {
    const request = open(...args);
    request.addEventListener('success', () => connections.push(request.result));
    return request;
  };
  const name = 'journal-recovery-' + crypto.randomUUID();
  return {factory, name, connections, store: new WorkflowJournalStore({indexedDB: factory, name})};
}
async function database(factory, name) {
  return await new Promise((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('journal');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function controlledFactory() {
  const requests = [];
  return {requests, factory: {open() {
    const request = {result: undefined, error: null, transaction: null};
    requests.push(request);
    return request;
  }}};
}
function success(request, db) {
  request.result = db;
  request.onsuccess();
}

test('the same instance reopens and validates a confirmed checkpoint after unexpected close', async () => {
  const f = fixture();
  try {
    const saved = await f.store.save(null, journal());
    forceCloseDatabase(f.connections[0]);
    await tick();
    assert.deepEqual(await f.store.load(), saved);
    assert.deepEqual(await f.store.load(), saved);
    assert.equal(f.connections.length, 2);
    const updated = await f.store.save(saved.revision, journal());
    assert.equal(updated.revision, 2);
    await assert.rejects(f.store.save(saved.revision, journal()), /WORKFLOW_JOURNAL_CONFLICT/);
  } finally { f.store.close(); }
});

test('readonly retries once when transaction creation sees a close before its event arrives', async () => {
  const f = fixture();
  try {
    const saved = await f.store.save(null, journal());
    // An explicit close has no close event, matching the interval before an
    // unexpected-close notification is delivered by the browser.
    f.connections[0].close();
    assert.deepEqual(await f.store.load(), saved);
    assert.equal(f.connections.length, 2);
  } finally { f.store.close(); }
});

test('readonly transaction interrupted by close rereads its confirmed checkpoint once', async () => {
  const f = fixture();
  const saved = await f.store.save(null, journal());
  const old = f.connections[0], notifyClose = old.onclose;
  old.onclose = null;
  const count = IDBObjectStore.prototype.count;
  let interrupted = false;
  IDBObjectStore.prototype.count = function(...args) {
    const request = count.apply(this, args);
    if (!interrupted && this.transaction.db === f.connections[0] && this.transaction.mode === 'readonly') {
      interrupted = true;
      request.addEventListener('success', () => {
        this.transaction.abort();
        forceCloseDatabase(f.connections[0]);
      });
    }
    return request;
  };
  try {
    assert.deepEqual(await f.store.load(), saved);
    assert.equal(interrupted, true);
    assert.equal(f.connections.length, 2);
    // The browser may deliver the old close only after the aborted read.
    notifyClose.call(old, new Event('close'));
    assert.deepEqual(await f.store.load(), saved);
    assert.equal(f.connections.length, 2);
  } finally { IDBObjectStore.prototype.count = count; f.store.close(); }
});

test('readonly retry is bounded and releases the second failed connection', async () => {
  const f = fixture(), open = f.factory.open.bind(f.factory);
  let interrupt = true;
  f.factory.open = (...args) => {
    const request = open(...args);
    request.addEventListener('success', () => {
      const db = request.result, transaction = db.transaction.bind(db);
      let starts = 0;
      db.transaction = (...parameters) => {
        // The first readonly transaction checks store shape; the second loads.
        if (interrupt && ++starts === 2) db.close();
        return transaction(...parameters);
      };
    });
    return request;
  };
  try {
    await assert.rejects(f.store.load(), /WORKFLOW_JOURNAL_READ_FAILED/);
    assert.equal(f.connections.length, 2);
    interrupt = false;
    assert.equal((await f.store.save(null, journal())).revision, 1);
    assert.equal(f.connections.length, 3);
  } finally { f.store.close(); }
});

test('a delayed close/versionchange from an old connection cannot invalidate its replacement', async () => {
  const f = fixture();
  try {
    const saved = await f.store.save(null, journal());
    const old = f.connections[0], oldClose = old.onclose, oldVersionchange = old.onversionchange;
    assert.equal(typeof oldClose, 'function');
    forceCloseDatabase(old);
    assert.deepEqual(await f.store.load(), saved);
    oldClose.call(old, new Event('close'));
    oldVersionchange.call(old, new Event('versionchange'));
    assert.deepEqual(await f.store.load(), saved);
    assert.equal(f.connections.length, 2);
  } finally { f.store.close(); }
});

for (const reason of ['blocked', 'error']) {
  test(`late success of a ${reason} open is closed without replacing a newer connection`, async () => {
    const c = controlledFactory(), realFactory = new IDBFactory();
    const name = 'journal-controlled-' + crypto.randomUUID();
    const old = await database(realFactory, name), current = await database(realFactory, name);
    const store = new WorkflowJournalStore({indexedDB: c.factory, name});
    let oldCloses = 0;
    const close = old.close.bind(old);
    old.close = () => { oldCloses++; close(); };
    try {
      const first = store.load();
      if (reason === 'blocked') c.requests[0].onblocked();
      else { c.requests[0].error = new DOMException('failed', 'UnknownError'); c.requests[0].onerror(); }
      await assert.rejects(first, reason === 'blocked' ? /WORKFLOW_JOURNAL_BLOCKED/ : /WORKFLOW_JOURNAL_OPEN_FAILED/);
      const second = store.load();
      assert.equal(c.requests.length, 2);
      success(c.requests[1], current);
      assert.equal(await second, null);
      success(c.requests[0], old);
      assert.equal(oldCloses, 1);
      assert.equal(await store.load(), null);
      assert.equal(c.requests.length, 2);
    } finally { store.close(); old.close(); current.close(); }
  });
}

test('dispose rejects a pending open immediately and closes its eventual result', async () => {
  const c = controlledFactory(), factory = new IDBFactory();
  const name = 'journal-dispose-' + crypto.randomUUID(), db = await database(factory, name);
  const store = new WorkflowJournalStore({indexedDB: c.factory, name});
  let closes = 0;
  const close = db.close.bind(db);
  db.close = () => { closes++; close(); };
  const pending = store.load();
  const settled = pending.then(() => 'resolved', error => error.code);
  try {
    store.close();
    store.close();
    let outcome;
    void settled.then(value => { outcome = value; });
    await tick();
    assert.equal(outcome, 'WORKFLOW_JOURNAL_CLOSED');
    success(c.requests[0], db);
    assert.equal(closes, 1);
    await assert.rejects(store.load(), /WORKFLOW_JOURNAL_CLOSED/);
    await assert.rejects(store.save(null, journal()), /WORKFLOW_JOURNAL_CLOSED/);
    assert.equal(c.requests.length, 1);
  } finally {
    // Settle the original implementation's pending request when this regression fails.
    if (!closes) success(c.requests[0], db);
    db.close();
  }
});

test('write abort plus unexpected close never triggers a second commit', async () => {
  const f = fixture();
  const saved = await f.store.save(null, journal());
  const put = IDBObjectStore.prototype.put;
  let writes = 0;
  IDBObjectStore.prototype.put = function(...args) {
    writes++;
    const request = put.apply(this, args);
    request.addEventListener('success', () => {
      this.transaction.abort();
      forceCloseDatabase(f.connections[0]);
    });
    return request;
  };
  try {
    await assert.rejects(f.store.save(saved.revision, journal()), /WORKFLOW_JOURNAL_WRITE_FAILED/);
    assert.equal(writes, 1);
  } finally { IDBObjectStore.prototype.put = put; }
  try {
    await tick();
    assert.deepEqual(await f.store.load(), saved);
    const explicit = await f.store.save(saved.revision, journal());
    assert.equal(explicit.revision, 2);
  } finally { f.store.close(); }
});

test('transaction creation on a closed connection does not retry a write', async () => {
  const f = fixture();
  try {
    const saved = await f.store.save(null, journal());
    f.connections[0].close();
    await assert.rejects(f.store.save(saved.revision, journal()), /WORKFLOW_JOURNAL_WRITE_FAILED/);
    assert.equal(f.connections.length, 1);
    assert.deepEqual(await f.store.load(), saved);
    assert.equal(f.connections.length, 2);
  } finally { f.store.close(); }
});

test('reopening still rejects a foreign schema without deleting its data', async () => {
  const f = fixture();
  try {
    const saved = await f.store.save(null, journal());
    const corrupt = {...saved, value: {...saved.value, schema: 'foreign/v2'}};
    await new Promise((resolve, reject) => {
      const tx = f.connections[0].transaction('journal', 'readwrite');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
      tx.objectStore('journal').put(corrupt, 'current');
    });
    forceCloseDatabase(f.connections[0]);
    await assert.rejects(f.store.load(), /WORKFLOW_JOURNAL_SCHEMA/);
    await assert.rejects(f.store.save(saved.revision, journal()), /WORKFLOW_JOURNAL_SCHEMA/);
    assert.equal(f.connections.length, 2);
    const db = await database(f.factory, f.name);
    try {
      const raw = await new Promise((resolve, reject) => {
        const tx = db.transaction('journal', 'readonly');
        const read = tx.objectStore('journal').get('current');
        tx.oncomplete = () => resolve(read.result);
        tx.onabort = () => reject(tx.error);
      });
      assert.deepEqual(raw, corrupt);
    } finally { db.close(); }
  } finally { f.store.close(); }
});
