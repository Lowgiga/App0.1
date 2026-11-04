/** Original pure offline functions. Packages cannot replace or import handlers. */
const mode='offline-deterministic';
export const builtinTools=Object.freeze({
 'mission-check':Object.freeze({id:'core.mission.check',effect:'local-compute',authentication:'none',permissions:['compute:mission']}),
 'graph-explain':Object.freeze({id:'core.graph.explain',effect:'local-compute',authentication:'none',permissions:['compute:graph']}),
 'backup-plan':Object.freeze({id:'core.backup.plan',effect:'local-compute',authentication:'none',permissions:['compute:backup-plan']}),
 'source-status':Object.freeze({id:'core.source.status',effect:'local-compute',authentication:'none',permissions:['compute:source-status']})
});
const handlers=Object.freeze({
 'mission-check'({title,steps}) {
  const issues=[];if(!title.trim()) issues.push('Mission title is empty');if(!steps.length) issues.push('Mission has no steps');
  steps.forEach((s,i)=>{if(!s.title.trim()) issues.push(`Step ${i+1} has no title`);});
  return {mode,title,stepCount:steps.length,completedCount:steps.filter(s=>s.done).length,issues};
 },
 'graph-explain'({nodes,edges}) {
  const ids=new Set(nodes.map(n=>n.id));
  if(ids.size!==nodes.length) throw new Error('Duplicate graph node ids');
  const adjacency=nodes.map(n=>({id:n.id,label:n.label,
   outbound:edges.filter(e=>e.source===n.id).map(e=>e.target).sort(),
   inbound:edges.filter(e=>e.target===n.id).map(e=>e.source).sort()
  })).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  return {mode,nodeCount:nodes.length,edgeCount:edges.length,
   danglingEdges:edges.filter(e=>!ids.has(e.source)||!ids.has(e.target)).map(e=>({source:e.source,target:e.target})),adjacency};
 },
 'backup-plan'({name,location,hasChecksum,hasRestoreEvidence}) {
  return {mode,backup:name,verified:false,
   steps:[`Locate the declared backup at ${location}`,'Compare size and recorded checksum with the source inventory',
    'Restore a copy into an isolated test location','Open representative restored files and compare contents',
    'Record the test date, scope, failures and operator'],
   warnings:[...(!hasChecksum?['No checksum evidence supplied']:[]),
    ...(!hasRestoreEvidence?['No restore-test evidence supplied']:[]),
    'This is a plan only; no backup was read, changed, or restored']};
 },
 'source-status'({sources}) {
  return {mode,snapshotCount:sources.filter(s=>s.kind==='snapshot').length,
   liveClaimCount:sources.filter(s=>s.kind==='live-claim').length,
   unknownCount:sources.filter(s=>s.kind==='unknown').length,installedToolCount:null,
   statuses:sources.map(s=>({id:s.id,status:s.kind==='snapshot'?'snapshot-only':s.kind==='live-claim'?'unverified-live-claim':'unknown'}))};
 }
});
export function executeBuiltin(handler,input) {if(!Object.hasOwn(handlers,handler)) throw new Error('No offline executor');return handlers[handler](input);}
