import type { ComponentType } from 'react';
export const COMPONENT_TYPES = ['Group','Text','Status','Metric','TaskList','SourceList','GraphSlot','SkillSuggestionSlot','EventList'] as const;
export type ComponentKind = typeof COMPONENT_TYPES[number];
interface Common { id: string; actionRef?: string }
export type SurfaceComponent = (Common & {type:'Group';props:{layout:'stack'|'split'|'focus';focusId?:string};children:string[]}) | (Common & {type:'Text';props:{text:string}}) | (Common & {type:Exclude<ComponentKind,'Group'|'Text'>;props:{label:string};dataRef:string});
export interface SurfaceProposal { schema:'cue.command-mesh.surface/v1';catalogVersion:'cue.readonly/v1';sessionId:string;surfaceId:string;baseRevision:number;rootId:string;components:SurfaceComponent[] }
export type ActionTarget = {view:'tasks'|'sources'|'graph'|'skills'|'events';entityId?:string};
export type SuggestionTarget = {topic:'inspect-task'|'review-source'|'review-skill';entityId?:string};
export type ActionDefinition = {kind:'navigate';label:string;target:ActionTarget} | {kind:'suggest';label:string;target:SuggestionTarget};
export type ActionIntent = ({kind:'navigate';target:ActionTarget}|{kind:'suggest';target:SuggestionTarget}) & {sessionId:string;surfaceId:string;surfaceRevision:number;componentId:string;actionRef:string};
export interface Limits {maxBytes:number;maxComponents:number;maxDepth:number;maxJsonDepth:number;maxTextBytes:number;maxRows:number;minUpdateIntervalMs:number}
export interface Provenance {sourceLabel:string;runLabel?:string}
export interface SessionConfig {sessionId:string;surfaceId:string;provenance:Provenance;registeredComponents:ReadonlySet<ComponentKind>;actions:ReadonlyMap<string,ActionDefinition>;limits?:Partial<Limits>;now?:()=>number}
export interface SurfaceSnapshot {revision:number;proposal:SurfaceProposal|null;provenance:Provenance;error:string|null}
export interface Admission {ok:boolean;code?:string}
export interface ActionDeliveryState {revision:number;state:'pending'|'sent'|'error'|'stale'|'unavailable'}
export type IntentReceiver = (intent:ActionIntent)=>void|Promise<unknown>;
export interface SurfaceSession {subscribeActions:(listener:()=>void)=>()=>void;getActionState:(componentId:string)=>Readonly<ActionDeliveryState>|null;dispatchIntent:(componentId:string,revision:number,receiver:IntentReceiver)=>Promise<void>;submit:(raw:string)=>Admission;getSnapshot:()=>SurfaceSnapshot;subscribe:(listener:()=>void)=>()=>void;getIntent:(componentId:string,revision:number)=>ActionIntent|null;getAction:(ref:string)=>Readonly<ActionDefinition>|undefined;limits:Readonly<Limits>}
export interface Row {id:string;label:string;detail?:string}
export type ProjectionValue = {kind:'text'|'status';value:string}|{kind:'metric';value:number;unit?:string}|{kind:'tasks'|'sources'|'events';value:readonly Row[]}|{kind:'graph'|'skills';value:unknown};
export type DataProjection = ({state:'known'|'stale'} & ProjectionValue) | {state:'unknown';kind:ProjectionValue['kind']};
export interface HostSlotProps {value:unknown;state:'known'|'stale';componentId:string;surfaceRevision:number;reducedMotion:boolean}
export interface SurfaceProps {session:SurfaceSession;data:ReadonlyMap<string,DataProjection>;slots?:{Graph?:ComponentType<HostSlotProps>;Skills?:ComponentType<HostSlotProps>};onIntent?:IntentReceiver;reducedMotion?:boolean}
