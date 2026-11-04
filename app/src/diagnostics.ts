import type {LocalErrorCode} from './local-errors.ts';

// Display ceilings are validation limits, not performance measurements.
export const MAX_DIAGNOSTIC_COUNT = 100_000;
const MAX_CATALOG_ROWS = 100;
const MAX_TIMESTAMP = 253402300799999; // Last millisecond of year 9999 (UTC).
const ERROR_CODES: readonly LocalErrorCode[] = ['VALIDATION','CONFLICT','CORRUPT_STORAGE','UNSUPPORTED_VERSION','STORAGE_UNAVAILABLE','QUOTA_EXCEEDED','UNSUPPORTED','TOO_LARGE'];
const BUILD = '0.5.3-prototype-20261005' as const;
const PROVIDERS = {make:'Make',github:'GitHub',slack:'Slack',zapier:'Zapier',notion:'Notion',hermes:'Hermes'} as const;
export type Provider = keyof typeof PROVIDERS;
export type EvidenceResult = 'confirmed' | 'failed' | 'revoked' | 'unknown';
export type Freshness = 'current' | 'historical' | 'stale' | 'offline' | 'unknown';
export type EvidenceDimension = 'saved' | 'reachable' | 'authenticated' | 'actionTested';
export type ConnectionObservation = Readonly<{result:EvidenceResult;at:number;origin:'session-check'|'historical-snapshot'}>;
export type ConnectionPolicy = Readonly<{now:number;maxAgeMs:number|null;offline:boolean}>;
export type EvidenceView = Readonly<{current:EvidenceResult;recorded:EvidenceResult;freshness:Freshness;checkedAt:string|null}>;
export type ConnectionView = Readonly<Record<EvidenceDimension,EvidenceView> & {authority:'not-evaluated';lastConfirmedCheckAt:string|null}>;
export type LocalState = 'ready' | 'loading' | 'blocked' | 'unknown';
export type DiagnosticsView = Readonly<{
 schema:'local-diagnostics/v1';buildVersion:typeof BUILD;mode:'local-only';workSchema:4|'unknown';systemSchema:'cue.system-state/v1'|'unknown';
 workState:LocalState;preferencesState:LocalState;errorClass:LocalErrorCode|'UNKNOWN'|'none';
 counts:Readonly<{tasks:number|null;notes:number|null;rooms:number|null;sources:number|null}>;
 capabilities:Readonly<{localProjection:true;networkProbes:false;telemetry:false;credentialStorage:false;fullRestore:false}>;
 workflow:Readonly<{currentRun:'unknown';historyCount:number|null;historyIsLiveEvidence:false}>;
 lastConfirmedCheckAt:null;export:'not-implemented';
}>;

// Never spread/stringify input. Only own data properties are examined; arbitrary
// strings, nested payloads, errors, accessors and inherited values stay outside.
function own(value:unknown,key:string):unknown {
 if(value===null || typeof value!=='object')return undefined;
 try {const descriptor=Object.getOwnPropertyDescriptor(value,key);return descriptor && 'value' in descriptor ? descriptor.value : undefined}
 catch {return undefined}
}
function count(value:unknown,limit=MAX_DIAGNOSTIC_COUNT):number|null {
 return typeof value==='number' && Number.isSafeInteger(value) && value>=0 && value<=limit ? value : null;
}
function timestamp(value:unknown):number|null {return count(value,MAX_TIMESTAMP)}
function errorClass(value:unknown):DiagnosticsView['errorClass'] {
 if(value===null || value===undefined)return 'none';
 const code=own(value,'code');
 return typeof code==='string' && (ERROR_CODES as readonly string[]).includes(code) ? code as LocalErrorCode : 'UNKNOWN';
}
export function projectDiagnostics(input:unknown):DiagnosticsView {
 const counts=own(input,'counts');
 const storageError=own(input,'storageError'),loaded=own(input,'hasLoaded'),loading=own(input,'loadingWork');
 const preferencesFailed=own(input,'preferencesFailed'),preferencesReady=own(input,'preferencesReady');
 return {
  schema:'local-diagnostics/v1',buildVersion:BUILD,mode:'local-only',
  workSchema:own(input,'workSchema')===4?4:'unknown',systemSchema:own(input,'systemSchema')==='cue.system-state/v1'?'cue.system-state/v1':'unknown',
  workState:storageError===true?'blocked':loading===true?'loading':loaded===true&&loading===false&&storageError===false?'ready':'unknown',
  preferencesState:preferencesFailed===true?'blocked':preferencesReady===true&&preferencesFailed===false?'ready':preferencesReady===false&&preferencesFailed===false?'loading':'unknown',
  errorClass:errorClass(own(input,'error') ?? (storageError===true||preferencesFailed===true ? {} : null)),
  counts:{tasks:count(own(counts,'tasks')),notes:count(own(counts,'notes')),rooms:count(own(counts,'rooms')),sources:count(own(counts,'sources'))},
  capabilities:{localProjection:true,networkProbes:false,telemetry:false,credentialStorage:false,fullRestore:false},
  workflow:{currentRun:'unknown',historyCount:count(own(input,'historyCount'),20),historyIsLiveEvidence:false},
  // Existing hooks expose no confirmed read-check timestamp or live host.
  // work.updatedAt/history.at are not substituted for either missing signal.
  lastConfirmedCheckAt:null,export:'not-implemented'
 };
}

const unknownEvidence=():EvidenceView=>({current:'unknown',recorded:'unknown',freshness:'unknown',checkedAt:null});
function projectObservation(input:unknown,policy:unknown,dimension:EvidenceDimension):EvidenceView {
 const result=own(input,'result'),origin=own(input,'origin');
 if(!['confirmed','failed','revoked'].includes(typeof result==='string'?result:''))return unknownEvidence();
 if(origin!=='session-check'&&origin!=='historical-snapshot')return unknownEvidence();
 const at=timestamp(own(input,'at')),now=timestamp(own(policy,'now'));
 if(at===null || now===null || at>now)return unknownEvidence();
 const recorded=result as EvidenceResult,checkedAt=new Date(at).toISOString();
 if(origin==='historical-snapshot')return {current:'unknown',recorded,freshness:'historical',checkedAt};
 const maxAgeMs=count(own(policy,'maxAgeMs'),MAX_TIMESTAMP);
 if(maxAgeMs===null)return {current:'unknown',recorded,freshness:'unknown',checkedAt};
 if(now-at>maxAgeMs)return {current:'unknown',recorded,freshness:'stale',checkedAt};
 if(dimension!=='saved'&&own(policy,'offline')===true)return {current:'unknown',recorded,freshness:'offline',checkedAt};
 // Absent/invalid offline signals do not attest a current network condition.
 if(dimension!=='saved'&&own(policy,'offline')!==false)return {current:'unknown',recorded,freshness:'unknown',checkedAt};
 return {current:recorded,recorded,freshness:'current',checkedAt};
}
/** Caller supplies the latest observation per dimension, never a catalog claim.
 * Only a real future in-session checker may use origin=session-check. This is a
 * display projection, not a verifier, provider client or authorization decision.
 * Freshness has no default: caller must explicitly choose maxAgeMs.
 */
export function projectConnection(input:unknown,policy:unknown):ConnectionView {
 const saved=projectObservation(own(input,'saved'),policy,'saved');
 const reachable=projectObservation(own(input,'reachable'),policy,'reachable');
 const authenticated=projectObservation(own(input,'authenticated'),policy,'authenticated');
 const actionTested=projectObservation(own(input,'actionTested'),policy,'actionTested');
 const checks=[saved,reachable,authenticated,actionTested].filter(value=>value.recorded==='confirmed'&&value.freshness!=='historical'&&value.checkedAt!==null);
 return {saved,reachable,authenticated,actionTested,authority:'not-evaluated',lastConfirmedCheckAt:checks.map(value=>value.checkedAt!).sort().at(-1)??null};
}
export type CatalogConnection = Readonly<{provider:Provider;label:string;provenance:'historical-snapshot'|'missing';evidence:ConnectionView}>;
export function projectCatalogConnections(input:unknown):CatalogConnection[] {
 const present=new Set<Provider>();
 // Bounded work even when a corrupted array claims billions of rows.
 if(Array.isArray(input))for(let i=0;i<Math.min(input.length,MAX_CATALOG_ROWS);i++){
  const id=own(own(input,String(i)),'id');
  if(typeof id==='string'&&Object.hasOwn(PROVIDERS,id))present.add(id as Provider);
 }
 return (Object.keys(PROVIDERS) as Provider[]).map(provider=>({provider,label:PROVIDERS[provider],provenance:present.has(provider)?'historical-snapshot':'missing',evidence:projectConnection(null,null)}));
}

/** Adapter for current state contracts: derive scalar metadata without passing
 * raw work, history outputs, catalog text or error strings to the view. */
export function diagnosticsFromLoadedState(input:unknown):DiagnosticsView {
 const work=own(input,'work'),system=own(input,'system'),data=own(input,'data'),loaded=own(input,'hasLoaded')===true;
 const arrayCount=(value:unknown)=>Array.isArray(value)?count(value.length):null;
 const preferencesReady=own(input,'preferencesReady')===true;
 return projectDiagnostics({
  hasLoaded:own(input,'hasLoaded'),loadingWork:own(input,'loadingWork'),storageError:own(input,'storageError'),
  preferencesReady:own(input,'preferencesReady'),preferencesFailed:own(input,'preferencesFailed'),
  error:own(input,'error'),workSchema:loaded?own(work,'stateVersion'):undefined,systemSchema:preferencesReady?own(system,'schema'):undefined,
  counts:{tasks:loaded?arrayCount(own(work,'tasks')):null,notes:loaded?arrayCount(own(work,'notes')):null,rooms:loaded?arrayCount(own(work,'rooms')):null,sources:arrayCount(own(data,'sources'))},
  historyCount:preferencesReady?arrayCount(own(system,'history')):null
 });
}
