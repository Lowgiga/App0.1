import {exactFields} from '../../skill-core/src/contract.mjs';
import {fail,isId,snapshot} from './data.mjs';
/** HOST-ONLY port. Never expose CAS to packages or untrusted checkpoint importers. */
export function createTrustedMemoryStore(options={}) {
 exactFields(options,['maxEntries'],[],'store options');
 const {maxEntries=64}=options;
 if(!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>1024) fail('STORE_CAPACITY');
 const records=new Map();
 const id=value=>{if(!isId(value)) fail('STORE_ID');};
 return Object.freeze({
  read(pipelineId) {id(pipelineId);return records.has(pipelineId)?snapshot(records.get(pipelineId),1049600):null;},
  compareAndSwap(pipelineId,expectedRevision,record) {
   id(pipelineId);if(expectedRevision!==null && (!Number.isSafeInteger(expectedRevision)||expectedRevision<1)) fail('STORE_REVISION');
   const previous=records.get(pipelineId);
   if((previous?.revision??null)!==expectedRevision) fail('STORE_CONFLICT');
   if(!previous && records.size>=maxEntries) fail('STORE_CAPACITY');
   const safe=snapshot(record),revision=(previous?.revision??0)+1;
   if(!Number.isSafeInteger(revision)) fail('STORE_REVISION');
   records.set(pipelineId,{revision,record:safe});return revision;
  }
 });
}
