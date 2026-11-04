import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWork} from '../../upstream/lib/work-contract.ts';
import {defaultAppearanceState,parseAppearanceState} from '../../src/appearance/contracts.ts';
import {appearanceBinding,resolveNodeAppearance,projectSpaceAppearance,sizeScale} from '../../src/appearance/projection.ts';
const id='4c212008-fec2-4489-b1ca-dc7026e2e2a9',createdAt='2026-10-05T12:00:00.000Z';
function fixture(){const work=emptyWork();work.rooms.push({id,title:'Ein Raum',agent:'zimt',project:'custom',mode:'DEEP',goal:'Ein Ziel',output:'Datei',sources:[],status:'Aktiv',messages:[],createdAt});return work}
const node={id:'room:'+id,entityId:id,kind:'room',color:0xb8c7ff};
test('appearance precedence is per-kind defaults then global then exact active incarnation',()=>{
 const work=fixture(),state=parseAppearanceState({...defaultAppearanceState(),global:{core:'#112233',size:'small'},overrides:[{binding:{kind:'room',id,createdAt},style:{orbit:'#445566',size:'large'}}]});
 assert.deepEqual(resolveNodeAppearance(node,work,state),{core:'#112233',shell:'#B8C7FF',orbit:'#445566',shape:'polyhedron',size:'large',motion:'off'});
 assert.equal(sizeScale('small'),0.8);assert.equal(sizeScale('normal'),1);assert.equal(sizeScale('large'),1.25);
 const styled={...node,color:0x112233};assert.equal(resolveNodeAppearance(styled,work,defaultAppearanceState()).core,'#B8C7FF');
});
test('only real canonical nonarchived room and mission identities bind; replacements cannot inherit old overrides',()=>{
 const work=fixture();assert.deepEqual(appearanceBinding(node,work),{kind:'room',id,createdAt});
 for(const invalid of [{...node,id:'room:other'},{...node,entityId:crypto.randomUUID()},{...node,kind:'task'},{...node,kind:'agent'}])assert.equal(appearanceBinding(invalid,work),null);
 const state=parseAppearanceState({...defaultAppearanceState(),overrides:[{binding:{kind:'room',id,createdAt},style:{shape:'cube'}}]});
 work.rooms[0].createdAt='2026-10-05T13:00:00.000Z';assert.equal(resolveNodeAppearance(node,work,state).shape,'polyhedron');
 work.rooms[0].status='Archiviert';assert.equal(appearanceBinding(node,work),null);work.rooms[0].status='Aktiv';work.rooms[0].createdAt='invalid';assert.equal(appearanceBinding(node,work),null);
 const mission={...node,id:'mission:'+id,kind:'mission'};work.command.missions.push({id,createdAt,archived:false} as any);assert.deepEqual(appearanceBinding(mission,work),{kind:'mission',id,createdAt});work.command.missions[0].archived=true;assert.equal(appearanceBinding(mission,work),null);
});
test('appearance projection preserves positions, edges, status, metadata and WorkState byte-for-byte',()=>{
 const work=fixture(),before=JSON.stringify(work),position=[1,2,3],edges=[{id:'edge',from:node.id,to:'agent:zimt'}],graph={nodes:[{...node,position,status:'Aktiv'}],edges,total:1};
 const projected=projectSpaceAppearance(graph,work,parseAppearanceState({...defaultAppearanceState(),global:{core:'#010203',motion:'breathe'}}));
 assert.equal(projected.nodes[0].color,0x010203);assert.equal(projected.nodes[0].appearance.motion,'breathe');assert.equal(projected.nodes[0].position,position);assert.equal(projected.edges,edges);assert.equal(projected.total,1);assert.equal(projected.nodes[0].status,'Aktiv');assert.equal(JSON.stringify(work),before);assert.equal(graph.nodes[0].color,0xb8c7ff);
 for(const [kind,color] of Object.entries({agent:'#C7EFA0',mission:'#8BDDD0',task:'#FFD092',room:'#B8C7FF',source:'#B3E8FF',system:'#CAB8F4',lesson:'#F3B4CF'}))assert.equal(resolveNodeAppearance({...node,kind},work,defaultAppearanceState()).core,color);
});

test('reset after projection restores every known kind including lessons without color drift',()=>{const work=fixture(),kinds=['agent','mission','task','room','source','system','lesson'],graph={nodes:kinds.map(kind=>({...node,kind}))},defaults=projectSpaceAppearance(graph,work,defaultAppearanceState()),preview=projectSpaceAppearance(defaults,work,parseAppearanceState({...defaultAppearanceState(),global:{core:'#112233'}}));assert.deepEqual(projectSpaceAppearance(preview,work,defaultAppearanceState()),defaults)});
