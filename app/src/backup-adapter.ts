import {z} from 'zod';
import {exportBackup,importBackup,prepareRestore} from '../vendor/portable-kit/backup.mjs';
import {makeV4Validator} from '../vendor/portable-kit/examples/v4-adapter.mjs';
import {savedWorkContract,type WorkState} from '../upstream/lib/work-contract.ts';
import {workReferenceErrors} from '../upstream/lib/work-updates.ts';
import {parseSystemState,type SystemState} from './system-state.ts';
import {projectMemoryBackupContract,type ProjectMemoryBackup} from './project-memory.ts';
export const SOURCE_REVISION='3e921804b13e0d7c70d1ff15474f0387e84d70b6';
export const BACKUP_LIMIT=8*1024*1024;
const exportContextSchema=z.object({observedWallTime:z.string().datetime(),logicalExportTime:z.string().datetime(),clockAdjusted:z.literal(true),policy:z.literal('monotonic-order-v1')}).strict();
function later(left:string,right:string){const [ls,lf='']=left.slice(0,-1).split('.'),[rs,rf='']=right.slice(0,-1).split('.');if(ls!==rs)return ls>rs;return lf.padEnd(Math.max(lf.length,rf.length),'0')>rf.padEnd(Math.max(lf.length,rf.length),'0')}
export type SourceCatalog={sources:{id:string}[];[key:string]:unknown};
// Validate the source boundary without dropping the complete mesh snapshot.
const sourceRecordSchema=z.object({id:z.string().min(1).refine(id=>id.trim().length>0,'Quellen-ID fehlt'),title:z.string().optional(),type:z.string().optional(),date:z.string().optional(),status:z.string().optional(),description:z.string().optional(),file:z.string().optional()}).passthrough();
const sourceCatalogSchema=z.object({sources:z.array(sourceRecordSchema)}).passthrough().superRefine((catalog,context)=>{const ids=new Set<string>();for(const source of catalog.sources){if(ids.has(source.id))context.addIssue({code:z.ZodIssueCode.custom,message:'Doppelte Quellen-ID im Quellenkatalog'});ids.add(source.id)}});
function validateSourceCatalog(value:unknown):SourceCatalog{sourceCatalogSchema.parse(value);return value as SourceCatalog}
function validateSourceReferences(work:unknown,catalog:SourceCatalog){const errors=workReferenceErrors(savedWorkContract.parse(work),catalog.sources.map(source=>source.id));if(errors.length)throw new Error('Quellen-/Referenzprüfung: '+errors[0])}
export function createBackupAdapter(sourceCatalog:SourceCatalog){
 validateSourceCatalog(sourceCatalog);
 const structuralOptions={validateWork:(work:unknown)=>savedWorkContract.safeParse(work),maxBytes:BACKUP_LIMIT};
 const options={validateWork:makeV4Validator({savedWorkContract,workReferenceErrors,knownSourceIds:sourceCatalog.sources.map(s=>s.id)}),maxBytes:BACKUP_LIMIT};
 const snapshot=(work:WorkState,system:SystemState,memory?:ProjectMemoryBackup)=>({work,data:{sourceCatalog,system:parseSystemState(system),...(memory===undefined?{}:{projectMemory:projectMemoryBackupContract.parse(memory)})}});
 return {
  async export(work:WorkState,system:SystemState,at=new Date().toISOString(),memory?:ProjectMemoryBackup){
   const checkedWork=savedWorkContract.parse(work);z.string().datetime().parse(at);
   const adjusted=checkedWork.updatedAt!==null&&later(checkedWork.updatedAt,at),logicalExportTime=adjusted?checkedWork.updatedAt!:at;
   const payload=snapshot(work,system,memory);
   const data=adjusted?{...payload.data,exportContext:{observedWallTime:at,logicalExportTime,clockAdjusted:true,policy:'monotonic-order-v1'}}:payload.data;
   return exportBackup({...payload,data},{exportedAt:logicalExportTime,producer:{name:'cue-command-mesh-system',version:'0.5.5-prototype-20261104'},source:{revision:SOURCE_REVISION,workUpdatedAt:work.updatedAt}},options);
  },
  async preview(text:string,currentWork:WorkState,currentSystem:SystemState,currentMemory?:ProjectMemoryBackup){
   const inspection=await importBackup(text,structuralOptions);
   const data=inspection.snapshot.data;
   if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Backup-Datenhülle fehlt.');
   const reserved=['system','sourceCatalog','exportContext','projectMemory'].some(key=>key in data);
   const isSystem='system' in data&&'sourceCatalog' in data;
   if(reserved&&!isSystem)throw new Error('Unvollständige reservierte System-Datenhülle.');
   if(isSystem){if(Object.keys(data).some(key=>!['system','sourceCatalog','exportContext','projectMemory'].includes(key)))throw new Error('Unbekannte Felder in Systembackup.');parseSystemState(data.system);validateSourceCatalog(data.sourceCatalog);}
   validateSourceReferences(inspection.snapshot.work,isSystem?validateSourceCatalog(data.sourceCatalog):sourceCatalog);
   validateSourceReferences(currentWork,sourceCatalog);
   const includesProjectMemory='projectMemory' in data;if(includesProjectMemory)projectMemoryBackupContract.parse(data.projectMemory);
   const exportContext='exportContext' in data?exportContextSchema.parse(data.exportContext):null;
   if(exportContext&&(exportContext.logicalExportTime!==inspection.metadata.exportedAt||!later(exportContext.logicalExportTime,exportContext.observedWallTime)))throw new Error('Widersprüchlicher Export-Zeitkontext.');
   const current=snapshot(currentWork,currentSystem,currentMemory);
   // Export-time provenance is documentary, not a field in the local preferences database.
   const target=exportContext?{...current,data:{...current.data,exportContext}}:current;
   const plan=await prepareRestore(text,target,structuralOptions);
   return {inspection,plan,exportContext,includesSystemState:isSystem,includesProjectMemory,restoreAvailable:false as const};
  }
 };
}
