import {createContext,useContext,useState,useRef,useEffect,type ReactNode} from 'react';
import {defaultSystemState,type SystemState} from './system-state.ts';
import {PreferencesStore,type PreferencesRecord} from './preferences-store.ts';
import {toast} from 'sonner';
type Preferences={value:SystemState;ready:boolean;error:string|null;save:(next:SystemState|((current:SystemState)=>SystemState))=>Promise<void>};
const Context=createContext<Preferences|null>(null);
export function SystemPreferencesProvider({children,store:provided}:{children:ReactNode;store?:PreferencesStore}){
 const [store]=useState(()=>provided??new PreferencesStore({legacy:typeof localStorage!=='undefined'?localStorage:undefined}));
 const [value,setValue]=useState(defaultSystemState),[ready,setReady]=useState(false),[error,setError]=useState<string|null>(null);
 const current=useRef<PreferencesRecord|null>(null),pending=useRef(false),mounted=useRef(false),blocked=useRef(false);
 useEffect(()=>{mounted.current=true;let cancelled=false;void store.load().then(record=>{if(cancelled)return;current.current=record;setValue(record.value);setReady(true)}).catch(e=>{if(!cancelled){blocked.current=true;setError('Studio-Daten konnten nicht geladen werden. Bestehende Daten wurden nicht ersetzt. '+(e instanceof Error?e.message:''))}});return()=>{cancelled=true;mounted.current=false;store.close()}},[store]);
 const save=async(next:SystemState|((current:SystemState)=>SystemState))=>{if(!current.current||blocked.current)throw new Error('Studio-Speicherung gesperrt. App neu laden.');if(pending.current)throw new Error('Studio-Speicherung läuft bereits.');pending.current=true;try{const stored=await store.save(current.current.revision,previous=>typeof next==='function'?next(previous):next);current.current=stored;if(mounted.current){setValue(stored.value);setError(null)}}catch(e){const message=e instanceof Error?e.message:'Studio-Speicherung fehlgeschlagen.';blocked.current=true;if(mounted.current)setError(message);toast.error(message);throw e}finally{pending.current=false}};
 return <Context.Provider value={{value,ready,error,save}}>{children}</Context.Provider>
}
export function useSystemPreferences(){const value=useContext(Context);if(!value)throw new Error('SystemPreferencesProvider required');return value}
