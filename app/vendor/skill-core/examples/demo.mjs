import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createCatalog,createKernel,createHostAuthority} from '../src/index.mjs';
import {executeBuiltin} from '../src/handlers.mjs';

const catalog=createCatalog({root:fileURLToPath(new URL('../skills/',import.meta.url))});
const authority=createHostAuthority(); // Owned by trusted application code, never a package.
const kernel=createKernel({catalog,authority});
const request={intent:'mission-check',tags:['mission'],nodeType:'mission'};
const input={title:'Offline quality check',steps:[{title:'Check supplied data',done:true},{title:'Review result',done:false}]};
const manifest=catalog.list().find(s=>s.id==='cue.mission-check');
const before=kernel.readiness(manifest.id);

// Real local, limited self-check; not a connector test and not an LLM execution.
assert.deepEqual(executeBuiltin('mission-check',input),{
 mode:'offline-deterministic',title:'Offline quality check',stepCount:2,completedCount:1,issues:[]
});
assert.equal(kernel.verify(manifest.id).status,'passed');
const evidence=authority.issue({
 skillApprovals:[{id:manifest.id,versionHash:manifest.versionHash,test:{status:'passed',runId:'demo-local-self-check'}}],
 tools:manifest.tools.map(t=>({id:t.id,catalogued:true,configured:true,authenticated:'not-required',authorized:true,
  permissions:t.permissions,check:{status:'passed',runId:'demo-local-self-check'}}))
},{ttlMs:60000});
const result=kernel.run(manifest.id,input,evidence);
const prompt=kernel.prompt(manifest.id,{request:'Check this supplied mission',input,maxBytes:8192},evidence);
console.log(JSON.stringify({
 mode:'offline-only',modelCalled:false,externalToolsCalled:false,
 cataloguedSkills:catalog.list().map(({id,version,versionHash})=>({id,version,versionHash})),
 readinessBeforeHostEvidence:before,
 inspector:kernel.inspect(request,evidence),result,
 promptBytes:new TextEncoder().encode(JSON.stringify(prompt)).length,
 promptContainsAuthorityHandle:false,
 history:kernel.events()
},null,2));
