import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCatalog,createKernel,createHostAuthority,hashManifest,hashManifestWeb} from '../src/index.mjs';
const root=fileURLToPath(new URL('../skills/',import.meta.url));
function setup(id) {
 const catalog=createCatalog({root}),authority=createHostAuthority(),kernel=createKernel({catalog,authority}),m=catalog.list().find(s=>s.id===id);
 const token=authority.issue({skillApprovals:[{id,versionHash:m.versionHash,test:{status:'passed',runId:'examples-test'}}],tools:m.tools.map(t=>({id:t.id,catalogued:true,configured:true,authenticated:'not-required',authorized:true,permissions:t.permissions,check:{status:'passed',runId:'builtin-self-test'}}))});
 assert.equal(kernel.verify(id).status,'passed');return {catalog,kernel,token};
}
test('four original examples have standard skill names and valid hashes',async()=>{
 const c=createCatalog({root});assert.equal(c.list().length,4);
 for(const m of c.list()) {assert.equal(c.verify(m.id).status,'passed');assert.equal(await hashManifestWeb(m),hashManifest(m));assert.equal(m.name,m.id.slice(4));assert.ok(m.description.length<=1024);}
});
test('mission checks supplied values without inventing completion',()=>{
 const {kernel,token}=setup('cue.mission-check');const r=kernel.run('cue.mission-check',{title:'',steps:[{title:'',done:false}]},token);assert.equal(r.completedCount,0);assert.equal(r.issues.length,2);
});
test('graph explains adjacency and reports dangling links deterministically',()=>{
 const {kernel,token}=setup('cue.graph-explain');const data={nodes:[{id:'b',label:'Tool'},{id:'a',label:'Mission'}],edges:[{source:'a',target:'b'},{source:'a',target:'missing'}]};
 const r=kernel.run('cue.graph-explain',data,token);assert.equal(r.nodeCount,2);assert.equal(r.edgeCount,2);assert.deepEqual(r.danglingEdges,[{source:'a',target:'missing'}]);assert.deepEqual(r.adjacency[0],{id:'a',label:'Mission',outbound:['b','missing'],inbound:[]});
 assert.throws(()=>kernel.run('cue.graph-explain',{nodes:[{id:'a',label:'A'},{id:'a',label:'A'}],edges:[]},token),/duplicate/i);
});
test('backup output is a plan and never a false restore confirmation',()=>{
 const {kernel,token}=setup('cue.backup-plan');const r=kernel.run('cue.backup-plan',{name:'Daily snapshot',location:'offline-drive',hasChecksum:false,hasRestoreEvidence:false},token);
 assert.equal(r.verified,false);assert.ok(r.steps.length>=4);assert.equal(r.warnings.length,3);assert.equal(r.mode,'offline-deterministic');
});
test('source status never calls a snapshot catalog installed tools',()=>{
 const {kernel,token}=setup('cue.source-status');const r=kernel.run('cue.source-status',{sources:[{id:'mesh',kind:'snapshot',label:'mesh-data',toolCount:1078},{id:'claim',kind:'live-claim',label:'Claimed connector'},{id:'unknown',kind:'unknown',label:'Unknown'}]},token);
 assert.equal(r.installedToolCount,null);assert.equal(r.snapshotCount,1);assert.equal(r.liveClaimCount,1);assert.equal(r.unknownCount,1);assert.equal(r.statuses[0].status,'snapshot-only');
});
test('portable browser import graph has no node modules or execution/network APIs',()=>{
 const pending=[fileURLToPath(new URL('../src/browser.mjs',import.meta.url))],seen=new Set();
 while(pending.length) {const p=pending.pop();if(seen.has(p)) continue;seen.add(p);const code=fs.readFileSync(p,'utf8');
  assert.doesNotMatch(code,/from\s*['"]node:|\beval\s*\(|\bnew\s+Function\s*\(|\bfetch\s*\(|\bXMLHttpRequest\b|\bimport\s*\(/);
  for(const m of code.matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+)['"]/g)) pending.push(path.resolve(path.dirname(p),m[1]));
 }
 assert.ok(seen.size>=5);
});
test('largest valid mission returns every issue within its output schema',()=>{
 const {kernel,token}=setup('cue.mission-check');const r=kernel.run('cue.mission-check',{title:'',steps:Array.from({length:1000},()=>({title:'',done:false}))},token);
 assert.equal(r.stepCount,1000);assert.equal(r.issues.length,1001);
});
