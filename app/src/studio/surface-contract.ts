import type {WorkState} from '../../upstream/lib/work-contract.ts';
import {createSurfaceSession,COMPONENT_TYPES,type SurfaceSession,type SurfaceProposal,type DataProjection,type ActionIntent} from '../../vendor/adaptive-surfaces/src/index.ts';
import {adaptWorkState,type SourceRecord} from '../../vendor/mesh-extensions/src/model.ts';
import type {SystemState} from '../system-state.ts';
export function studioProposal(layout:SystemState['surfaceLayout'],baseRevision:number):SurfaceProposal{return{schema:'cue.command-mesh.surface/v1',catalogVersion:'cue.readonly/v1',sessionId:'studio',surfaceId:'workspace',baseRevision,rootId:'root',components:[
 {id:'root',type:'Group',props:{layout,...(layout==='focus'?{focusId:'graph'}:{})},children:['status','tasks','sources','graph','skills','events']},
 {id:'status',type:'Status',props:{label:'Gespeicherter Arbeitsstand'},dataRef:'work_status'},
 {id:'tasks',type:'TaskList',props:{label:'Aktive Aufgaben'},dataRef:'work_tasks',actionRef:'open_tasks'},
 {id:'sources',type:'SourceList',props:{label:'Datierte Quellen'},dataRef:'work_sources',actionRef:'open_sources'},
 {id:'graph',type:'GraphSlot',props:{label:'Arbeitsgraph aus demselben Zustand'},dataRef:'work_graph',actionRef:'open_graph'},
 {id:'skills',type:'SkillSuggestionSlot',props:{label:'Lokale Fähigkeiten und Ergebnisstand'},dataRef:'work_skills',actionRef:'open_skills'},
 {id:'events',type:'EventList',props:{label:'Erhaltene App-Ereignisse'},dataRef:'work_events',actionRef:'open_events'}
]}}
export function createStudioSurface(layout:SystemState['surfaceLayout']):SurfaceSession{const session=createSurfaceSession({sessionId:'studio',surfaceId:'workspace',provenance:{sourceLabel:'Lokale geprüfte Studio-Vorlage',runLabel:'Interne Schema-Version 1 · keine externe Berechtigung'},registeredComponents:new Set(COMPONENT_TYPES),limits:{minUpdateIntervalMs:0},actions:new Map((['tasks','sources','graph','skills','events'] as const).map(view=>['open_'+view,{kind:'navigate' as const,label:{tasks:'Aufgabenmatrix',sources:'Evidenzbereich',graph:'Graph Explorer',skills:'Skillprüfung',events:'Aktivität'}[view],target:{view}}]))});const result=session.submit(JSON.stringify(studioProposal(layout,0)));if(!result.ok)throw new Error('Studio-Vorlage ungültig');return session}
export function surfaceProjections(work:WorkState|null,sources:SourceRecord[],system:SystemState,stale=false):ReadonlyMap<string,DataProjection>{
 const state=stale?'stale':'known';if(!work)return new Map([['work_status',{state:'unknown',kind:'status'}],['work_tasks',{state:'unknown',kind:'tasks'}],['work_sources',{state:'unknown',kind:'sources'}],['work_graph',{state:'unknown',kind:'graph'}],['work_skills',{state:'unknown',kind:'skills'}],['work_events',{state:'unknown',kind:'events'}]]);
 return new Map<string,DataProjection>([
 ['work_status',{kind:'status',state,value:work.updatedAt?'Lokal gespeichert: '+work.updatedAt:'Mitgelieferter Beispiel-/Anfangsstand, noch nicht lokal geändert'}],
 ['work_tasks',{kind:'tasks',state,value:work.tasks.filter(t=>!t.archived).map(t=>({id:t.id,label:t.title,detail:t.status+' · '+t.owner}))}],
 ['work_sources',{kind:'sources',state,value:sources.slice(0,200).map(s=>({id:s.id,label:s.title,detail:s.status+' · Snapshot'}))}],
 ['work_graph',{kind:'graph',state,value:adaptWorkState(work,sources)}],
 ['work_skills',{kind:'skills',state,value:{history:system.history,policy:'historical-only-no-resume'}}],
 ['work_events',{kind:'events',state,value:work.command.events.slice(-200).reverse().map(e=>({id:e.id,label:e.title,detail:'#'+e.sequence+' · '+e.at}))}]
 ]);
}
export function actionDestination(intent:ActionIntent):'matrix'|'evidence'|'graph'|'skills'|'activity' {if(intent.kind!=='navigate')throw new Error('Nicht unterstützter Intent');return{tasks:'matrix' as const,sources:'evidence' as const,graph:'graph' as const,skills:'skills' as const,events:'activity' as const}[intent.target.view]}
