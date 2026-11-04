import test from 'node:test';
import assert from 'node:assert/strict';
import {viewIds} from '../../upstream/lib/work-contract.ts';

// Loading through a URL makes the initial RED run an assertion about the
// missing feature rather than an unrelated test-loader failure.
const mobile: any = await import(new URL('../../src/mobile/mobile-contract.ts', import.meta.url).href).catch(() => ({}));
const required = () => { assert.equal(typeof mobile.parseMobilePreferences, 'function', 'mobile preference contract is implemented'); return mobile; };

test('mobile catalog covers all 17 original views and only bounded internal navigation', () => {
  const {mobileActions} = required();
  assert.equal(viewIds.length, 17);
  assert.deepEqual(mobileActions.filter((a: any) => a.target.kind === 'view').map((a: any) => a.target.view).sort(), [...viewIds].sort());
  assert.deepEqual(mobileActions.filter((a: any) => a.target.kind === 'studio').map((a: any) => a.target.tab).sort(), ['assistant','backup','graph','memory','skills','surface']);
  assert.equal(new Set(mobileActions.map((a: any) => a.id)).size, mobileActions.length);
  for (const action of mobileActions) { assert.ok(action.label.length > 0 && action.description.length > 0); assert.deepEqual(Object.keys(action.target).sort(), action.target.kind === 'view' ? ['kind','view'] : ['kind','tab']); }
});

test('zero through four assigned slots are accepted; defaults have independent copies', () => {
  const {parseMobilePreferences, defaultMobilePreferences} = required();
  for (let count = 0; count <= 4; count++) {
    const slots = ['view:overview','view:missions','studio:assistant','view:settings'].map((id, i) => i < count ? id : null);
    assert.deepEqual(parseMobilePreferences({slots}), {slots});
  }
  const first = defaultMobilePreferences(), second = defaultMobilePreferences(); first.slots[0] = null;
  assert.equal(second.slots[0], 'view:overview');
});

test('duplicates, oversized, missing slots, unknown keys and policy actions fail closed', () => {
  const {parseMobilePreferences} = required();
  const invalid = [null, {}, {slots:[]}, {slots:['view:overview']}, {slots:[null,null,null,null,null]}, {slots:['view:overview','view:overview',null,null]}, {slots:['approve',null,null,null]}, {slots:['delete',null,null,null]}, {slots:['view:unknown',null,null,null]}, {slots:[false,null,null,null]}, {slots:[null,null,null,null], permissions:true}];
  for (const value of invalid) assert.throws(() => parseMobilePreferences(value));
});

test('assignment validates the slot and action, and refuses duplicate assignment without mutation', () => {
  const {assignMobileSlot, defaultMobilePreferences} = required(); const value = defaultMobilePreferences(), before = structuredClone(value);
  assert.deepEqual(assignMobileSlot(value, 1, null).slots, ['view:overview',null,'studio:assistant','view:settings']);
  assert.equal(assignMobileSlot(value, 1, 'view:matrix').slots[1], 'view:matrix');
  for (const [slot, action] of [[-1,null],[4,null],[0.5,null],[1,'view:overview'],[0,'reload'],[0,'studio:run']] as const) assert.throws(() => assignMobileSlot(value, slot, action));
  assert.deepEqual(value, before);
});

test('missing preference uses defaults without mutating legacy state; corrupt present values never silently default', () => {
  const {readMobilePreferences, defaultMobilePreferences} = required(); const legacy = {schema:'cue.system-state/v1'};
  assert.deepEqual(readMobilePreferences(legacy), defaultMobilePreferences()); assert.deepEqual(legacy, {schema:'cue.system-state/v1'});
  assert.throws(() => readMobilePreferences({...legacy,mobile:null}));
  assert.throws(() => readMobilePreferences({...legacy,mobile:undefined}));
});
