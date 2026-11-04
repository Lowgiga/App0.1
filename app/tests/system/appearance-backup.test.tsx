import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {BackupPanel} from '../../src/BackupPanel.tsx';
import {WorkTransportProvider} from '../../src/work-transport.tsx';
import {SharedWorkStateProvider} from '../../src/shared-work-state.tsx';
import {SystemPreferencesProvider} from '../../src/system-preferences.tsx';
import {createBackupAdapter} from '../../src/backup-adapter.ts';
import {emptyWork} from '../../upstream/lib/work-contract.ts';
import {defaultSystemState} from '../../src/system-state.ts';
test('appearance backup boundary is explicit in the rendered backup screen',()=>{
 const transport={request:async()=>{throw Error('SSR must not request storage')}};
 const markup=renderToStaticMarkup(<WorkTransportProvider transport={transport}><SharedWorkStateProvider><SystemPreferencesProvider><BackupPanel data={{sources:[]}}/></SystemPreferencesProvider></SharedWorkStateProvider></WorkTransportProvider>);
 assert.match(markup,/Individuelle Hologramm-Darstellungen/);
 assert.match(markup,/nicht in diesem Backup enthalten/);
});
test('current backup excludes appearance and still cannot restore or modify domain state',async()=>{
 const adapter=createBackupAdapter({sources:[]}),work=emptyWork(),system=defaultSystemState(),before=JSON.stringify({work,system});
 const text=await adapter.export(work,system,'2026-10-05T00:00:00Z'),result=await adapter.preview(text,work,system);
 assert.deepEqual(Object.keys(result.inspection.snapshot.data).sort(),['sourceCatalog','system']);
 assert.equal(result.restoreAvailable,false);assert.deepEqual(result.plan.writes,[]);assert.equal(JSON.stringify({work,system}),before);
});
