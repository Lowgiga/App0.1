import {useEffect,useRef,useState} from 'react';
import type {AssistantPreview} from '../assistant/use-assistant-session.ts';
import type {AssistantRuntimeResult} from '../assistant/runtime.ts';
import {useFiniteMotion,type PresentationMotionMode} from '../motion/use-finite-motion.ts';

import {AssistantAdvice} from './AssistantAdvice.tsx';
import {producerLabel} from '../assistant/provenance.ts';

type Props={preview:AssistantPreview;review:AssistantRuntimeResult|null;checked:boolean;busy:boolean;blocked:boolean;motion?:PresentationMotionMode;powerSaver?:boolean;onReview:()=>void;onCommit:()=>void;onCancel:()=>void};
/** Pure UI callbacks. No transport or authority is passed to a model adapter. */
export function AssistantConfigPreview({preview,review,checked,busy,blocked,motion='off',powerSaver=false,onReview,onCommit,onCancel}:Props){
 const heading=useRef<HTMLHeadingElement>(null),[expired,setExpired]=useState(()=>Date.now()>=Date.parse(preview.expiresAt));
 useEffect(()=>{heading.current?.focus();const remaining=Date.parse(preview.expiresAt)-Date.now();setExpired(remaining<=0);if(remaining<=0)return;const timer=setTimeout(()=>setExpired(true),remaining);return()=>clearTimeout(timer)},[preview]);
 const p=preview.proposal,disabled=busy||blocked||expired;
 const surface=useRef<HTMLElement>(null);
 useFiniteMotion(surface,{eventKey:preview.proposal.id,kind:'surface',mode:motion,powerSaver,enabled:!disabled});
 return <section ref={surface} className="assistant-preview" aria-label="Assistenten-Konfigurationsvorschau" data-stage={checked?'checked':'preview'}>
  <div className="assistant-step-tag">02 · ÄNDERUNG PRÜFEN</div>
  <h3 ref={heading} tabIndex={-1}>Diese eine Änderung prüfen</h3>
  <p className="assistant-diff"><span>Fortsetzungskarte</span><strong>{p.before.continuation.detail} → {p.after.continuation.detail}</strong></p>
  <dl><dt>Nutzen</dt><dd>{p.effect.benefit}</dd><dt>Wirkung</dt><dd>{p.effect.sideEffect}</dd><dt>Basis</dt><dd>Gedächtnis {p.basis.memoryRevision} · Konfiguration {p.basis.configRevision}</dd></dl>
  <p>Die Änderung betrifft die Erklärungstiefe dieser Karte. Sie bestätigt keine Projektentscheidung und erteilt keine Ausführungsrechte.</p>
  <details><summary>Konkrete Vorschau und Hash</summary><dl><dt>Vorschau-ID</dt><dd>{p.id}</dd><dt>SHA-256</dt><dd data-assistant-hash>{preview.proposalHash}</dd><dt>Gültig bis</dt><dd><time dateTime={preview.expiresAt}>{new Date(preview.expiresAt).toLocaleTimeString('de-DE')}</time></dd></dl></details>
  {expired&&<p role="alert">Die Vorschau ist abgelaufen. Verwerfen und eine neue Vorschau erzeugen.</p>}
  {checked&&<div className="assistant-check-proof"><strong>Deterministische Prüfung bestanden</strong><p>Kontext, Basisrevisionen und erlaubte Feldänderung wurden lokal erneut geprüft. Vor dem Commit werden sie nochmals geprüft.</p></div>}
  {review&&<details><summary>Zusätzliche Fachberatung · {producerLabel(review.producer)}</summary><p>{review.summary}</p><AssistantAdvice result={review} config={p.before}/><p>Diese Beratung ist kein ausgeführter Build, Modelltest oder externer Nachweis.</p></details>}
  <div className="assistant-actions">
   {checked?<button type="button" className="assistant-primary" disabled={disabled} onClick={onCommit}><span className="lq-button-visual">Genau diese Änderung übernehmen</span></button>:<button type="button" className="assistant-primary" disabled={disabled} onClick={onReview}><span className="lq-button-visual">{busy?'Wird geprüft …':'Vorschlag prüfen'}</span></button>}
   <button type="button" disabled={busy} onClick={onCancel}>Vorschau verwerfen</button>
  </div>
 </section>;
}
