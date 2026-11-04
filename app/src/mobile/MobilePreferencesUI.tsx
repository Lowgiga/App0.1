import {useEffect,useId,useRef,useState} from 'react';
import {assignMobileSlot,mobileActions,parseMobilePreferences,type MobileActionId,type MobilePreferences} from './mobile-contract.ts';
import './mobile.css';

type Props={value:MobilePreferences;onSave:(value:MobilePreferences)=>Promise<void>;disabled?:boolean;active?:boolean};
export function MobilePreferencesUI({value,onSave,disabled=false,active=true}:Props) {
  const [draft,setDraft]=useState(()=>parseMobilePreferences(value)),[basis,setBasis]=useState(()=>JSON.stringify(value));
  const [pending,setPending]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
  const gate=useRef(false),mounted=useRef(false),observed=useRef(JSON.stringify(value)),details=useRef<HTMLDetailsElement>(null),summary=useRef<HTMLElement>(null),id=useId();
  const current=JSON.stringify(value),dirty=JSON.stringify(draft)!==basis,stale=current!==basis;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
  useEffect(()=>{if(!pending&&observed.current!==current){observed.current=current;if(!dirty&&current!==basis){setDraft(parseMobilePreferences(value));setBasis(current);setStatus('')}}},[current,basis,dirty,pending,value]);
  function reset(close=false) {setDraft(parseMobilePreferences(value));setBasis(current);setError('');setStatus('');if(close&&details.current){details.current.open=false;summary.current?.focus()}}
  async function save() {
    if(disabled||!active||stale||!dirty||gate.current)return;
    gate.current=true;setPending(true);setError('');setStatus('');const next=parseMobilePreferences(draft);
    try{await onSave(next);if(mounted.current){setBasis(JSON.stringify(next));setStatus('Schnelltasten lokal gespeichert.')}}
    catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'Schnelltasten konnten nicht gespeichert werden.');}
    finally{gate.current=false;if(mounted.current)setPending(false)}
  }
  return <section className="lq-mobile-preferences" hidden={!active} inert={!active} aria-label="Mobile App-Bedienung">
    <details ref={details}><summary ref={summary}>App-Schnelltasten anpassen</summary>
      <p id={id+'-help'}>Bis zu vier Ziele unten am Bildschirm. „Nicht belegt“ lässt eine Taste frei. Die Leiste blendet sich beim Tippen aus.</p>
      <fieldset disabled={disabled||pending||!active} aria-describedby={id+'-help'}><legend>Deine Belegung</legend>
        {draft.slots.map((slot,index)=><label key={index} htmlFor={id+'-'+index}>Schnelltaste {index+1}<select id={id+'-'+index} aria-label={'Schnelltaste '+(index+1)} value={slot??''} onChange={event=>{
          try{setDraft(assignMobileSlot(draft,index,(event.target.value||null) as MobileActionId|null));setError('');setStatus('')}catch{setError('Dieses Ziel ist ungültig oder bereits belegt.')}
        }}><option value="">Nicht belegt</option>{mobileActions.map(action=><option key={action.id} value={action.id} disabled={draft.slots.some((other,i)=>i!==index&&other===action.id)}>{action.target.kind==='studio'?'Studio · ':''}{action.label}</option>)}</select></label>)}
      </fieldset>
      {stale&&dirty&&<p role="alert">Die gespeicherte Belegung wurde geändert. Dein Entwurf bleibt sichtbar. Übernimm vor weiteren Änderungen den aktuellen Stand.</p>}
      {error&&<p role="alert">{error}</p>}
      <p role="status" aria-live="polite">{pending?'Belegung wird gespeichert …':status}</p>
      <div className="lq-mobile-preferences-actions">
        <button type="button" disabled={disabled||pending||!active||!dirty||stale} onClick={()=>void save()}>Schnelltasten speichern</button>
        <button type="button" disabled={pending||!active} onClick={()=>reset(true)}>Abbrechen</button>
        {stale&&dirty&&<button type="button" disabled={pending||!active} onClick={()=>reset()}>Aktuellen Stand übernehmen</button>}
      </div>
      <details className="lq-mobile-boundaries"><summary>Was die Leiste steuert</summary><p>Nur Bereiche dieser App. Androids Home-, Zurück- und App-Wechsel-Tasten bleiben Systemfunktionen. Freigaben, Starts und Löschungen behalten ihre bisherigen Prüfschritte. Keine zusätzlichen Geräteberechtigungen.</p></details>
    </details>
  </section>;
}
