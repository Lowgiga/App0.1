/**
 * Dependency-free, read-only JSON transport. No I/O, storage, network or execution.
 * Application validity belongs to the injected savedWorkContract.safeParse callback.
 */
export const FORMAT = 'cue-command-mesh-backup';
export const FORMAT_VERSION = 1;
export const SCHEMA_ID = 'cue-command-mesh-work';
export const SCHEMA_VERSION = 4;
export const DEFAULT_MAX_BYTES = 2_000_000;
const MAX_DEPTH = 100;
const MAX_REPORTED_CHANGES = 250;
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
// Defense in depth, not a detector for credentials pasted into free-text fields.
const sensitiveKeys = new Set(['password', 'passwd', 'apikey', 'accesstoken', 'refreshtoken', 'privatekey', 'authorization', 'cookie', 'clientsecret', 'secretkey', 'sessiontoken']);
const encoder = new TextEncoder();
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const policy = () => ({ decisions: 'historical-only', externalActions: 'not-authorized' });

export class BackupError extends Error {
  constructor(code, message) { super(message); this.name = 'BackupError'; this.code = code; }
}
const fail = (code, message) => { throw new BackupError(code, message); };
const bytes = value => encoder.encode(value).byteLength;
const byteLimit = (text, limit) => { if (text.length > limit || bytes(text) > limit) fail('SIZE_LIMIT', 'UTF-8 backup size exceeds the configured limit.'); };

function getOptions(options) {
  if (!options || typeof options.validateWork !== 'function') fail('INVALID_OPTIONS', 'An actual saved-work validator is required.');
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 64_000_000) fail('INVALID_OPTIONS', 'maxBytes must be an integer between 1 and 64000000.');
  if (options.expectedSourceRevision !== undefined && !nonempty(options.expectedSourceRevision)) fail('INVALID_OPTIONS', 'Expected source revision must be nonempty.');
  return { validateWork: options.validateWork, maxBytes, expectedSourceRevision: options.expectedSourceRevision };
}

/** Sorted UTF-16 property names, original array order and ECMAScript JSON primitives. */
function canonicalJSON(value, maxBytes) {
  const ancestors = new Set();
  const chunks = [];
  let size = 0;
  const emit = text => { size += bytes(text); if (size > maxBytes) fail('SIZE_LIMIT', 'UTF-8 JSON size exceeds the configured limit.'); chunks.push(text); };
  function visit(item, depth) {
    if (depth > MAX_DEPTH) fail('DEPTH_LIMIT', 'JSON nesting exceeds 100 levels.');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') { emit(JSON.stringify(item)); return; }
    if (typeof item === 'number') {
      if (!Number.isFinite(item) || Object.is(item, -0)) fail('INVALID_JSON_VALUE', 'Only lossless finite JSON numbers are supported.');
      emit(JSON.stringify(item)); return;
    }
    if (typeof item !== 'object') fail('INVALID_JSON_VALUE', 'Only plain JSON data is supported.');
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if ((!array && prototype !== Object.prototype && prototype !== null) || (array && prototype !== Array.prototype) || ancestors.has(item)) fail('INVALID_JSON_VALUE', 'Cycles and non-plain objects are not supported.');
    const descriptors = Object.getOwnPropertyDescriptors(item), keys = Reflect.ownKeys(descriptors);
    for (const key of keys) {
      if (typeof key !== 'string') fail('INVALID_JSON_VALUE', 'Symbol properties cannot be backed up.');
      if (unsafeKeys.has(key)) fail('UNSAFE_KEY', 'A prototype-sensitive property name is not allowed.');
      if (sensitiveKeys.has(key.replace(/[-_]/g, '').toLowerCase())) fail('SENSITIVE_KEY', 'Credential-bearing properties are not allowed in backups.');
      if (array && key === 'length') continue;
      const descriptor = descriptors[key];
      if (!has(descriptor, 'value') || !descriptor.enumerable) fail('INVALID_JSON_VALUE', 'Accessors and hidden properties cannot be backed up.');
    }
    ancestors.add(item);
    if (array) {
      if (keys.length !== item.length + 1 || keys.some(k => k !== 'length' && !/^(0|[1-9][0-9]*)$/.test(k))) fail('INVALID_JSON_VALUE', 'Sparse arrays and custom array properties cannot be backed up.');
      emit('[');
      for (let i = 0; i < item.length; i++) {
        if (!has(descriptors, String(i))) fail('INVALID_JSON_VALUE', 'Sparse arrays cannot be backed up.');
        if (i) emit(','); visit(descriptors[i].value, depth + 1);
      }
      emit(']');
    } else {
      emit('{');
      keys.sort().forEach((key, i) => { if (i) emit(','); emit(JSON.stringify(key)); emit(':'); visit(descriptors[key].value, depth + 1); });
      emit('}');
    }
    ancestors.delete(item);
  }
  visit(value, 0);
  return chunks.join('');
}

// JSON.parse has already checked the grammar. This second pass rejects duplicate
// names before their last-value-wins interpretation can become trusted data.
function rejectDuplicateKeys(text) {
  let offset = 0;
  const whitespace = () => { while (/\s/.test(text[offset] ?? '') && offset < text.length) offset++; };
  function stringToken(decode = false) {
    const start = offset++;
    while (offset < text.length) {
      if (text[offset] === '\\') { offset += 2; continue; }
      if (text[offset++] === '"') break;
    }
    return decode ? JSON.parse(text.slice(start, offset)) : undefined;
  }
  function visit(depth) {
    if (depth > MAX_DEPTH) fail('DEPTH_LIMIT', 'JSON nesting exceeds 100 levels.');
    whitespace();
    if (text[offset] === '{') {
      const keys = new Set(); offset++; whitespace();
      if (text[offset] === '}') { offset++; return; }
      while (offset < text.length) {
        whitespace(); const key = stringToken(true);
        if (keys.has(key)) fail('DUPLICATE_KEY', 'Duplicate JSON property names are not allowed.');
        keys.add(key); whitespace(); offset++; visit(depth + 1); whitespace();
        if (text[offset++] === '}') return;
      }
    } else if (text[offset] === '[') {
      offset++; whitespace();
      if (text[offset] === ']') { offset++; return; }
      while (offset < text.length) { visit(depth + 1); whitespace(); if (text[offset++] === ']') return; }
    } else if (text[offset] === '"') stringToken();
    else while (offset < text.length && !/[,}\]\s]/.test(text[offset])) offset++;
  }
  visit(0);
}

function freeze(value) {
  if (value !== null && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}
const detached = (value, maxBytes) => JSON.parse(canonicalJSON(value, maxBytes));
const nonempty = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
function exact(object, keys, label) {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).length !== keys.length || keys.some(key => !has(object, key))) fail('INVALID_METADATA', `${label} has missing or unsupported fields.`);
}
function timestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
}
// Inputs are already validated UTC timestamps. Compare fractional seconds as
// decimal digits rather than Date.parse, which truncates below milliseconds.
function timestampAfter(left, right) {
  const leftSeconds = left.slice(0, 19), rightSeconds = right.slice(0, 19);
  if (leftSeconds !== rightSeconds) return leftSeconds > rightSeconds;
  const leftFraction = left[19] === '.' ? left.slice(20, -1) : '';
  const rightFraction = right[19] === '.' ? right.slice(20, -1) : '';
  const width = Math.max(leftFraction.length, rightFraction.length);
  return leftFraction.padEnd(width, '0') > rightFraction.padEnd(width, '0');
}
function validateSnapshotShape(snapshot) {
  exact(snapshot, ['work', 'data'], 'Snapshot');
  if (!snapshot.work || typeof snapshot.work !== 'object' || Array.isArray(snapshot.work) || snapshot.work.stateVersion !== SCHEMA_VERSION || !has(snapshot.work, 'updatedAt') || (snapshot.work.updatedAt !== null && !timestamp(snapshot.work.updatedAt))) fail('INVALID_METADATA', 'Work state version or update timestamp is inconsistent.');
}
function validateMetadata(body, expectedRevision) {
  exact(body, ['format', 'formatVersion', 'schema', 'producer', 'source', 'exportedAt', 'policy', 'payload'], 'Envelope');
  if (body.format !== FORMAT) fail('INVALID_METADATA', 'Unsupported backup format.');
  if (body.formatVersion !== FORMAT_VERSION) fail('UNSUPPORTED_VERSION', 'Unsupported backup format version.');
  exact(body.schema, ['id', 'version'], 'Schema');
  if (body.schema.id !== SCHEMA_ID) fail('INVALID_METADATA', 'Unsupported application schema.');
  if (body.schema.version !== SCHEMA_VERSION) fail('UNSUPPORTED_VERSION', 'Unsupported application schema version.');
  exact(body.producer, ['name', 'version'], 'Producer');
  exact(body.source, ['revision', 'workUpdatedAt'], 'Source');
  exact(body.policy, ['decisions', 'externalActions'], 'Policy');
  if (!nonempty(body.producer.name) || !nonempty(body.producer.version) || !nonempty(body.source.revision) || !timestamp(body.exportedAt) || body.policy.decisions !== 'historical-only' || body.policy.externalActions !== 'not-authorized') fail('INVALID_METADATA', 'Required metadata is invalid.');
  validateSnapshotShape(body.payload);
  if (body.source.workUpdatedAt !== body.payload.work.updatedAt || (body.source.workUpdatedAt !== null && timestampAfter(body.source.workUpdatedAt, body.exportedAt))) fail('INVALID_METADATA', 'Source and work timestamps are inconsistent.');
  if (expectedRevision !== undefined && body.source.revision !== expectedRevision) fail('SOURCE_REVISION_MISMATCH', 'Source revision differs from the requested revision.');
}
async function validateWork(snapshot, options) {
  const original = canonicalJSON(snapshot.work, options.maxBytes);
  let result;
  try { result = await options.validateWork(freeze(JSON.parse(original))); }
  catch { fail('VALIDATION_FAILED', 'The saved-work validator rejected this state.'); }
  if (!result || result.success !== true || !has(result, 'data')) fail('VALIDATION_FAILED', 'The saved-work validator rejected this state.');
  let normalized;
  try { normalized = canonicalJSON(result.data, options.maxBytes); }
  catch { fail('VALIDATION_FAILED', 'The saved-work validator returned invalid JSON data.'); }
  return normalized !== original;
}
async function sha256(text) {
  if (!globalThis.crypto?.subtle?.digest) fail('CRYPTO_UNAVAILABLE', 'WebCrypto SHA-256 requires a supported secure runtime.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** Returns canonical JSON text, not a saved file. Inputs are never mutated. */
export async function exportBackup(snapshot, metadata, rawOptions) {
  const options = getOptions(rawOptions);
  const payload = detached(snapshot, options.maxBytes);
  const meta = detached(metadata, options.maxBytes);
  exact(meta, ['producer', 'source', 'exportedAt'], 'Export metadata');
  const body = { format: FORMAT, formatVersion: FORMAT_VERSION, schema: { id: SCHEMA_ID, version: SCHEMA_VERSION }, ...meta, policy: policy(), payload };
  validateMetadata(body, options.expectedSourceRevision);
  const bodyText = canonicalJSON(body, options.maxBytes);
  // Apply the full envelope limit, including metadata and digest overhead, before validation/hash.
  const integrity = { algorithm: 'SHA-256', canonicalization: 'sorted-json-v1', digest: '0'.repeat(64), payloadBytes: bytes(canonicalJSON(payload, options.maxBytes)) };
  canonicalJSON({ ...body, integrity }, options.maxBytes);
  await validateWork(payload, options);
  integrity.digest = await sha256(bodyText);
  return canonicalJSON({ ...body, integrity }, options.maxBytes);
}

/** Untrusted file text -> frozen historical data. Does not restore or authorize anything. */
export async function importBackup(text, rawOptions) {
  const options = getOptions(rawOptions);
  if (typeof text !== 'string') fail('INVALID_JSON', 'Import requires JSON text.');
  byteLimit(text, options.maxBytes);
  let envelope;
  try { envelope = JSON.parse(text); } catch { fail('INVALID_JSON', 'Malformed JSON backup.'); }
  rejectDuplicateKeys(text);
  canonicalJSON(envelope, options.maxBytes);
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || !has(envelope, 'integrity')) fail('INVALID_METADATA', 'Backup integrity metadata is missing.');
  const { integrity, ...body } = envelope;
  validateMetadata(body, options.expectedSourceRevision);
  exact(integrity, ['algorithm', 'canonicalization', 'digest', 'payloadBytes'], 'Integrity');
  if (integrity.algorithm !== 'SHA-256' || integrity.canonicalization !== 'sorted-json-v1' || typeof integrity.digest !== 'string' || !/^[a-f0-9]{64}$/.test(integrity.digest) || !Number.isSafeInteger(integrity.payloadBytes) || integrity.payloadBytes < 0) fail('INVALID_METADATA', 'Invalid integrity metadata.');
  const digest = await sha256(canonicalJSON(body, options.maxBytes));
  if (digest !== integrity.digest) fail('INTEGRITY_MISMATCH', 'Backup content or metadata has changed.');
  if (integrity.payloadBytes !== bytes(canonicalJSON(body.payload, options.maxBytes))) fail('INVALID_METADATA', 'Declared payload byte length is inconsistent.');
  const normalizationDetected = await validateWork(body.payload, options);
  return freeze({ snapshot: body.payload, metadata: { format: body.format, formatVersion: body.formatVersion, schema: body.schema, producer: body.producer, source: body.source, exportedAt: body.exportedAt }, integrity, normalizationDetected, decisionRecords: 'historical-only', externalActionsAuthorized: false });
}

const pointer = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
function inventory(value, path = '', output = {}) {
  if (Array.isArray(value)) output[path] = value.length;
  if (value && typeof value === 'object') for (const key of Object.keys(value)) inventory(value[key], `${path}/${pointer(key)}`, output);
  return output;
}
function compare(current, incoming) {
  const changes = [], conflicts = [];
  let differenceCount = 0, conflictCount = 0;
  function add(path, kind) {
    differenceCount++;
    const change = { path, kind };
    if (changes.length < MAX_REPORTED_CHANGES) changes.push(change);
    if (kind !== 'added') { conflictCount++; if (conflicts.length < MAX_REPORTED_CHANGES) conflicts.push(change); }
  }
  function visit(a, b, path) {
    if (Object.is(a, b)) return;
    const aObject = a !== null && typeof a === 'object', bObject = b !== null && typeof b === 'object';
    if (!aObject || !bObject || Array.isArray(a) !== Array.isArray(b)) { add(path, 'changed'); return; }
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const key of keys) {
      const next = `${path}/${pointer(key)}`;
      if (!has(a, key)) add(next, 'added');
      else if (!has(b, key)) add(next, 'removed');
      else visit(a[key], b[key], next);
    }
  }
  if (current === null) add('', 'added'); else visit(current, incoming, '');
  return { changes, conflicts, differenceCount, conflictCount, truncated: differenceCount > changes.length || conflictCount > conflicts.length };
}

/** Read-only structural comparison. null explicitly means no saved target exists. */
export async function prepareRestore(text, currentSnapshot, rawOptions) {
  if (currentSnapshot === undefined) fail('TARGET_REQUIRED', 'Supply the current snapshot or explicitly confirm absence with null.');
  const options = getOptions(rawOptions), incoming = await importBackup(text, options);
  let current = null, currentNormalizationDetected = false, currentPayloadDigest = null;
  if (currentSnapshot !== null) {
    current = detached(currentSnapshot, options.maxBytes);
    validateSnapshotShape(current);
    currentNormalizationDetected = await validateWork(current, options);
    currentPayloadDigest = await sha256(canonicalJSON(current, options.maxBytes));
  }
  const comparison = compare(current, incoming.snapshot);
  return freeze({ mode: 'preview-only', targetState: current === null ? 'absent' : comparison.differenceCount ? 'different' : 'identical', requiresExplicitRestoreAuthorization: true, externalActionsAuthorized: false, decisionRecords: 'historical-only', writes: [], currentPayloadDigest, incomingPayloadDigest: await sha256(canonicalJSON(incoming.snapshot, options.maxBytes)), incomingMetadata: incoming.metadata, normalizationDetected: { incoming: incoming.normalizationDetected, current: currentNormalizationDetected }, inventory: { current: current === null ? {} : inventory(current), incoming: inventory(incoming.snapshot) }, ...comparison });
}
