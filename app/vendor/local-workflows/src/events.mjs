import {copy,exactFields} from '../../skill-core/src/contract.mjs';
import {fail} from './data.mjs';
export function createWorkflowEvents(limit=512) {
 if(!Number.isSafeInteger(limit)||limit<1||limit>4096) fail('EVENT_RETENTION');
 const events=[],listeners=new Set();let sequence=0;
 return {
  append(record) {
   const event={sequence:++sequence,...copy(record)};events.push(event);if(events.length>limit) events.shift();
   for(const listener of [...listeners]) {
    try {
     const result=listener(copy(event));
     if(result&&typeof result.then==='function') Promise.resolve(result).catch(()=>{});
    } catch {/* Synchronous and asynchronous observer errors cannot alter execution outcome. */}
   }
  },
  read(options={}) {
   exactFields(options,['afterSequence','limit'],[]);const {afterSequence=0,limit=256}=options;
   if(!Number.isSafeInteger(afterSequence)||afterSequence<0||!Number.isSafeInteger(limit)||limit<1||limit>1024) fail('EVENT_QUERY');
   return events.filter(e=>e.sequence>afterSequence).slice(0,limit).map(copy);
  },
  info:()=>({firstSequence:events[0]?.sequence??null,lastSequence:sequence||null,retainedCount:events.length,droppedCount:sequence-events.length}),
  subscribe(listener) {if(typeof listener!=='function') fail('EVENT_LISTENER');listeners.add(listener);return ()=>listeners.delete(listener);}
 };
}
