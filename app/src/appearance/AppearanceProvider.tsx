import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {defaultAppearanceState,parseAppearanceState,type AppearanceState} from './contracts.ts';
import {AppearanceStore,type AppearanceRecord} from './store.ts';
type Appearance={value:AppearanceState;ready:boolean;error:string|null;previewing:boolean;preview:(next:AppearanceState)=>void;cancel:()=>void;save:()=>Promise<void>};
type Owner=symbol|null;
type Draft={value:AppearanceState;owner:Owner;guard:()=>void};
type Internal={api:Appearance;owner:Owner;stage:(next:AppearanceState,owner:Owner,guard:()=>void)=>void;cancelOwned:(owner:Owner)=>void;saveOwned:(owner:Owner)=>Promise<void>};
const Context=createContext<Internal|null>(null);
const noop=()=>{};
export function AppearanceProvider({children,store:provided}:{children:ReactNode;store?:AppearanceStore}){
 const [store]=useState(()=>provided??new AppearanceStore());
 const [persisted,setPersisted]=useState(defaultAppearanceState),[draft,setDraft]=useState<Draft|null>(null),[ready,setReady]=useState(false),[error,setError]=useState<string|null>(null);
 const record=useRef<AppearanceRecord|null>(null),currentDraft=useRef<Draft|null>(null),mounted=useRef(false),blocked=useRef(false),pending=useRef<AbortController|null>(null);
 const cancel=useCallback(()=>{pending.current?.abort();currentDraft.current=null;setDraft(null)},[]);
 useEffect(()=>{
  let cancelled=false;mounted.current=true;
  void store.load().then(value=>{if(cancelled)return;record.current=value;setPersisted(value.value);setReady(true)}).catch(cause=>{if(cancelled)return;blocked.current=true;setError('Darstellung konnte nicht geladen werden. Bestehende Daten bleiben erhalten. '+(cause instanceof Error?cause.message:''))});
  return()=>{cancelled=true;mounted.current=false;pending.current?.abort();store.close()};
 },[store]);
 const stage=useCallback((next:AppearanceState,owner:Owner,guard:()=>void)=>{
  if(!record.current)throw new Error('Darstellung wird noch geladen.');
  if(pending.current)throw new Error('Darstellung wird gerade gespeichert.');
  const value={value:parseAppearanceState(next),owner,guard};currentDraft.current=value;setDraft(value);
 },[]);
 const preview=useCallback((next:AppearanceState)=>stage(next,null,noop),[stage]);
 const save=useCallback(async()=>{
  if(!record.current||blocked.current)throw new Error('Darstellungsspeicherung gesperrt. Entwurf bleibt erhalten. App neu laden.');
  if(pending.current)throw new Error('Darstellung wird bereits gespeichert.');
  const chosen=currentDraft.current;if(!chosen)return;
  const controller=new AbortController();pending.current=controller;
  try{
   chosen.guard();
   const stored=await store.save(record.current.revision,chosen.value,()=>{
    if(!mounted.current||controller.signal.aborted||currentDraft.current!==chosen)throw new DOMException('Darstellungsspeicherung abgebrochen.','AbortError');
    chosen.guard();
   },controller.signal);
   record.current=stored;
   if(mounted.current){setPersisted(stored.value);if(currentDraft.current===chosen){currentDraft.current=null;setDraft(null)}setError(null)}
  }catch(cause){
   if(!(cause instanceof Error&&cause.name==='AbortError')){blocked.current=true;if(mounted.current)setError(cause instanceof Error?cause.message:'Darstellung konnte nicht gespeichert werden. Entwurf bleibt erhalten.');}
   throw cause;
  }finally{if(pending.current===controller)pending.current=null}
 },[store]);
 const cancelOwned=useCallback((owner:Owner)=>{if(currentDraft.current?.owner===owner)cancel()},[cancel]);
 const saveOwned=useCallback(async(owner:Owner)=>{if(currentDraft.current?.owner!==owner)return;await save()},[save]);
 const api={value:draft?.value??persisted,ready,error,previewing:draft!==null,preview,cancel,save};
 return <Context.Provider value={{api,owner:draft?.owner??null,stage,cancelOwned,saveOwned}}>{children}</Context.Provider>;
}
function useInternal(){const value=useContext(Context);if(!value)throw new Error('AppearanceProvider required');return value}
export function useAppearance():Appearance{return useInternal().api}
/** Scoped editor ownership prevents hidden inspectors from cancelling someone else's preview. */
export function useAppearanceEditor(guard:()=>void){
 const context=useInternal(),[owner]=useState(()=>Symbol('appearance-editor')),latest=useRef(guard);latest.current=guard;
 const validate=useCallback(()=>latest.current(),[]);
 const {stage,cancelOwned,saveOwned}=context;
 const preview=useCallback((next:AppearanceState)=>stage(next,owner,validate),[stage,owner,validate]);
 const cancel=useCallback(()=>cancelOwned(owner),[cancelOwned,owner]);
 const save=useCallback(()=>saveOwned(owner),[saveOwned,owner]);
 useEffect(()=>()=>cancel(),[cancel]);
 return{...context.api,begin:context.api.cancel,preview,cancel,save,ownsPreview:context.api.previewing&&context.owner===owner};
}
