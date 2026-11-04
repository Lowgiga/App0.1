import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptNativeSelection,buildNativeSnapshot,createNativeARService} from '../../src/platform/native-ar.ts';
import {buildSpaceGraph} from '../../overlay/lib/space-model.ts';
import {emptyWork} from '../../upstream/lib/work-contract.ts';
const graph=buildSpaceGraph(emptyWork(),[],true), context={stateRevision:null,scope:'all',known:true};
const appearance={core:'#123456',shell:'#ABCDEF',orbit:'#778899',shape:'cube',size:'large',motion:'breathe'} as const;
const styled=()=>({...graph,nodes:graph.nodes.map(n=>({...n,appearance:{...appearance}}))});
const fixture=(version=2):any=>({version,snapshotRevision:'revision',title:'Fixture',nodes:[{id:'node',label:'Node',x:0,y:0,z:0,color:0x2468ac,...(version===2?{appearance:{...appearance}}:{})}],edges:[]});
function bridge(){let calls=0;return{get calls(){return calls},service:createNativeARService({native:true,getAvailability:async()=>({available:true,status:'supported-installed'}),open:async({snapshot})=>{calls++;return{status:'closed',placed:false,snapshotRevision:snapshot.snapshotRevision}}})}}
test('builder always emits v2 complete appearance and preserves all effective channels and enums',()=>{
 const s=buildNativeSnapshot(styled(),context).snapshot;
 assert.equal(s.version,2);for(const n of s.nodes)assert.deepEqual((n as any).appearance,appearance);
 const plain=buildNativeSnapshot(graph,context).snapshot;
 for(let i=0;i<plain.nodes.length;i++){const hex='#'+graph.nodes[i].color.toString(16).padStart(6,'0').toUpperCase();assert.deepEqual((plain.nodes[i] as any).appearance,{core:hex,shell:hex,orbit:hex,shape:'polyhedron',size:'normal',motion:'off'})}
});
test('v1 remains a real strict legacy contract and v2 requires complete appearance',async()=>{
 const b=bridge();await b.service.open(fixture(1));const s=fixture();await b.service.open(s);delete s.nodes[0].appearance;await assert.rejects(b.service.open(s),/Snapshot/);assert.equal(b.calls,2);
 const legacy=fixture(1);legacy.nodes[0].appearance=appearance;await assert.rejects(b.service.open(legacy),/Snapshot/);
 for(const version of [0,3,'2',null])await assert.rejects(b.service.open({...fixture(),version}),/Snapshot/);assert.equal(b.calls,2);
});
test('v2 rejects partial styles, unknown keys, coercion, unbounded colors and future enums before bridge',async()=>{
 const b=bridge();for(const key of Object.keys(appearance)){const s=fixture();delete s.nodes[0].appearance[key];await assert.rejects(b.service.open(s),/Snapshot/,key)}
 for(const [key,values] of Object.entries({core:['red','#fff','#1234567','123456',0,null],shell:['#gg0000',false],orbit:['#112233\n'],shape:['sphere','Cube',null],size:[1,'huge',null],motion:[true,'spin',null],unexpected:[true]}))for(const value of values){const s=fixture();s.nodes[0].appearance[key]=value;await assert.rejects(b.service.open(s),/Snapshot/,`${key}: ${String(value)}`)}
 for(const value of [null,[],true,'cube']){const s=fixture();s.nodes[0].appearance=value;await assert.rejects(b.service.open(s),/Snapshot/)}assert.equal(b.calls,0);
});
test('builder rejects malformed projected appearance instead of silently falling back',()=>{
 for(const value of [{...appearance,shape:'sphere'},{...appearance,core:'red'},null,{}]){const g=styled();(g.nodes[0] as any).appearance=value;assert.throws(()=>buildNativeSnapshot(g,context),/Snapshot|Erscheinung|Darstellung/)}
});
test('every appearance channel and policy invalidate old native selections without moving graph positions or edges',()=>{
 const before=buildNativeSnapshot(styled(),context).snapshot;
 const result={status:'closed' as const,placed:true,snapshotRevision:before.snapshotRevision,selectedNodeId:before.nodes[0].id};
 assert.equal(acceptNativeSelection(result,before),before.nodes[0].id);
 for(const [key,value] of Object.entries({core:'#111111',shell:'#222222',orbit:'#333333',shape:'polyhedron',size:'small',motion:'off'})){const g=styled();(g.nodes[0].appearance as any)[key]=value;const after=buildNativeSnapshot(g,context).snapshot;assert.notEqual(after.snapshotRevision,before.snapshotRevision,key);assert.equal(acceptNativeSelection(result,after),null);assert.deepEqual(after.nodes.map(({id,x,y,z})=>({id,x,y,z})),before.nodes.map(({id,x,y,z})=>({id,x,y,z})));assert.deepEqual(after.edges,before.edges)}
 const allowed=buildNativeSnapshot(styled(),{...context,motionAllowed:true}).snapshot;assert.equal(acceptNativeSelection(result,allowed),null);
});
