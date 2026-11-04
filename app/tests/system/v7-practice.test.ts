import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import{emptyWork,savedWorkContract}from '../../upstream/lib/work-contract.ts';
import{buildSpaceGraph,visibleSpaceGraph}from '../../overlay/lib/space-model.ts';
import{buildLearningLevels}from '../../overlay/lib/learning-levels.ts';
import{completeSpatialLevel,spatialProgress}from '../../overlay/lib/spatial-learning.ts';
import{createBackupAdapter,SOURCE_REVISION}from '../../src/backup-adapter.ts';import{defaultSystemState}from '../../src/system-state.ts';
const id=()=>crypto.randomUUID(),at=new Date('2026-10-01T00:00:00Z');
test('five derived Academy nodes and four practice levels coexist on the actual shared graph without extra XP',async()=>{
 let work=emptyWork();work.learning={evidence:true,review:true,handoff:true,baseline:true,automation:true};const graph=buildSpaceGraph(work,[],true);assert.equal(visibleSpaceGraph(graph,'learning','lesson:evidence',false).nodes.length,5);const before=JSON.stringify(work);
 work=completeSpatialLevel(work,graph,{level:'orientation',nodeId:'lesson:evidence',origin:'own',mode:'2d'},id(),id(),at);assert.notEqual(JSON.stringify(work),before);
 const edge=graph.edges.find(e=>e.relation==='recommended-before')!;work=completeSpatialLevel(work,graph,{level:'relationship',nodeId:edge.to,fromVisited:edge.from,edgeId:edge.id,meaning:edge.relation,mode:'2d'},id(),id(),at);
 work=completeSpatialLevel(work,graph,{level:'perspective',nodeId:'lesson:evidence',mode:'2d',realFrame:false,focusedNodeId:null,cameraAnswer:'immersive-ar',reflection:'In der 2D-Alternative wird kein Kamerabild und kein echtes 3D behauptet.'},id(),id(),at);
 work=completeSpatialLevel(work,graph,{level:'transfer',nodeId:'lesson:evidence',reflection:'Das konkrete Verhalten auf einem benannten Gerät prüfen und Grenzen dokumentieren.',owner:'codex',missionId:''},id(),id(),at);
 const p=spatialProgress(work);assert.equal(p.completed,4);assert.equal(p.spatialXP,100);assert.equal(p.quizXP,100);assert.equal(p.totalXP,200);assert.equal(buildLearningLevels(work,true).length,5);assert.equal(work.tasks.at(-1)!.status,'Offen');assert.equal(work.tasks.at(-1)!.reviewed,false);assert.ok(savedWorkContract.safeParse(work).success);
 const data=JSON.parse(fs.readFileSync(new URL('../../upstream/lib/mesh-data.json',import.meta.url),'utf8')),backup=createBackupAdapter(data),prefs=defaultSystemState(),exported=await backup.export(work,prefs,at.toISOString()),preview=await backup.preview(exported,work,prefs);assert.equal(preview.plan.targetState,'identical');assert.equal(preview.inspection.metadata.source.revision,SOURCE_REVISION);assert.equal(spatialProgress(preview.inspection.snapshot.work).totalXP,200);assert.deepEqual(preview.inspection.snapshot.work,work);
});
