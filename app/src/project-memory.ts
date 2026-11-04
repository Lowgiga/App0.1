import {z} from 'zod';
import type {WorkState,MeshRoom} from '../upstream/lib/work-contract.ts';
import {createId} from '../upstream/lib/ids.ts';
import {LocalStateError} from './local-errors.ts';

export const MEMORY_KEY='project-memory-v1';
export const MEMORY_BYTES=1_750_000;
const uuid=z.string().uuid(),date=z.string().datetime(),revision=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const memoryKinds=['goal','decision','rejectedApproach','openQuestion','nextStep'] as const;
const kind=z.enum(memoryKinds),status=z.enum(['proposed','external-claim','confirmed','superseded','forgotten']);
const credentialPattern=/(?:authorization\s*:\s*bearer|\b(?:password|passwd|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|cookie)\s*[:=]|-----BEGIN (?:[A-Z ]*PRIVATE KEY)|\b(?:sk-|ghp_|github_pat_)[a-zA-Z0-9_-]{12,})/i;
const text=z.string().trim().min(1).max(2000).refine(s=>!credentialPattern.test(s),'Zugangsdaten gehören nicht ins Projektgedächtnis.');
const origin=z.object({kind:z.enum(['manual','proposal','external-claim']),sourceId:z.string().max(80).nullable(),workRevision:date.nullable()}).strict();
const history=z.object({revision:z.number().int().min(1),at:date,action:z.enum(['created','corrected','confirmed','superseded','forgotten','restored']),status,text}).strict();
const entry=z.object({id:uuid,kind,status,text,origin,replaces:uuid.nullable(),revision:z.number().int().min(1),history:z.array(history).min(1)}).strict().superRefine((value,ctx)=>{
 const last=value.history.at(-1)!;
 if(value.revision!==value.history.length||last.revision!==value.revision||last.status!==value.status||last.text!==value.text||value.history.some((h,i)=>h.revision!==i+1||i>0&&Date.parse(h.at)<Date.parse(value.history[i-1].at)))ctx.addIssue({code:'custom',message:'Ungültiger Revisionsverlauf.'});
 if((value.origin.kind==='external-claim')!==!!value.origin.sourceId)ctx.addIssue({code:'custom',message:'Ungültige Herkunft.'});
 for(const [i,h] of value.history.entries()){
  const previous=value.history[i-1];
  const valid=!previous?h.action==='created'&&h.status===(value.origin.kind==='external-claim'?'external-claim':'proposed'):
   h.action==='corrected'?['proposed','external-claim'].includes(previous.status)&&h.status==='proposed':
   h.text!==previous.text?false:
   h.action==='confirmed'?['proposed','external-claim'].includes(previous.status)&&h.status==='confirmed':
   h.action==='superseded'?previous.status==='confirmed'&&h.status==='superseded':
   h.action==='forgotten'?previous.status!=='forgotten'&&h.status==='forgotten':
   h.action==='restored'?previous.status==='forgotten'&&h.status==='proposed':false;
  if(!valid)ctx.addIssue({code:'custom',message:'Ungültiger Entscheidungsübergang.'});
 }
});
export const projectMemoryContract=z.object({schema:z.literal('lowquantflow.project-memory/v1'),contextId:uuid,contextCreatedAt:date,revision,updatedAt:date.nullable(),entries:z.array(entry).max(100)}).strict().superRefine((value,ctx)=>{
 const ids=new Set(value.entries.map(e=>e.id));
 if(ids.size!==value.entries.length||(value.revision===0)!==(value.updatedAt===null)||value.revision===0&&value.entries.length>0)ctx.addIssue({code:'custom',message:'Ungültiger Gedächtnisstand.'});
 for(const e of value.entries)if(e.replaces&&(e.replaces===e.id||!ids.has(e.replaces)))ctx.addIssue({code:'custom',message:'Ungültige Ablösereferenz.'});
 for(const k of ['goal','nextStep'])if(value.entries.filter(e=>e.kind===k&&e.status==='confirmed').length>1)ctx.addIssue({code:'custom',message:'Widersprüchlicher bestätigter Einzelwert.'});
 const byId=new Map(value.entries.map(e=>[e.id,e])),confirmedRoots=new Set<string>();
 for(const e of value.entries){
  if(e.revision>value.revision||!value.updatedAt||Date.parse(e.history.at(-1)!.at)>Date.parse(value.updatedAt))ctx.addIssue({code:'custom',message:'Ereignis ist neuer als die Projektgedächtnisrevision.'});
  let pointer=e;const visited=new Set([e.id]);
  while(pointer.replaces){const parent=byId.get(pointer.replaces);if(!parent)break;if(visited.has(parent.id)){ctx.addIssue({code:'custom',message:'Zyklische Ablösereferenz.'});break}if(parent.kind!==e.kind)ctx.addIssue({code:'custom',message:'Ablösung gehört zu einer anderen Eintragsart.'});visited.add(parent.id);pointer=parent}
  if(e.status==='confirmed'){if(confirmedRoots.has(pointer.id))ctx.addIssue({code:'custom',message:'Mehrere bestätigte Entscheidungen in derselben Ablöselinie.'});confirmedRoots.add(pointer.id)}
 }
});
export const projectMemoryBackupContract=z.object({schema:z.literal('lowquantflow.project-memory-backup/v1'),records:z.array(projectMemoryContract).max(100)}).strict().superRefine((value,ctx)=>{
 if(new Set(value.records.map(r=>r.contextId+'@'+r.contextCreatedAt)).size!==value.records.length)ctx.addIssue({code:'custom',message:'Doppelter Projektkontext.'});
 if(new TextEncoder().encode(JSON.stringify(value)).length>MEMORY_BYTES)ctx.addIssue({code:'custom',message:'Projektgedächtnis überschreitet 1.750.000 UTF-8-Byte.'});
});
export type ProjectMemory=z.infer<typeof projectMemoryContract>;
export type MemoryEntry=ProjectMemory['entries'][number];
export type ProjectMemoryBackup=z.infer<typeof projectMemoryBackupContract>;
const context={contextId:uuid};
const expected={...context,expectedRevision:revision,expectedWorkUpdatedAt:date.nullable()};
export const memoryRequestContract=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('read'),...context}).strict(),
 z.object({operation:z.literal('search'),...context,query:z.string().max(200)}).strict(),
 z.object({operation:z.literal('export'),...context}).strict(),
 z.object({operation:z.literal('propose'),...expected,kind,text,origin:origin.shape.kind,sourceId:z.string().max(80).nullable().optional()}).strict(),
 z.object({operation:z.literal('correct'),...expected,entryId:uuid,text}).strict(),
 z.object({operation:z.literal('confirm'),...expected,entryId:uuid,replaceConfirmed:z.boolean().optional()}).strict(),
 z.object({operation:z.literal('forget'),...expected,entryId:uuid}).strict(),
 z.object({operation:z.literal('restore'),...expected,entryId:uuid}).strict()
]);
export type MemoryRequest=z.infer<typeof memoryRequestContract>;
export const memoryBackupRequestContract=z.object({expectedWorkUpdatedAt:date.nullable()}).strict();
const invalid=()=>new LocalStateError('VALIDATION','Gedächtniseingabe ungültig. Kontext, Grenzen und Herkunft prüfen; keine Zugangsdaten eintragen.',400);
const conflict=(message:string)=>new LocalStateError('CONFLICT',message,409);
export function parseMemoryRequest(input:unknown):MemoryRequest{const parsed=memoryRequestContract.safeParse(input);if(!parsed.success)throw invalid();return parsed.data}
export function decodeProjectMemory(value:unknown):ProjectMemoryBackup{
 if(value===undefined)return {schema:'lowquantflow.project-memory-backup/v1',records:[]};
 if(value&&typeof value==='object'&&'schema' in value&&value.schema!=='lowquantflow.project-memory-backup/v1')throw new LocalStateError('UNSUPPORTED_VERSION','Neuere Projektgedächtnis-Version. Daten bleiben erhalten.');
 const parsed=projectMemoryBackupContract.safeParse(value);if(!parsed.success)throw new LocalStateError('CORRUPT_STORAGE','Projektgedächtnis beschädigt. Kein Zurücksetzen oder Überschreiben.');return parsed.data;
}
export function projectContext(work:WorkState,id:string):MeshRoom{const room=work.rooms.find(r=>r.id===id);if(!room)throw invalid();return room}
export function memoryForContext(backup:ProjectMemoryBackup,room:MeshRoom):ProjectMemory{return backup.records.find(r=>r.contextId===room.id&&r.contextCreatedAt===room.createdAt)??{schema:'lowquantflow.project-memory/v1',contextId:room.id,contextCreatedAt:room.createdAt,revision:0,updatedAt:null,entries:[]}}
export function projectMemoryExport(memory:ProjectMemory){
 // Deliberately no room title, source URL, arbitrary metadata, history or forgotten content.
 return {schema:'lowquantflow.project-memory-export/v1',contextId:memory.contextId,contextCreatedAt:memory.contextCreatedAt,revision:memory.revision,updatedAt:memory.updatedAt,policy:{decisions:'historical-only',externalActions:'not-authorized',restoreAvailable:false},entries:memory.entries.filter(e=>e.status!=='forgotten'&&e.status!=='superseded').map(e=>({id:e.id,kind:e.kind,status:e.status,text:e.text,revision:e.revision,origin:{kind:e.origin.kind,sourceId:e.origin.sourceId,workRevision:e.origin.workRevision}}))};
}
export function applyProjectMemory(backup:ProjectMemoryBackup,work:WorkState,input:MemoryRequest,now:Date):ProjectMemoryBackup{
 if(!('expectedRevision' in input))throw invalid();
 if(work.updatedAt!==input.expectedWorkUpdatedAt)throw conflict('Arbeitsstand hat sich geändert. Entwurf sichern und Stand neu laden.');
 const room=projectContext(work,input.contextId),old=memoryForContext(backup,room);
 if(old.revision!==input.expectedRevision)throw conflict('Projektgedächtnis wurde inzwischen geändert. Entwurf sichern und Stand neu laden.');
 if(room.status==='Archiviert')throw invalid();
 const next=structuredClone(old),wall=now.getTime();if(!Number.isFinite(wall))throw new LocalStateError('STORAGE_UNAVAILABLE','Ungültige Gerätezeit. Nichts gespeichert.');
 const at=new Date(Math.max(wall,old.updatedAt?Date.parse(old.updatedAt)+1:0)).toISOString();
 function record(e:MemoryEntry,action:z.infer<typeof history>['action'],newStatus:MemoryEntry['status'],newText=e.text){e.revision++;e.status=newStatus;e.text=newText;e.history.push({revision:e.revision,at,action,status:newStatus,text:newText})}
 function add(k:MemoryEntry['kind'],content:string,source:MemoryEntry['origin'],replaces:string|null=null){const s=source.kind==='external-claim'?'external-claim':'proposed';const e:MemoryEntry={id:createId(),kind:k,status:s,text:content,origin:source,replaces,revision:1,history:[{revision:1,at,action:'created',status:s,text:content}]};next.entries.push(e);return e}
 if(input.operation==='propose'){
  if(input.origin==='external-claim'?!input.sourceId||!room.sources.includes(input.sourceId):!!input.sourceId)throw invalid();
  add(input.kind,input.text,{kind:input.origin,sourceId:input.sourceId??null,workRevision:work.updatedAt});
 }else{
  const e=next.entries.find(e=>e.id===input.entryId);if(!e)throw invalid();
  if(input.operation==='correct'){
   if(e.status==='forgotten'||e.status==='superseded')throw invalid();
   if(e.status==='confirmed')add(e.kind,input.text,{kind:'manual',sourceId:null,workRevision:work.updatedAt},e.id);
   else record(e,'corrected','proposed',input.text);
  }else if(input.operation==='confirm'){
   if(e.status!=='proposed'&&e.status!=='external-claim')throw conflict('Eintrag ist nicht mehr ein bestätigbarer Vorschlag.');
   const ancestors=(item:MemoryEntry)=>{const ids=new Set<string>();let pointer:MemoryEntry|undefined=item;while(pointer&&!ids.has(pointer.id)){ids.add(pointer.id);pointer=next.entries.find(p=>p.id===pointer!.replaces)}return ids};
   const line=ancestors(e),confirmed=next.entries.filter(p=>p.id!==e.id&&p.status==='confirmed'&&[...ancestors(p)].some(id=>line.has(id)));
   if(confirmed.length){const previous=confirmed[0];if(confirmed.length!==1||previous.id!==e.replaces||!input.replaceConfirmed)throw conflict('Eine bestätigte Entscheidung in dieser Ablöselinie besteht. Den aktuellen Eintrag gezielt korrigieren und seine Ablösung ausdrücklich bestätigen.');record(previous,'superseded','superseded')}
   else if(e.replaces&&!e.history.some(h=>h.action==='confirmed')&&!input.replaceConfirmed)throw conflict('Ablösung ausdrücklich bestätigen.');
   if(['goal','nextStep'].includes(e.kind)&&next.entries.some(p=>p.id!==e.id&&p.kind===e.kind&&p.status==='confirmed'))throw conflict('Ein bestätigter Wert besteht bereits. Diesen gezielt korrigieren und ablösen.');
   record(e,'confirmed','confirmed');
  }else if(input.operation==='forget'){
   if(e.status==='forgotten')throw conflict('Eintrag ist bereits vergessen.');record(e,'forgotten','forgotten');
  }else if(input.operation==='restore'){
   if(e.status!=='forgotten')throw invalid();record(e,'restored','proposed');
  }
 }
 next.revision++;next.updatedAt=at;
 const result={...backup,records:[...backup.records.filter(r=>r.contextId!==room.id||r.contextCreatedAt!==room.createdAt),next]};
 const parsed=projectMemoryBackupContract.safeParse(result);if(!parsed.success)throw new LocalStateError('VALIDATION','Speichergrenze oder Revisionsvertrag erreicht. Nichts wurde überschrieben.',400);
 // Keep enough exact-content capacity to forget every active entry later. Never
 // truncate history; a full archive blocks new content, not the reserved hide action.
 const bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).length;
 const reserve=parsed.data.records.flatMap(r=>r.entries).filter(e=>e.status!=='forgotten').reduce((total,e)=>total+bytes({revision:Number.MAX_SAFE_INTEGER,at:'9999-12-31T23:59:59.999Z',action:'forgotten',status:'forgotten',text:e.text})+128,0);
 if(bytes(parsed.data)+reserve>MEMORY_BYTES&&input.operation!=='forget')throw new LocalStateError('VALIDATION','Projektgedächtnis ist voll. Weitere Inhalte sind gesperrt; Vergessen bleibt reserviert. Export sichert Daten, gibt aber keinen Speicher frei.',400);
 return parsed.data;
}
