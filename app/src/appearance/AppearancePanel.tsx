import {useEffect,useRef,useState} from 'react';
import type {WorkState} from '../../upstream/lib/work-contract.ts';
import type {AppearanceBinding,NodeAppearance} from './contracts.ts';
import {appearanceBinding,resolveNodeAppearance,type AppearanceNode} from './projection.ts';
import {useAppearanceEditor} from './AppearanceProvider.tsx';
import './appearance.css';
type Props={node?:AppearanceNode&{title?:string};work:WorkState;disabled?:boolean;active?:boolean};
const same=(a:AppearanceBinding|null,b:AppearanceBinding|null)=>!!a&&!!b&&a.kind===b.kind&&a.id===b.id&&a.createdAt===b.createdAt;
export function AppearancePanel({node,work,disabled=false,active=true}:Props){
 const [open,setOpen]=useState(false),[target,setTarget]=useState<'global'|'individual'>('global'),[saving,setSaving]=useState(false),[localError,setLocalError]=useState<string|null>(null);
 const binding=useRef<AppearanceBinding|null>(null),lastNode=useRef(node?.id);
 const currentBinding=node?appearanceBinding(node,work):null;
 const appearance=useAppearanceEditor(()=>{
  if(!active||disabled||!open)throw new DOMException('Darstellungseditor geschlossen.','AbortError');
  if(target==='individual'&&!same(binding.current,node?appearanceBinding(node,work):null))throw new Error('Der Knoten wurde ersetzt, entfernt oder archiviert. Entwurf bleibt erhalten; nichts gespeichert.');
 });
 const {cancel}=appearance;
 useEffect(()=>{if(!active||disabled||lastNode.current!==node?.id){cancel();setOpen(false);setLocalError(null)}lastNode.current=node?.id},[active,disabled,node?.id,cancel]);
 useEffect(()=>{if(!open||!active)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){cancel();setOpen(false);setLocalError(null)}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape)},[open,active,cancel]);
 const close=()=>{cancel();setOpen(false);setLocalError(null)};
 const start=()=>{appearance.begin();binding.current=currentBinding;setTarget(currentBinding?'individual':'global');setLocalError(null);setOpen(true)};
 const selectedStyle=target==='global'?appearance.value.global:appearance.value.overrides.find(entry=>same(binding.current,entry.binding))?.style??{};
 const defaults=resolveNodeAppearance(node??{id:'system:appearance',entityId:'appearance',kind:'system'},work,{...appearance.value,overrides:[]});
 const effective={...defaults,...selectedStyle};
 const update=(patch:Partial<NodeAppearance>|null)=>{
  try{
   const value=appearance.value;
   if(target==='global')appearance.preview({...value,global:patch===null?{}:{...value.global,...patch}});
   else{
    if(!binding.current)throw new Error('Für diesen Knoten gibt es keine dauerhafte Einzelidentität.');
    const overrides=value.overrides.filter(entry=>!same(binding.current,entry.binding));
    if(patch!==null)overrides.push({binding:binding.current,style:{...selectedStyle,...patch}});
    appearance.preview({...value,overrides});
   }
   setLocalError(null);
  }catch(cause){setLocalError(cause instanceof Error?cause.message:'Ungültige Darstellung.')}
 };
 const save=async()=>{setSaving(true);setLocalError(null);try{await appearance.save();setOpen(false)}catch(cause){if(!(cause instanceof Error&&cause.name==='AbortError'))setLocalError(cause instanceof Error?cause.message:'Speichern fehlgeschlagen.')}finally{setSaving(false)}};
 if(!active)return null;
 return <section className="appearance-panel" aria-label="Knotendarstellung">
  {!open?<button type="button" disabled={disabled||!appearance.ready} onClick={start}>Darstellung anpassen</button>:<>
   <div className="appearance-heading"><strong>Darstellung{node?.title?' · '+node.title:''}</strong><button type="button" aria-label="Darstellung schließen" onClick={close}>Schließen</button></div>
   <label>Ziel<select aria-label="Darstellungsziel" value={target} disabled={saving} onChange={event=>{cancel();binding.current=currentBinding;setTarget(event.target.value as typeof target);setLocalError(null)}}><option value="global">Alle Knoten</option><option value="individual" disabled={!currentBinding}>Dieser Knoten</option></select></label>
   {!currentBinding&&<p>Individuelle Darstellung ist nur für eigene, aktive Räume und Missionen mit dauerhafter Identität verfügbar.</p>}
   <fieldset disabled={disabled||!appearance.ready||saving}><legend>Farben und Form</legend>
    <div className="appearance-colors">{(['core','shell','orbit'] as const).map((channel,index)=><label key={channel}>{['Kern','Hülle','Orbit'][index]}<input type="color" aria-label={['Kernfarbe','Hüllenfarbe','Orbitfarbe'][index]} value={effective[channel]} onChange={event=>update({[channel]:event.target.value})}/></label>)}</div>
    <div className="appearance-choices"><label>Form<select aria-label="Form" value={effective.shape} onChange={event=>update({shape:event.target.value as NodeAppearance['shape']})}><option value="polyhedron">Polyeder</option><option value="cube">Würfel</option></select></label>
    <label>Größe<select aria-label="Größe" value={effective.size} onChange={event=>update({size:event.target.value as NodeAppearance['size']})}><option value="small">Klein · 0,8×</option><option value="normal">Normal · 1×</option><option value="large">Groß · 1,25×</option></select></label>
    <label>Bewegung<select aria-label="Bewegung" value={effective.motion} onChange={event=>update({motion:event.target.value as NodeAppearance['motion']})}><option value="off">Aus</option><option value="breathe">Atmen</option></select></label></div>
   </fieldset>
   <p>Nur lokale Darstellung; nicht in Projekt-Backups enthalten. Einzelstile haben Vorrang. Bewegungs- und Energiespareinstellungen gelten weiterhin.</p>
   <div className="appearance-actions"><button type="button" disabled={saving||disabled||!appearance.ready} onClick={()=>update(null)}>Zurücksetzen</button><button type="button" onClick={close}>Abbrechen</button><button type="button" disabled={saving||disabled||!appearance.ready||!appearance.ownsPreview} onClick={()=>void save()}>{saving?'Speichert…':'Speichern'}</button></div>
   {appearance.ownsPreview&&<p role="status">Vorschau · noch nicht gespeichert</p>}
  </>}
  {(localError||appearance.error)&&<p role="alert">{localError??appearance.error}</p>}
  {!appearance.ready&&!appearance.error&&<p role="status">Darstellung wird geladen…</p>}
 </section>;
}
