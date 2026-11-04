import {z} from 'zod';
import {checkIds,viewIds,modeIds,agentIds,categories,taskStatuses,widgetIds} from './work-constants.ts';
import {commandContract,emptyCommand} from './command-contract.ts';
import {neuroSettingsContract,defaultNeuroSettings} from './neuro-contract.ts';
export {checkIds,viewIds,modeIds,agentIds,categories,taskStatuses,widgetIds} from './work-constants.ts';
const unique=<T extends {id:string}>(items:T[])=>new Set(items.map(x=>x.id)).size===items.length;
const checks=z.object(Object.fromEntries(checkIds.map(k=>[k,z.boolean().optional()]))).strict();
const notes=z.array(z.object({id:z.string().uuid(),text:z.string().min(1).max(5000),createdAt:z.string().datetime()}).strict()).max(100).refine(unique,'Notiz-IDs müssen eindeutig sein.');
export const settingsContract=z.object({theme:z.enum(['light','dark','system']),density:z.enum(['comfortable','compact']),fontScale:z.number().int().min(100).max(125),startView:z.enum(viewIds),widgets:z.array(z.enum(widgetIds)).max(6).refine(a=>new Set(a).size===a.length),showSourceBanner:z.boolean(),motion:z.enum(['subtle','hologram','off']),powerSaver:z.boolean(),chatMode:z.enum(modeIds),chatContext:z.enum(['selected','all']),citeSources:z.boolean(),neuro:neuroSettingsContract.default(defaultNeuroSettings)}).strict();
export const defaultSettings:z.infer<typeof settingsContract>={theme:'system',density:'comfortable',fontScale:100,startView:'overview',widgets:[...widgetIds],showSourceBanner:true,motion:'subtle',powerSaver:false,chatMode:'DEEP',chatContext:'selected',citeSources:true,neuro:{...defaultNeuroSettings}};
export const agentProfileContract=z.object({id:z.enum(agentIds),role:z.string().min(2).max(100),instructions:z.string().max(2000),mode:z.enum(modeIds),output:z.string().min(1).max(300),maxDelegation:z.number().int().min(0).max(3),callBudget:z.number().int().min(0).max(1000),timeBudget:z.number().int().min(1).max(480),externalWrite:z.literal('approval')}).strict();
export const defaultProfiles:z.infer<typeof agentProfileContract>[]=[
{id:'zimt',role:'Orchestrierung',instructions:'Mission und Scope klären. Bestehenden Kontext laden, Zuständigkeiten verteilen und Ergebnisse mit Belegen zusammenführen.',mode:'DEEP',output:'Gemeinsames Ergebnis, offene Punkte und Checkpoint',maxDelegation:3,callBudget:20,timeBudget:60,externalWrite:'approval'},
{id:'manus',role:'Builder',instructions:'Den begrenzten Auftrag umsetzen. Fertiges Ergebnis mit konkreten Dateien und tatsächlich ausgeführten Tests übergeben.',mode:'BUILD',output:'Artefakt, Validierung und Hand-off',maxDelegation:1,callBudget:30,timeBudget:120,externalWrite:'approval'},
{id:'junior',role:'Unabhängiges Review',instructions:'Nur relevante, konkrete und belegbare Einwände melden. Ungeprüfte Erfolgsmeldungen, fehlende Quellen und Randfälle suchen.',mode:'DEEP',output:'Priorisierte Findings mit Belegen',maxDelegation:0,callBudget:15,timeBudget:45,externalWrite:'approval'},
{id:'codex',role:'Architektur und Code',instructions:'Projektstand lesen. Kleinste belastbare Lösung planen, implementieren und angemessen testen. Externe Freigaben separat behandeln.',mode:'DEV LOOP',output:'Lösung, Diff, Tests und Review-Grundlage',maxDelegation:2,callBudget:30,timeBudget:120,externalWrite:'approval'}];
export const taskContract=z.object({id:z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),title:z.string().min(3).max(150),category:z.enum(categories),priority:z.enum(['P0','P1','P2']),owner:z.enum(agentIds),status:z.enum(taskStatuses),acceptance:z.string().min(5).max(1500),evidence:z.string().max(3000),reviewed:z.boolean(),dependencies:z.array(z.string().max(64)).max(12),archived:z.boolean()}).strict();
export type MeshTask=z.infer<typeof taskContract>;
export const defaultTasks:MeshTask[]=[
['tune-controls','Bedienung und Schnellnavigation','Bedienung','P1','codex','Suche öffnet alle Bereiche; mobile Bedienung ohne seitliches Überlaufen.'],
['tune-dashboard','Dashboard individuell einstellen','Einstellungen','P1','codex','Theme, Schriftgröße, Dichte, Startseite und Widgets werden gespeichert.'],
['tune-profiles','Arbeitsprofile für Agenten','Einstellungen','P1','zimt','Rolle, Auftrag, Modus und Budgets fließen in den exportierten Hand-off ein.'],
['tune-chats','Missionräume mit ausgewähltem Kontext','Funktion','P1','manus','Mission, Beiträge und Quellen bleiben nach Neuladen erhalten.'],
['tune-matrix','Aufgaben mit Abhängigkeiten und Belegen','Funktion','P1','junior','Erledigt erfordert Beleg und Review; Abhängigkeiten und Zyklen werden geprüft.'],
['tune-3d','Interaktiver 3D- und AR-Versuchsraum','Visualisierung','P2','codex','Drehen, Auswahl und Pause funktionieren; AR benötigt Geräteunterstützung.'],
['tune-learning','Lernmissionen mit Fortschritt','Lernen','P2','junior','Antworten erhalten Erklärungen; persönlicher Fortschritt wird gespeichert.'],
['paz-baseline','PAZ-Baseline vor Dateiplan vergleichen','Integration','P0','manus','PR #19 und main auf Schema, Loader, YAML und Tests lesend vergleichen.'],
['make-parameters','Make-Parameter und Außenwirkungen lesen','Integration','P0','manus','Konkrete Modulparameter, Kosten, Datenzugriffe und Stoppen dokumentieren.'],
['cue-github','Cue-GitHub-Lesezugriff nachweisen','Integration','P1','zimt','Werkzeug, Anmeldung, Profilbindung und eigener Leseabruf getrennt belegen.'],
['hermes-preflight','Hermes-Gerät und Anschlussweg prüfen','Integration','P2','codex','Autorisierten Gerätetyp und erreichbare Laufzeit vor Workerentwurf feststellen.']
].map(([id,title,category,priority,owner,acceptance])=>({id,title,category:category as MeshTask['category'],priority:priority as MeshTask['priority'],owner:owner as MeshTask['owner'],status:'Offen',acceptance,evidence:'',reviewed:false,dependencies:[],archived:false}));
export function matrixErrors(tasks:MeshTask[]):string[]{
 const errors:string[]=[];const byId=new Map(tasks.map(t=>[t.id,t]));
 if(byId.size!==tasks.length)errors.push('Aufgaben-IDs müssen eindeutig sein.');
 for(const t of tasks){
  if(new Set(t.dependencies).size!==t.dependencies.length)errors.push(`${t.title}: Abhängigkeiten müssen eindeutig sein.`);
  for(const d of t.dependencies)if(!byId.has(d))errors.push(`${t.title}: Eine Abhängigkeit fehlt.`);
  if(t.status==='Erledigt'){
   if(t.evidence.trim().length<12||!t.reviewed)errors.push(`${t.title}: Erledigt braucht einen konkreten Beleg (mindestens 12 Zeichen) und bestätigtes Review.`);
   if(t.dependencies.some(d=>byId.get(d)?.status!=='Erledigt'))errors.push(`${t.title}: Zuerst die Abhängigkeiten abschließen.`);
  }
 }
 const visiting=new Set<string>(),visited=new Set<string>();
 function visit(id:string):boolean{if(visiting.has(id))return true;if(visited.has(id))return false;visiting.add(id);const cycle=(byId.get(id)?.dependencies||[]).some(visit);visiting.delete(id);visited.add(id);return cycle}
 if(tasks.some(t=>visit(t.id)))errors.push('Die Aufgaben enthalten eine zyklische Abhängigkeit.');
 return [...new Set(errors)];
}
export const matrixContract=z.array(taskContract).max(60).superRefine((tasks,ctx)=>{for(const message of matrixErrors(tasks))ctx.addIssue({code:z.ZodIssueCode.custom,message})});
export const messageContract=z.object({id:z.string().uuid(),kind:z.enum(['Auftrag','Notiz','Rückmeldung']),text:z.string().min(1).max(2000),createdAt:z.string().datetime()}).strict();
export const roomContract=z.object({id:z.string().uuid(),title:z.string().min(2).max(100),agent:z.enum(agentIds),project:z.enum(['paz','make','cue','hermes','custom']),mode:z.enum(modeIds),goal:z.string().min(3).max(2000),output:z.string().min(1).max(300),sources:z.array(z.string().max(80)).max(20).refine(a=>new Set(a).size===a.length),status:z.enum(['Aktiv','Geparkt','Archiviert']),messages:z.array(messageContract).max(30).refine(unique),createdAt:z.string().datetime()}).strict();
const extendedFields={settings:settingsContract,profiles:z.array(agentProfileContract).length(4).refine(unique,'Genau ein Profil je Agent.'),rooms:z.array(roomContract).max(12).refine(unique),tasks:matrixContract,learning:z.object({evidence:z.boolean().optional(),handoff:z.boolean().optional(),baseline:z.boolean().optional(),automation:z.boolean().optional(),review:z.boolean().optional()}).strict()};
export const workContract=z.object({stateVersion:z.union([z.literal(3),z.literal(4)]).optional(),command:commandContract.optional(),checks,notes,settings:extendedFields.settings.optional(),profiles:extendedFields.profiles.optional(),rooms:extendedFields.rooms.optional(),tasks:extendedFields.tasks.optional(),learning:extendedFields.learning.optional(),expectedUpdatedAt:z.string().datetime().nullable()}).strict();
export const savedWorkContract=z.object({stateVersion:z.union([z.literal(3),z.literal(4)]).default(4).transform(()=>4 as const),command:commandContract.default(emptyCommand),checks,notes,settings:extendedFields.settings.default(defaultSettings),profiles:extendedFields.profiles.default(defaultProfiles),rooms:extendedFields.rooms.default([]),tasks:extendedFields.tasks.default(defaultTasks),learning:extendedFields.learning.default({}),updatedAt:z.string().datetime().nullable()}).strict();
export type WorkState=z.infer<typeof savedWorkContract>;
export type AgentProfile=z.infer<typeof agentProfileContract>;
export type MeshRoom=z.infer<typeof roomContract>;
export const emptyWork=()=>savedWorkContract.parse({checks:{},notes:[],updatedAt:null});
