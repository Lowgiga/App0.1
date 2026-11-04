import test from 'node:test';
import assert from 'node:assert/strict';
import { openAR, diagnoseARFailure, ARStartFailure, AREndFailure, ARStartLock, horizontalHit, freshSurface, surfaceOffset } from '../lib/ar-runtime.ts';
import { completeSpatialLevel, spatialProgress, spatialPrefix, spatialGraphDigest } from '../lib/spatial-learning.ts';
import { emptyWork, savedWorkContract } from '../lib/work-contract.ts';
import { buildSpaceGraph } from '../lib/space-model.ts';
import { missionContract } from '../lib/command-contract.ts';
import { workReferenceErrors } from '../lib/work-updates.ts';
import { encodeSnapshot, decodeSnapshot, mergeSnapshot } from '../lib/work-snapshots.ts';

const time = new Date('2026-10-01T00:00:00.000Z');
const matrix = [1,0,0,0,0,1,0,0,0,0,1,0,1,.8,-2,1];
const id = () => crypto.randomUUID();
function fixture() {
  const events: string[] = [], phases: string[] = [];
  class Session extends EventTarget {
    endCount = 0;
    async end() { this.endCount++; events.push('end'); this.dispatchEvent(new Event('end')); }
    async requestReferenceSpace() { events.push('viewer'); return {} as XRReferenceSpace; }
    async requestHitTestSource() { events.push('source'); return { cancel: () => events.push('cancel-source') } as XRHitTestSource; }
  }
  const session = new Session(), options = { xr: { requestSession: async (_mode: unknown, init: unknown) => { events.push('request'); options.init = init; return session as unknown as XRSession; } }, mode: 'surface' as const, overlay: {} as HTMLElement,
    cancelled: () => false, bind: async () => { events.push('bind'); }, phase: (p: string) => phases.push(p), init: null as unknown };
  return { session, options, events, phases };
}
test('surface AR explicitly requires hit-test and interactive DOM overlay', async () => {
  const f = fixture(), result = await openAR(f.options);
  assert.ok(result?.hitSource); assert.deepEqual((f.options.init as XRSessionInit).requiredFeatures, ['hit-test','dom-overlay']);
  assert.deepEqual(f.events, ['request','bind','viewer','source']); assert.deepEqual(f.phases, ['starting','tracking']);
});
test('free AR is an explicit mode and does not request or imply a plane hit', async () => {
  const f = fixture(), result = await openAR({ ...f.options, mode: 'free' });
  assert.equal(result?.hitSource, null); assert.deepEqual((f.options.init as XRSessionInit).requiredFeatures, ['dom-overlay']); assert.deepEqual(f.events, ['request','bind']);
});
test('permission failure preserves exact browser cause and session phase', async () => {
  const f = fixture(); f.options.xr.requestSession = async () => { throw new DOMException('Permission denied by browser', 'NotAllowedError'); };
  await assert.rejects(openAR(f.options), e => { const d = diagnoseARFailure(e, 'capability', time); assert.equal(d.name,'NotAllowedError'); assert.equal(d.message,'Permission denied by browser'); assert.equal(d.stage,'session'); assert.ok(d.hint.includes('nicht freigegeben')); return true; });
  assert.equal(f.session.endCount, 0);
});
test('unsupported table request never silently retries free AR', async () => {
  const f = fixture(); let calls=0; f.options.xr.requestSession = async () => { calls++; throw new DOMException('hit-test unavailable','NotSupportedError'); };
  await assert.rejects(openAR(f.options)); assert.equal(calls,1); assert.equal(f.session.endCount,0);
});
test('renderer binding failure ends its session and retains phase', async () => {
  const f = fixture(); f.options.bind = async () => { throw new Error('XR framebuffer unavailable'); };
  await assert.rejects(openAR(f.options), e => { const d=diagnoseARFailure(e);assert.equal(d.stage,'renderer'); assert.equal(d.message,'XR framebuffer unavailable');return true; }); assert.equal(f.session.endCount,1);
});
test('missing hit source ends session with an actionable diagnosis', async () => {
  const f=fixture();f.session.requestHitTestSource=async()=>undefined as unknown as XRHitTestSource;
  await assert.rejects(openAR(f.options), e=>{ const d=diagnoseARFailure(e);assert.equal(d.stage,'hit-test');assert.equal(d.name,'NotSupportedError');return true;});assert.equal(f.session.endCount,1);
});
test('reference-space failure is correctly distinguished from renderer failure', async () => {
  const f=fixture(); f.session.requestReferenceSpace=async()=>{throw new DOMException('Viewer space rejected','NotSupportedError');};
  await assert.rejects(openAR(f.options), e=>{assert.equal(diagnoseARFailure(e).stage,'hit-test');return true;});assert.equal(f.session.endCount,1);
});
test('navigation while browser request is pending safely ends late session', async () => {
  const f=fixture();let gone=false,resolve!: (s: XRSession)=>void;f.options.cancelled=()=>gone;f.options.xr.requestSession=()=>new Promise(r=>{resolve=r;});
  const pending=openAR(f.options);gone=true;resolve(f.session as unknown as XRSession);assert.equal(await pending,null);assert.equal(f.session.endCount,1);assert.ok(!f.events.includes('bind'));
});
test('cancellation after source creation cancels source and ends session once', async () => {
  const f=fixture();let gone=false;f.options.cancelled=()=>gone; f.session.requestHitTestSource=async()=>{gone=true;return {cancel:()=>f.events.push('cancel-source')} as XRHitTestSource;};
  assert.equal(await openAR(f.options),null);assert.equal(f.session.endCount,1);assert.equal(f.events.filter(x=>x==='cancel-source').length,1);
});
test('session ending during binding is not bound again or declared tracked', async () => {
  const f=fixture();f.options.bind=async()=>{await f.session.end();};assert.equal(await openAR(f.options),null);assert.equal(f.session.endCount,1);assert.deepEqual(f.phases,['starting']);
});
test('deferred ended start retains lock until its own finally and cannot clear a later operation', async () => {
  const lock=new ARStartLock(),f=fixture(),a=lock.begin()!;let resolve!: (space: XRReferenceSpace)=>void;
  f.options.cancelled=()=>!lock.current(a);f.options.bind=async()=>{f.session.addEventListener('end',()=>lock.invalidate());};
  f.session.requestReferenceSpace=()=>new Promise(r=>{resolve=r;});
  const pending=openAR(f.options);await new Promise(r=>setTimeout(r,0));await f.session.end();
  assert.equal(lock.current(a),false);assert.equal(lock.busy,true);assert.equal(lock.begin(),null);
  resolve({} as XRReferenceSpace);assert.equal(await pending,null);assert.equal(lock.finish(a),true);
  const b=lock.begin()!;assert.notEqual(b,a);assert.equal(lock.current(b),true);assert.equal(lock.finish(a),false);assert.equal(lock.busy,true);assert.equal(lock.current(b),true);lock.finish(b);
});
test('failed end preserves owned session and both causes without a blind retry', async () => {
  const f=fixture();f.session.requestReferenceSpace=async()=>{throw new Error('viewer rejected');};f.session.end=async()=>{f.session.endCount++;throw new DOMException('end rejected','InvalidStateError');};
  await assert.rejects(openAR(f.options),e=>{assert.ok(e instanceof AREndFailure);assert.equal(e.session,f.session);const d=diagnoseARFailure(e);assert.equal(d.stage,'end');assert.equal(d.message,'end rejected');assert.equal(d.related?.stage,'hit-test');assert.equal(d.related?.message,'viewer rejected');return true;});assert.equal(f.session.endCount,1);
});
test('cancelled start whose end fails retains exit ownership rather than silently returning null', async () => {
  const f=fixture();f.options.cancelled=()=>true;f.session.end=async()=>{f.session.endCount++;throw new Error('end refused');};await assert.rejects(openAR(f.options),e=>e instanceof AREndFailure&&e.session===f.session as unknown as XRSession);assert.equal(f.session.endCount,1);
});
test('confirmed native end is accepted even if end promise later rejects', async () => {
  const f=fixture();f.options.bind=async()=>{throw new Error('bind failed');};f.session.end=async()=>{f.session.endCount++;f.session.dispatchEvent(new Event('end'));throw new Error('late rejection');};await assert.rejects(openAR(f.options),e=>e instanceof ARStartFailure&&!(e instanceof AREndFailure)&&e.stage==='renderer');assert.equal(f.session.endCount,1);
});
test('diagnoses bound technical errors and remove control characters', () => {
  const d=diagnoseARFailure(new ARStartFailure('end',new Error('x\n'+ 'y'.repeat(800))),'session',time);
  assert.equal(d.stage,'end');assert.equal(d.message.length,500);assert.ok(!d.message.includes('\n'));assert.equal(d.observedAt,time.toISOString());
});
test('surface filter accepts horizontal poses and rejects wall ceiling invalid matrix', () => {
  assert.ok(horizontalHit(matrix));const wall=[...matrix]; wall[4]=1;wall[5]=0;assert.equal(horizontalHit(wall),false);
  const ceiling=[...matrix];ceiling[5]=-1;assert.equal(horizontalHit(ceiling),false);
  assert.equal(horizontalHit([NaN,...matrix.slice(1)]),false);assert.equal(horizontalHit(matrix.slice(1)),false);
});
test('stale or lost-tracking hits cannot be placed', () => {
  assert.equal(freshSurface(null,1000,true),false);assert.equal(freshSurface(500,1000,true),true);assert.equal(freshSurface(499,1000,true),false);assert.equal(freshSurface(1001,1000,true),false);assert.equal(freshSurface(1000,1000,false),false);
});
test('surface scale preserves the chosen base point rather than recentering on viewer', () => {
  const pivot=[2,-3,1];for(const scale of [.05,.1,.2]){const p=surfaceOffset(matrix,pivot,scale);assert.ok(p.every((v,i)=>Math.abs(v+pivot[i]*scale-matrix[12+i])<1e-10));}
  assert.throws(()=>surfaceOffset(matrix,pivot,0));assert.throws(()=>surfaceOffset(matrix,[NaN,1,0],.1));
});
function orientation() { const work=emptyWork(),graph=buildSpaceGraph(work,[],true);return {graph,work:completeSpatialLevel(work,graph,{level:'orientation',nodeId:'agent:zimt',origin:'own',mode:'2d'},id(),id(),time)}; }
function relationship() {const f=orientation(),edge=f.graph.edges.find(e=>e.relation==='delegates')!;return {...f,work:completeSpatialLevel(f.work,f.graph,{level:'relationship',edgeId:edge.id,fromVisited:edge.from,nodeId:edge.to,meaning:edge.relation,mode:'2d'},id(),id(),time)};}
function perspective(mode: '2d'|'3d'='2d') {const f=relationship();return {...f,work:completeSpatialLevel(f.work,f.graph,{level:'perspective',nodeId:'agent:zimt',mode,realFrame:mode==='3d',focusedNodeId:mode==='3d'?'agent:zimt':null,cameraAnswer:'immersive-ar',reflection:'Eine 3D-Geometrie im Browser zeigt noch kein Kamerabild.'},id(),id(),time)};}
test('old quiz XP remains separate from new practice-level completion', () => {const work=emptyWork();work.learning={evidence:true,review:true};const p=spatialProgress(work);assert.equal(p.quizXP,40);assert.equal(p.completed,0);assert.equal(p.totalXP,40);});
test('orientation requires correct origin and a real 2D path', () => {
  const work=emptyWork(),graph=buildSpaceGraph(work,[],true),attempt={level:'orientation' as const,nodeId:'agent:zimt',origin:'plan' as const,mode:'2d' as const};
  assert.throws(()=>completeSpatialLevel(work,graph,attempt,id(),id()));assert.throws(()=>completeSpatialLevel(work,graph,{...attempt,origin:'own',mode:'3d'},id(),id()));assert.equal(spatialProgress(orientation().work).spatialXP,25);
});
test('duplicate level never gives more XP or writes over previous evidence', () => {const f=orientation(),before=JSON.stringify(f.work);assert.throws(()=>completeSpatialLevel(f.work,f.graph,{level:'orientation',nodeId:'agent:zimt',origin:'own',mode:'2d'},id(),id()));assert.equal(JSON.stringify(f.work),before);assert.equal(spatialProgress(f.work).spatialXP,25);});
test('relationship needs visited start target and actual meaning', () => {
  const f=orientation(),e=f.graph.edges.find(e=>e.relation==='delegates')!,a={level:'relationship' as const,nodeId:e.to,edgeId:e.id,fromVisited:e.from,meaning:e.relation,mode:'2d' as const};
  for(const change of [{fromVisited:''},{nodeId:e.from},{meaning:'integrates'},{mode:'3d' as const}])assert.throws(()=>completeSpatialLevel(f.work,f.graph,{...a,...change},id(),id()));assert.equal(spatialProgress(relationship().work).spatialXP,50);
});
test('3D practice refuses ready-less or unfocused scenes and false camera claims', () => {
  const f=relationship(),a={level:'perspective' as const,nodeId:'agent:zimt',mode:'3d' as const,realFrame:true,focusedNodeId:'agent:zimt',cameraAnswer:'immersive-ar',reflection:'Die App-Szene allein ist noch keine Kamera-AR-Sitzung.'};
  for(const change of [{realFrame:false},{focusedNodeId:null},{cameraAnswer:'browser-3d'},{reflection:'short'}])assert.throws(()=>completeSpatialLevel(f.work,f.graph,{...a,...change},id(),id()));assert.equal(spatialProgress(perspective('3d').work).records.get('perspective')?.path,'3d');
});
test('2D alternative reaches same learning objective without asserting renderer or AR', () => {const f=perspective();const p=spatialProgress(f.work);assert.equal(p.spatialXP,75);assert.equal(p.records.get('perspective')?.path,'2d');assert.ok(p.records.get('perspective')?.detail.includes('kein 3D- oder AR-Start behauptet'));});
test('transfer atomically creates an open task note and optional mission reference', () => {
  const f=perspective(),mission=missionContract.parse({id:id(),title:'Own target mission',goal:'Own spatial acceptance',scope:'Private app',project:'cue',owner:'manus',reviewer:'junior',stage:'Blocked',priority:'P1',output:'Actual test evidence',taskIds:[],roomId:null,sourceIds:[],evidence:'',reviewed:false,checkpoint:'',archived:false,createdAt:time.toISOString()});f.work.command.missions.push(mission);
  const noteId=id(),taskId=id(),before=JSON.stringify(f.work),next=completeSpatialLevel(f.work,f.graph,{level:'transfer',nodeId:'agent:zimt',reflection:'Den echten Kamera-Start und waagerechten Flächentreffer am Gerät dokumentieren.',owner:'codex',missionId:mission.id},noteId,taskId,time);
  assert.equal(JSON.stringify(f.work),before);assert.equal(next.tasks.at(-1)?.status,'Offen');assert.equal(next.tasks.at(-1)?.reviewed,false);assert.equal(next.command.missions[0].stage,'Blocked');assert.deepEqual(next.command.missions[0].taskIds,[taskId]);assert.equal(spatialProgress(next).spatialXP,100);assert.deepEqual(workReferenceErrors(savedWorkContract.parse(next),[]),[]);
});
test('capacity and ambiguous IDs cannot leave a partial transfer task', () => {
  const f=perspective(),a={level:'transfer' as const,nodeId:'agent:zimt',reflection:'Die echte AR-Geräteabnahme mit Belegen und Grenzen durchführen.',owner:'codex' as const,missionId:''};
  const same=id();assert.throws(()=>completeSpatialLevel(f.work,f.graph,a,same,same));assert.throws(()=>completeSpatialLevel(f.work,f.graph,a,f.work.notes[0].id,id()));
  f.work.tasks=Array.from({length:60},(_,i)=>({...f.work.tasks[0],id:'full-'+i}));const before=JSON.stringify(f.work);assert.throws(()=>completeSpatialLevel(f.work,f.graph,a,id(),id()));assert.equal(JSON.stringify(f.work),before);
});
test('transfer rejects missing missions and an over-budget task description', () => {
  const f=perspective(),a={level:'transfer' as const,nodeId:'agent:zimt',reflection:'Ein konkreter Prüfauftrag mit verifizierbaren Ergebnissen.',owner:'codex' as const,missionId:id()};assert.throws(()=>completeSpatialLevel(f.work,f.graph,a,id(),id()));assert.throws(()=>completeSpatialLevel(f.work,f.graph,{...a,missionId:'',reflection:'x'.repeat(901)},id(),id()));
  assert.ok(savedWorkContract.safeParse(completeSpatialLevel(f.work,f.graph,{...a,missionId:'',reflection:'x'.repeat(900)},id(),id(),time)).success);
});
test('malformed future and orphaned records do not count as a level', () => {
  const f=orientation();f.work.notes.push({id:id(),text:spatialPrefix+'{"version":20}',createdAt:time.toISOString()});const r=JSON.parse(f.work.notes[0].text.slice(spatialPrefix.length));f.work.notes.push({id:id(),text:spatialPrefix+JSON.stringify({...r,level:'transfer',path:'transfer',taskId:id()}),createdAt:time.toISOString()});
  const p=spatialProgress(f.work);assert.equal(p.completed,1);assert.equal(p.invalidRecords,2);assert.equal(p.spatialXP,25);
});
test('snapshot round trip preserves personal level notes without overwriting original quizzes', () => {
  const f=perspective();f.work.learning.evidence=true;const snapshot=decodeSnapshot(encodeSnapshot(f.work,[]));const result=mergeSnapshot(emptyWork(),snapshot,[]);
  assert.equal(spatialProgress(result).completed,3);assert.equal(result.learning.evidence,true);assert.deepEqual(workReferenceErrors(result,[]),[]);assert.equal(spatialGraphDigest(f.graph).length,64);
});
