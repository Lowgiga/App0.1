import {useEffect,useState} from 'react';
import type {AssistantSessionState} from '../assistant/use-assistant-session.ts';
import type {ContextKey} from '../assistant/contracts.ts';
import {verifiedCommitEvent} from '../companion/state.ts';
import {CubeFormation} from './CubeFormation.tsx';
import type {PresentationMotionMode} from './use-finite-motion.ts';
interface Props {state:AssistantSessionState;context:ContextKey;blocked:boolean;mode:PresentationMotionMode;powerSaver:boolean}
/** One-way display bridge. Validates detached readback; cannot issue an action. */
export function AssistantFormation({state,context,blocked,mode,powerSaver}:Props){
 const {proof,phase,operationId,preview}=state;
 const owner=context.contextId+'@'+context.contextCreatedAt;
 const [verified,setVerified]=useState<{proof:typeof proof;owner:string;operationId:string;key:string}|null>(null);
 useEffect(()=>{
  let live=true;
  if(!blocked&&phase==='saved'&&proof?.verification==='verified'&&operationId){
   const snapshot=structuredClone(proof);
   void verifiedCommitEvent({eventId:operationId,requestId:operationId,operationId,context:{...context}},snapshot).then(event=>{
    if(live&&event?.type==='verifiedCommit')setVerified({proof,owner,operationId,key:`receipt:${owner}:${event.receiptId}:${event.revision}`});
   });
  }
  return()=>{live=false};
 },[proof,phase,operationId,blocked,owner,context.contextId,context.contextCreatedAt]);
 const canDock=!blocked&&phase==='saved'&&verified?.proof===proof&&verified?.owner===owner&&verified?.operationId===operationId;
 const canGather=!blocked&&(phase==='preview'||phase==='checked')&&!!preview;
 // Keep one mounted decoration so a re-read of the same receipt cannot replay.
 const kind=canDock?'dock':'gather',eventKey=canDock?verified.key:canGather?`preview:${owner}:${preview.proposal.id}`:null;
 return <CubeFormation kind={kind} eventKey={eventKey} mode={mode} powerSaver={powerSaver} enabled={!!(canDock||canGather)}/>;
}
