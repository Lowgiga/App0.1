import {createContext,useContext,useEffect,useRef,type ReactNode} from 'react';
import {Menu} from 'lucide-react';
import {Button} from '@/components/ui/button';
import './system-menu.css';
type ModeContext={studio:boolean;onSwitchMode:(studio:boolean)=>void};
const Context=createContext<ModeContext|null>(null);
export function SystemModeMenuProvider({children,...value}:ModeContext&{children:ReactNode}){return <Context.Provider value={value}>{children}</Context.Provider>}
/** In-place disclosure, not a modal or an extra navigation-history entry. */
export function SystemModeMenu({active=true}:{active?:boolean}){
 const context=useContext(Context),details=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  if(!active)return;
  const close=()=>{if(details.current)details.current.open=false};
  const outside=(event:Event)=>{if(event.target instanceof Node&&!details.current?.contains(event.target))close()};
  const hide=()=>{if(document.hidden)close()};
  window.addEventListener('popstate',close);window.addEventListener('cue:navigate',close);window.addEventListener('cue:route-changed',close);
  document.addEventListener('pointerdown',outside);document.addEventListener('visibilitychange',hide);
  return()=>{close();window.removeEventListener('popstate',close);window.removeEventListener('cue:navigate',close);window.removeEventListener('cue:route-changed',close);document.removeEventListener('pointerdown',outside);document.removeEventListener('visibilitychange',hide)};
 },[active]);
 if(!context||!active)return null;
 const {studio,onSwitchMode}=context;
 function select(next:boolean){if(details.current)details.current.open=false;onSwitchMode(next)}
 return <details ref={details} className="system-mode-menu" onKeyDown={event=>{if(event.key==='Escape'&&details.current?.open){event.preventDefault();event.stopPropagation();details.current.open=false;details.current.querySelector('summary')?.focus()}}}>
  <summary aria-label="App-Menü"><Menu size={19} aria-hidden="true"/><span className="system-menu-label">App-Menü</span></summary>
  <div className="system-mode-menu-content">
   <nav aria-label="App-Ansichten"><Button type="button" variant={studio?'outline':'default'} aria-pressed={!studio} onClick={()=>select(false)}>Arbeitsbereiche</Button><Button type="button" variant={studio?'default':'outline'} aria-pressed={studio} onClick={()=>select(true)}>Studio · Graph &amp; Skills</Button></nav>
   <div className="system-mode-info"><strong>LowQuantFlow · lokal auf diesem Gerät</strong><p>Quellen: datierter Snapshot. Keine Cloud-Synchronisation, Anmeldung oder Live-/MCP-Verbindung. Persönlicher Cloud-Export ist noch nicht übernommen.</p></div>
   <Button type="button" variant="outline" onClick={()=>{if(window.confirm('App vollständig neu laden? Bereits bestätigt gesicherte persönliche Entwürfe bleiben auf diesem Gerät erhalten; noch nicht gesicherte Eingaben können verloren gehen. Ein laufender Prüfschritt wird unterbrochen; bestätigte Journal-Checkpoints bleiben erhalten. Der gespeicherte Projektkontext kann wieder geöffnet werden. Prüfprozesse starten nicht automatisch.'))location.reload()}}>Neu laden</Button>
  </div>
 </details>;
}
