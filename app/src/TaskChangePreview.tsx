import {useEffect,useRef} from 'react';
import type {TaskChangePlan} from './task-change-preview.ts';
const fieldNames:Record<string,string>={title:'Titel',owner:'Owner',status:'Status',category:'Kategorie',priority:'Priorität',acceptance:'Abnahmekriterium',evidence:'Beleg',reviewed:'Review bestätigt',dependencies:'Abhängigkeiten',archived:'Archiviert'};
const display=(value:unknown):string=>typeof value==='boolean'?(value?'ja':'nein'):Array.isArray(value)?value.join(', ')||'keine':String(value??'');
/** Presentation only: this viewer has no store, transport or mutation callback. */
export function TaskChangePreview({plan}:{plan:TaskChangePlan}){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus()},[plan]);
 const title=(id:string)=>plan.before.tasks.find(t=>t.id===id)?.title??id;
 return <section className="task-change-preview" aria-label="Änderungsvorschau">
  <h3 ref={heading} tabIndex={-1}>Änderungsvorschau</h3>
  <p>Berechnet aus dem geladenen Arbeitsstand {plan.expectedUpdatedAt??'ohne gespeicherte Revision'}. Noch nichts gespeichert und keine Prüfung ausgeführt.</p>
  <p>Nur vorhandene Aufgabenabhängigkeiten und Missionszuordnungen sind bekannt. Repository-, Anbieter- und externe Auswirkungen sind nicht geprüft.</p>
  {plan.blockers.length>0&&<div role="alert"><h4>Übernahme gesperrt</h4><ul>{plan.blockers.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
  <h4>Diese Werte ändern sich</h4>
  {!plan.changes.length&&<p>Keine geänderten Aufgabenwerte.</p>}
  {plan.changes.map(change=>{const before=plan.before.tasks.find(t=>t.id===change.taskId)!,after=plan.next?.tasks.find(t=>t.id===change.taskId);return <article key={change.taskId}><strong>{title(change.taskId)}</strong><dl>{change.fields.map(field=><div key={field}><dt>{fieldNames[field]??field}</dt><dd><span>Vorher: {display(before[field as keyof typeof before])}</span><br/><span>Danach: {display(after?.[field as keyof typeof after])}</span></dd></div>)}</dl></article>})}
  <h4>Belegte Folgen und nächste Schritte</h4>
  {plan.affected.length===0&&<p>Keine abnahmerelevanten Folgen für andere Aufgaben über gespeicherte Kanten gefunden.</p>}
  <ul>{plan.affected.map(item=>{const task=plan.before.tasks.find(t=>t.id===item.taskId)!;return <li key={item.taskId}><strong>{title(item.taskId)}</strong><p>Ursache: {item.path.map(title).join(' → ')} (jeweils Voraussetzung der nächsten Aufgabe)</p><p>Erneut zu prüfen: {task.acceptance}</p><p>Bisheriger Beleg: {task.evidence||'Kein Beleg hinterlegt.'}</p><p>{item.reviewRequired?'Altes Review wird zurückgenommen. Nach Speicherung Abnahmekriterium und Beleg erneut gegenprüfen; erst danach Review bestätigen.':'Aufgabe bleibt unverändert. Ihr Abnahmekriterium gegen die geänderte Voraussetzung prüfen; es liegt kein altes Review zur Rücknahme vor.'}</p></li>})}</ul>
  {plan.changes.some(c=>c.taskId===plan.taskId&&c.fields.includes('reviewed')&&plan.before.tasks.find(t=>t.id===plan.taskId)?.reviewed)&&<p>Auch die geänderte Aufgabe braucht nach Speicherung eine neue Gegenprüfung. Diese Übernahme bestätigt kein neues Review.</p>}
  <ul>{plan.missions.map(item=>{const mission=plan.before.command.missions.find(m=>m.id===item.missionId)!;return <li key={item.missionId}><strong>Mission: {mission.title}</strong><p>Belegte Zuordnung: {item.taskPath.map(title).join(' → ')} → {mission.title}</p><p>{item.reviewRequired?`${mission.stage} → Review; Gegenprüfung bestätigt: nein. Zugeordnete Aufgaben erneut prüfen, danach Mission wieder abnehmen.`:'Missionswerte bleiben unverändert; die verknüpfte Aufgabe vor einer späteren Abnahme erneut prüfen.'}</p></li>})}</ul>
  <h4>Unverändert</h4><p>Historische Freigabekarten, Quellen, Räume, Projektgedächtnis und andere Arbeitsbereiche bleiben erhalten. Bestehende Freigaben erteilen durch diese Vorschau keine zusätzliche Erlaubnis.</p>
  {plan.missions.some(m=>m.reviewRequired)&&<p>Vor einer späteren externen Aktion deren konkrete Freigabe erneut auf Inhalt und Gültigkeit prüfen. Es wird keine Freigabekarte geändert oder neu genehmigt.</p>}
  <details><summary>{plan.unchangedTaskIds.length} Aufgabenwerte bleiben unverändert</summary><ul>{plan.unchangedTaskIds.map(id=><li key={id}>{title(id)}</li>)}</ul></details>
  <p>Beim Übernehmen werden ausschließlich die gezeigten Änderungen über den normalen lokalen Speichervorgang gespeichert. App-Ereignisse und Speicherzeit entstehen erst dabei.</p>
 </section>;
}
