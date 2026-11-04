import {copy,exactFields} from './contract.mjs';
/** Bounded append-only sequencing: old records age out; no record can be rewritten. */
export function createEventStore() {
 const records=[];let sequence=0;
 return Object.freeze({
  append(record) {records.push({sequence:++sequence,...copy(record)});if(records.length>4096) records.shift();},
  read(options={}) {
   exactFields(options,['afterSequence','limit'],[],'event query');
   const {afterSequence=0,limit=256}=options;
   if(!Number.isSafeInteger(afterSequence)||afterSequence<0||!Number.isSafeInteger(limit)||limit<1||limit>1024) throw new Error('Invalid event query budget');
   return records.filter(e=>e.sequence>afterSequence).slice(0,limit).map(e=>copy(e));
  },
  info:()=>({firstSequence:records[0]?.sequence??null,lastSequence:sequence||null,retainedCount:records.length,droppedCount:sequence-records.length})
 });
}
