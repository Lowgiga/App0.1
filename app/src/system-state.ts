import {z} from 'zod';
import {configSchema,defaultConfig} from '../vendor/mesh-extensions/src/view.ts';
import {hintPreferencesSchema} from './context-assistance/core.ts';
import {mobilePreferencesSchema} from './mobile/mobile-contract.ts';
const jsonValue:z.ZodType<unknown>=z.lazy(()=>z.union([z.string().max(65536),z.number().finite(),z.boolean(),z.null(),z.array(jsonValue).max(2000),z.record(jsonValue)]));
export const historySchema=z.object({id:z.string().min(1).max(100),at:z.string().datetime(),state:z.enum(['completed','paused','aborted','failed','budget-exhausted','interrupted']),sourceUpdatedAt:z.string().datetime().nullable(),completedCount:z.number().int().min(0).max(8),outputs:z.array(z.object({stepId:z.string().max(100),output:jsonValue}).strict()).max(8),code:z.string().max(100).optional()}).strict();
// Additive optional v1 field: reading a legacy record must not materialize a
// default or rewrite existing settings. Older apps reject this unknown field;
// there is intentionally no lossy downgrade migration.
export const systemStateSchema=z.object({schema:z.literal('cue.system-state/v1'),graph:configSchema,surfaceLayout:z.enum(['stack','split','focus']),workflow:z.object({skill:z.enum(['all','mission-check','graph-explain','backup-plan','source-status']),pauseAfterStep:z.boolean()}).strict(),history:z.array(historySchema).max(20),historyPolicy:z.literal('historical-only-no-resume'),mobile:mobilePreferencesSchema.optional(),contextAssistance:hintPreferencesSchema.optional()}).strict().refine(value=>!Object.prototype.hasOwnProperty.call(value,'mobile')||value.mobile!==undefined,'Vorhandene mobile Einstellungen dürfen nicht leer sein.').refine(value=>!Object.prototype.hasOwnProperty.call(value,'contextAssistance')||value.contextAssistance!==undefined,'Vorhandene Hinweiseinstellungen dürfen nicht leer sein.');
export type SystemState=z.infer<typeof systemStateSchema>;
export type RunHistory=z.infer<typeof historySchema>;
export const defaultSystemState=():SystemState=>({schema:'cue.system-state/v1',graph:defaultConfig(),surfaceLayout:'stack',workflow:{skill:'all',pauseAfterStep:false},history:[],historyPolicy:'historical-only-no-resume'});
const KEY='cue-system-preferences-v1';const LIMIT=1024*1024;
export function parseSystemState(value:unknown):SystemState {const text=JSON.stringify(value);if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMIT)throw new Error('Systemzustand überschreitet das Größenlimit.');return systemStateSchema.parse(value)}
export function readSystemState(storage:Pick<Storage,'getItem'>):SystemState {const raw=storage.getItem(KEY);if(raw===null)return defaultSystemState();if(raw.length>LIMIT)throw new Error('Gespeicherte Systemdaten zu groß.');return parseSystemState(JSON.parse(raw))}
export function writeSystemState(storage:Pick<Storage,'setItem'>,value:unknown):SystemState {const checked=parseSystemState(value);storage.setItem(KEY,JSON.stringify(checked));return checked}
export function appendRunHistory(current:SystemState,record:RunHistory):SystemState {
 const history=[historySchema.parse(record),...current.history.filter(r=>r.id!==record.id)].slice(0,20);
 while(history.length){try{return parseSystemState({...current,history})}catch(error){if(history.length===1)throw error;history.pop()}}
 throw new Error('Prüfverlauf konnte nicht gesichert werden.');
}
