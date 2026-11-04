import {useEffect,useRef,useState} from 'react';
import {CompanionPanel} from '../companion/CompanionPanel.tsx';
import {verifiedCommitEvent,type CompanionHostEvent} from '../companion/state.ts';
import type {AssistantSessionState} from '../assistant/use-assistant-session.ts';
import type {ContextKey} from '../assistant/contracts.ts';
import type {PresentationMotionMode} from '../motion/use-finite-motion.ts';

type Delivery={event:CompanionHostEvent;next?:CompanionHostEvent};
type Props={state:AssistantSessionState;context:ContextKey;blocked:boolean;motionEnabled:boolean;motion?:PresentationMotionMode;powerSaver:boolean};
/** One-way presentation bridge: no transport, config grant or mutation callback. */
export function AssistantCompanion({state,context,blocked,motionEnabled,motion='subtle',powerSaver}:Props){
 const [enabled,setEnabled]=useState(false),[delivery,setDelivery]=useState<Delivery|null>(null);
 const generation=useRef(0),owner=useRef<string|null>(null),closed=useRef(false),lastStatus=useRef('');
 const lastRun=state.events.at(-1)?.runId;
 // Terminal events follow the start in a separate committed render. The child
 // consumes a latest-only prop and must observe the new owner before its result.
 useEffect(()=>{if(delivery?.next)setDelivery(current=>current===delivery?{event:delivery.next!}:current)},[delivery]);
 useEffect(()=>{
  const id=++generation.current;
  if(!enabled){owner.current=null;closed.current=false;lastStatus.current='';setDelivery(null);return}
  const current=()=>generation.current===id;
  const send=(event:CompanionHostEvent,simulation=false)=>{
   if(!current())return;
   const signature=event.type+':'+event.requestId;
   if(lastStatus.current===signature)return;lastStatus.current=signature;
   if(event.type==='idle'){
    const retiring=owner.current??event.requestId;owner.current=retiring;closed.current=true;
    setDelivery({event:{...event,requestId:retiring}});return;
   }
   if(event.type==='requestStarted'){owner.current=event.requestId;closed.current=false;setDelivery({event});return}
   if(owner.current!==event.requestId){owner.current=event.requestId;closed.current=false;setDelivery({event:{type:'requestStarted',eventId:crypto.randomUUID(),requestId:event.requestId,simulation},next:event})}
   else if(!closed.current)setDelivery({event});
  };
  const eventId=crypto.randomUUID(),fallback=owner.current??'context:'+context.contextId;
  if(blocked)send({type:'idle',eventId,requestId:fallback});
  else if(state.phase==='saved'&&state.proof&&state.operationId){
   // Capture exact identities and detached proof before awaiting its hash.
   const proof=structuredClone(state.proof),expected={eventId,requestId:state.operationId,operationId:state.operationId,context:{...context}};
   if(proof.verification==='verified')void verifiedCommitEvent(expected,proof).then(event=>{if(current())send(event??{type:'error',eventId,requestId:expected.requestId})});
   else send({type:'error',eventId,requestId:state.operationId});
  }else if(state.phase==='uncertain'||state.phase==='error')send({type:'error',eventId,requestId:state.operationId??lastRun??fallback});
  else if(state.phase==='committing'||state.phase==='reconciling'){
   if(state.operationId)send({type:'requestStarted',eventId,requestId:state.operationId,simulation:false});
  }else if(state.phase==='checked'&&state.review)send({type:'awaitingConfirmation',eventId,requestId:state.review.runId});
  else if(state.phase==='preview'&&state.preview)send({type:'awaitingConfirmation',eventId,requestId:state.preview.proposal.id});
  else if(state.phase==='ready'&&state.result)send({type:'simulatedResult',eventId,requestId:state.result.runId,summary:state.result.summary},true);
  else if((state.phase==='advising'||state.phase==='reviewing')&&lastRun)send({type:'requestStarted',eventId,requestId:lastRun,simulation:true});
  else if(state.phase==='ready'||state.phase==='idle'||state.phase==='loading')send({type:'idle',eventId,requestId:fallback});
  return()=>{generation.current++};
 },[enabled,blocked,state.phase,state.result,state.review,state.preview,state.proof,state.operationId,lastRun,context.contextId,context.contextCreatedAt]);
 return <aside className="assistant-companion" aria-label="Optionaler Projektbegleiter">
  <button type="button" aria-expanded={enabled} onClick={()=>setEnabled(value=>!value)}>{enabled?'Begleiter ausblenden':'Begleiter anzeigen'}</button>
  <p><small>Nur für diese Ansicht. Bewegung folgt der globalen Einstellung ({motionEnabled?'erlaubt':'aus'}), Energiesparen ({powerSaver?'ein':'aus'}) und der Bewegungsreduktion deines Betriebssystems.</small></p>
  {enabled&&<CompanionPanel enabled motionEnabled={motionEnabled} motion={motion} powerSaver={powerSaver} event={delivery?.event??null}/>}
 </aside>;
}
