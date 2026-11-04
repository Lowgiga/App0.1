import {assertJson,copy,exactFields,stringList,utf8Bytes} from './contract.mjs';
/** HOST-ONLY. Do not expose issue/resolve or this module to skill data or model tools. */
export function createHostAuthority({now=()=>globalThis.performance.now()}={}) {
 const handles=new WeakMap();let lastObserved=-Infinity;
 function clock() {const value=now();if(!Number.isFinite(value)||value<lastObserved) return NaN;lastObserved=value;return value;}
 function validateCheck(check) {
  exactFields(check,['status','runId'],['status']);
  if(!['passed','failed','unknown'].includes(check.status) || (check.status==='passed' && (typeof check.runId!=='string' || !check.runId.trim()))) throw new Error('Passing check requires host runId');
 }
 return Object.freeze({
  issue(claims,{ttlMs=300000}={}) {
   assertJson(claims);if(utf8Bytes(JSON.stringify(claims))>131072) throw new Error('Host evidence size budget exceeded');
   if(!Number.isSafeInteger(ttlMs) || ttlMs<1 || ttlMs>3600000) throw new Error('Invalid evidence ttl');
   exactFields(claims,['skillApprovals','tools']);
   if(!Array.isArray(claims.tools) || !Array.isArray(claims.skillApprovals) || claims.tools.length>128 || claims.skillApprovals.length>64) throw new Error('Invalid host evidence lists');
   if(new Set(claims.tools.map(t=>t.id)).size!==claims.tools.length || new Set(claims.skillApprovals.map(t=>t.id)).size!==claims.skillApprovals.length) throw new Error('Duplicate host evidence');
   for(const tool of claims.tools) {
    exactFields(tool,['id','catalogued','configured','authenticated','authorized','permissions','check']);
    stringList([tool.id]);stringList(tool.permissions,{tokens:true});
    for(const k of ['catalogued','configured','authorized']) if(![true,false,'unknown'].includes(tool[k])) throw new Error('Invalid capability status');
    if(![true,false,'unknown','not-required'].includes(tool.authenticated)) throw new Error('Invalid authentication status');
    validateCheck(tool.check);
   }
   for(const skill of claims.skillApprovals) {
    exactFields(skill,['id','versionHash','test']);stringList([skill.id]);
    if(typeof skill.versionHash!=='string' || !/^sha256:[a-f0-9]{64}$/.test(skill.versionHash)) throw new Error('Invalid approval version hash');validateCheck(skill.test);
   }
   const issuedAt=clock();if(!Number.isFinite(issuedAt)) throw new Error('Invalid host clock');
   const handle=Object.freeze(Object.create(null));handles.set(handle,{claims:copy(claims),issuedAt,expiresAt:issuedAt+ttlMs});return handle;
  },
  resolve(handle) {
   const record=handle && typeof handle==='object' ? handles.get(handle) : undefined;
   const current=clock();if(!record) return null;
   if(!Number.isFinite(current) || current<record.issuedAt || current>=record.expiresAt) {handles.delete(handle);return null;}
   return copy(record.claims);
  },
  revoke(handle) {return handles.delete(handle);}
 });
}
