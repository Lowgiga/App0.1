import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {PreferencesStore} from '../../src/preferences-store.ts';
import {defaultSystemState,parseSystemState,appendRunHistory} from '../../src/system-state.ts';
import {defaultMobilePreferences} from '../../src/mobile/mobile-contract.ts';
import {createBackupAdapter} from '../../src/backup-adapter.ts';
import {emptyWork} from '../../upstream/lib/work-contract.ts';

test('optional mobile preferences persist across CAS save, close and reload without resetting existing values', async () => {
  const indexedDB=new IDBFactory(),name=crypto.randomUUID(),a=new PreferencesStore({indexedDB,name});
  const loaded=await a.load(); const legacy=appendRunHistory({...loaded.value,surfaceLayout:'split',graph:{...loaded.value.graph,visualStyle:'hologram'}},{id:'existing-run',at:'2026-10-05T08:00:00Z',state:'completed',sourceUpdatedAt:null,completedCount:1,outputs:[]});
  const previous=await a.save(loaded.revision,()=>legacy); const mobile=defaultMobilePreferences(); mobile.slots[1]='view:matrix';
  const saved=await a.save(previous.revision,current=>({...current,mobile}));a.close();
  const b=new PreferencesStore({indexedDB,name});try { const reloaded=await b.load(); assert.equal(reloaded.revision,previous.revision+1);assert.deepEqual(reloaded.value,{...legacy,mobile});assert.deepEqual(saved,reloaded); } finally { b.close(); }
});

test('pre-mobile v1 values remain byte-equivalent and absent mobile fields are not materialized', async () => {
  const legacy=defaultSystemState();assert.equal(Object.hasOwn(legacy,'mobile'),false);assert.deepEqual(parseSystemState(legacy),legacy);
  const a=new PreferencesStore({indexedDB:new IDBFactory(),name:crypto.randomUUID(),legacy:{getItem:()=>JSON.stringify(legacy)}});
  try { assert.deepEqual((await a.load()).value,legacy); } finally { a.close(); }
});

test('bad mobile data, foreign versions and capacity overflow fail without changing the saved record', async () => {
  const a=new PreferencesStore({indexedDB:new IDBFactory(),name:crypto.randomUUID()});
  try {
    const before=await a.load();
    for(const patch of [{mobile:null},{mobile:undefined},{mobile:{slots:['view:overview','view:overview',null,null]}},{mobile:{slots:['approve',null,null,null]}},{schema:'cue.system-state/v99'},{unknown:true}]) {
      await assert.rejects(a.save(before.revision,current=>({...current,...patch} as any)));assert.deepEqual(await a.load(),before);
    }
    assert.throws(()=>parseSystemState({...before.value,mobile:defaultMobilePreferences(),history:[{outputs:['x'.repeat(1024*1024)]}]}),/Größenlimit/);
  } finally { a.close(); }
});

test('mobile saves cannot overwrite a newer Studio history or settings revision', async () => {
  const indexedDB=new IDBFactory(),name=crypto.randomUUID(),a=new PreferencesStore({indexedDB,name}),b=new PreferencesStore({indexedDB,name});
  try {const stale=await a.load(),fresh=await b.load();const saved=await b.save(fresh.revision,current=>({...current,surfaceLayout:'focus'}));await assert.rejects(a.save(stale.revision,current=>({...current,mobile:defaultMobilePreferences()})),/PREFERENCES_CONFLICT/);assert.deepEqual(await a.load(),saved);} finally {a.close();b.close();}
});

test('mobile preferences travel in the existing backup export and preview without restore writes', async () => {
  const adapter=createBackupAdapter({sources:[]}),work=emptyWork(),system={...defaultSystemState(),mobile:defaultMobilePreferences()};
  const text=await adapter.export(work,system,'2026-10-05T08:00:00Z'),preview=await adapter.preview(text,work,system);
  assert.deepEqual(preview.inspection.snapshot.data.system,system);assert.deepEqual(preview.plan.writes,[]);assert.equal(preview.plan.targetState,'identical');assert.equal(preview.restoreAvailable,false);
});
