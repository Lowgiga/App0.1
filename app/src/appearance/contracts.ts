import {z} from 'zod';

export const APPEARANCE_SCHEMA='lowquantflow.appearance/v1' as const;
export const APPEARANCE_MAX_BYTES=256*1024;
export const APPEARANCE_MAX_OVERRIDES=256;
const hex=z.string().regex(/^#[0-9a-fA-F]{6}$/).transform(value=>value.toUpperCase());
export const nodeAppearanceContract=z.object({
 core:hex,shell:hex,orbit:hex,
 shape:z.enum(['polyhedron','cube']),size:z.enum(['small','normal','large']),motion:z.enum(['off','breathe']),
}).strict();
export const appearanceBindingContract=z.object({kind:z.enum(['room','mission']),id:z.string().uuid(),createdAt:z.string().datetime()}).strict();
// IndexedDB preserves own undefined values. A partial field may be absent, but
// must never overwrite an effective renderer default with explicit undefined.
const partialAppearanceContract=nodeAppearanceContract.partial().refine(style=>Object.values(style).every(value=>value!==undefined),'Darstellungswerte dürfen nicht undefined sein.');
const appearanceStateContract=z.object({
 schema:z.literal(APPEARANCE_SCHEMA),global:partialAppearanceContract,
 overrides:z.array(z.object({binding:appearanceBindingContract,style:partialAppearanceContract}).strict()).max(APPEARANCE_MAX_OVERRIDES),
}).strict().refine(state=>new Set(state.overrides.map(({binding})=>JSON.stringify(binding))).size===state.overrides.length,'Doppelte Knotenidentität.');
export type NodeAppearance=z.infer<typeof nodeAppearanceContract>;
export type AppearanceBinding=z.infer<typeof appearanceBindingContract>;
export type AppearanceState=z.infer<typeof appearanceStateContract>;
export function defaultAppearanceState():AppearanceState{return{schema:APPEARANCE_SCHEMA,global:{},overrides:[]}}
/** Strict, bounded and cloning: corrupt or future records never become writable defaults. */
export function parseAppearanceState(raw:unknown):AppearanceState{
 if(raw&&typeof raw==='object'&&'schema' in raw&&raw.schema!==APPEARANCE_SCHEMA)throw new Error('APPEARANCE_UNSUPPORTED_VERSION: Neuere Darstellungsversion. Bestehende Daten bleiben erhalten.');
 let serialized:string|undefined;
 try{serialized=JSON.stringify(raw)}catch{throw new Error('APPEARANCE_INVALID: Ungültige Darstellungsdaten.')}
 if(serialized===undefined||new TextEncoder().encode(serialized).length>APPEARANCE_MAX_BYTES)throw new Error('APPEARANCE_LIMIT: Darstellungsdaten überschreiten 256 KiB oder sind ungültig.');
 const parsed=appearanceStateContract.safeParse(raw);
 if(!parsed.success)throw new Error('APPEARANCE_INVALID: Farben, Werte oder Knotenidentitäten sind ungültig.');
 return parsed.data;
}
