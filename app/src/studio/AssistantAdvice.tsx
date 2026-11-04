import type {AssistantConfig,AssistantResult,EvidenceRef} from '../assistant/contracts.ts';
import {producerLabel} from '../assistant/provenance.ts';
export const sourceName=(ref:EvidenceRef)=>ref.kind==='memory-entry'?`Projektgedächtnis · Eintrag ${ref.id} · Revision ${ref.revision}`:ref.kind==='config'?`Assistentenkonfiguration · Revision ${ref.revision}`:ref.kind==='room'?`Missionraum · ${ref.id} · erstellt ${ref.createdAt}`:ref.kind==='draft'?`Entwurf · ${ref.id} · Revision ${ref.revision}`:`Hostprüfung · ${ref.checkId} · Lauf ${ref.runId}`;
/** Presentation boundary: validated result only, no actions, transports or HTML. */
export function AssistantAdvice({result,config}:{result:AssistantResult;config:AssistantConfig}){
 const claims=result.claims.filter(claim=>claim.kind!=='confirmed'),detailed=config.continuation.detail==='detailed';
 return <section className="assistant-advisory" aria-label="Unbestätigte Beratung">
  <h4>Hinweise zur eigenen Prüfung</h4><p className="assistant-evidence-label">{producerLabel(result.producer)}</p>
  <p>Beratungsziel: {config.purposes.advice.goal}</p>
  <p>Diese Aussagen sind keine bestätigten Projektfakten und erteilen keine Freigabe. Quellenbezüge beweisen ihre Richtigkeit nicht.</p>
  {claims.length===0?<p>Keine unbestätigten Vorschläge oder Aussagen geliefert.</p>:<ul className="assistant-claim-list">{claims.map((claim,i)=><li key={i} className="assistant-claim" data-claim-kind={claim.kind}>
   <strong>{claim.kind==='proposal'?'Unbestätigter Vorschlag':'Unbestätigte Aussage'}</strong><p className="assistant-claim-text">{claim.text}</p>
   <details key={detailKey(detailed,i)} open={detailed}><summary>Herkunft und Quellen ({claim.evidenceRefs.length})</summary><p>{producerLabel(result.producer)} · {result.producer.role==='advisor'?'Beratung':result.producer.role==='specialist'?'Fachprüfung':'Lokale Hilfe'}</p>{claim.evidenceRefs.length?<ul>{claim.evidenceRefs.map((ref,j)=><li key={j}>{sourceName(ref)}</li>)}</ul>:<p>Ohne Quellenbezug; ausschließlich als Vorschlag prüfen.</p>}<p>Keine automatische Übernahme in Gedächtnis oder Konfiguration.</p></details>
  </li>)}</ul>}
 </section>;
}
const detailKey=(detailed:boolean,index:number)=>`${detailed}:${index}`;
