'use client';
import { useMemo, useState } from 'react';
import { Copy, Download, ShieldCheck, FileCheck2, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createId } from '@/lib/ids';
import { buildCollaborationBrief, collaborationMarkdown, collaborationRegistry as registry, lowReportNote, parseLowReport, reportMatchesBrief } from '@/lib/collaboration-model';
import type { WorkState } from '@/lib/work-contract';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function CoordinationPanel({ work, known, disabled, save }: { work: WorkState; known: boolean; disabled: boolean; save: (work: WorkState) => Promise<boolean> }) {
  const [raw, setRaw] = useState('');
  const [checked, setChecked] = useState('');
  const personal = known ? work : undefined;
  const brief = useMemo(() => buildCollaborationBrief(personal), [personal]);
  const result = useMemo(() => {
    if (!checked) return null;
    try { return { report: parseLowReport(checked), error: '' }; } catch (e) { return { report: null, error: e instanceof Error ? e.message : 'Rückmeldung kann nicht geprüft werden.' }; }
  }, [checked]);
  const matched = !!result?.report && reportMatchesBrief(result.report, personal);
  async function copy() {
    try { await navigator.clipboard.writeText(collaborationMarkdown(personal)); toast.success('Arbeitsbrief kopiert. Er wurde noch nicht gesendet.'); }
    catch { toast.error('Kopieren nicht verfügbar. Nutze den Datei-Export.'); }
  }
  async function keep(historical = false) {
    if (!result?.report || (!matched && !historical) || (matched && historical) || !known || disabled) return;
    try {
      const text = lowReportNote(result.report, historical ? 'historical' : 'current');
      if (work.notes.some(n => n.text === text)) { toast.info('Diese ungeprüfte Rückmeldung ist bereits gespeichert.'); return; }
      if (work.notes.length >= 100) throw new Error('Notizgrenze erreicht. Sichere zuerst deinen Arbeitsstand.');
      if (await save({ ...work, notes: [{ id: createId(), text, createdAt: new Date().toISOString() }, ...work.notes] })) { setChecked(''); setRaw(''); toast.success('Als ungeprüfte Rückmeldung gespeichert. Kein Auftrag oder Status wurde automatisch geändert.'); }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Speicherung fehlgeschlagen.'); }
  }
  return <section className="panel coordination-panel" aria-labelledby="coordination-title">
    <span className="eyebrow">GETRENNTE VERANTWORTUNG · EINE ÜBERGABE</span>
    <h2 id="coordination-title">Codex & Low: gemeinsam weiterarbeiten</h2>
    <div className="info-line"><ShieldCheck size={20} /><p>Arbeitsbrief vorbereitet. Lows Identität, Verbindung und Annahme sind noch nicht bestätigt. Kopieren oder Exportieren sendet keinen Auftrag.</p></div>
    <div className="help-grid">{Object.entries(registry.roles).map(([id, role]) => <article key={id}><h3>{role.name}</h3><p>{role.niche}</p><p className="short-note"><GitBranch size={15} aria-hidden="true" /> {role.branchPrefix}… · eigenes Worktree</p><details><summary>Dateigrenzen für {role.name}</summary><ul>{role.ownedPaths.map(p => <li key={p}><code>{p}</code></li>)}</ul></details></article>)}</div>
    <p className="short-note">Gerätebefund: {new Date(registry.remoteObservation.observedAt).toLocaleString('de-DE')} · zwei Remote-Geräte offline gemeldet. Dieser datierte Befund wird hier nicht live aktualisiert.</p>
    <div className="actions-row"><Button disabled={!known || disabled} onClick={copy}><Copy size={16} />Low-Arbeitsbrief kopieren</Button><Button variant="outline" disabled={!known || disabled} onClick={() => download('mesh-low-arbeitsbrief.json', JSON.stringify(brief, null, 2), 'application/json')}><Download size={16} />Brief als JSON</Button></div>
    {!known && <p role="status">Der persönliche Kontext ist noch nicht geladen. Export bleibt gesperrt.</p>}
    <details><summary>Privater MCP-Leseweg und Ablauf</summary><p>Ein unterstützter Client kann nach eigener Anmeldung <code>{registry.mcp.tool}</code> abrufen. Ein veröffentlichter Endpunkt bestätigt keine Verbindung zu Low.</p><p><code>{registry.mcp.url}</code></p><ol>{registry.rules.map(rule => <li key={rule}>{rule}</li>)}</ol></details>
    <details><summary>Arbeitsbrief prüfen</summary><pre>{JSON.stringify(brief, null, 2)}</pre></details>
    <details><summary>Rückmeldung von Low zuordnen</summary><p>Füge eine tatsächlich erhaltene LowReport-JSON ein. Wir prüfen Format, Briefbindung und Dateigrenzen. Absenderidentität, Source-HEAD und Tests müssen anschließend unabhängig geprüft werden.</p>
      <label htmlFor="low-report">Erhaltene Rückmeldung als JSON</label><Textarea id="low-report" value={raw} onChange={e => { setRaw(e.target.value); setChecked(''); }} maxLength={24000} rows={8} spellCheck={false} />
      <div className="actions-row"><Button variant="outline" disabled={!raw.trim() || !known} onClick={() => setChecked(raw)}><FileCheck2 size={16} />Rückmeldung prüfen</Button></div>
      {result?.error && <p role="alert" className="short-note">{result.error}</p>}
      {result?.report && <div role="status"><strong>{matched ? 'Format und aktueller Brief passen · Inhalt ungeprüft' : 'Abweichender Arbeitsbrief · nur historische Aufbewahrung'}</strong><p>Gemeldeter Stand: {result.report.status}. {result.report.summary}</p><p>Gemeldeter Basiscommit: <code>{result.report.baseCommit}</code>. Noch nicht mit dem aktuellen Remote-HEAD abgeglichen.</p><p>{result.report.tests.length} gemeldete Prüfungen · {result.report.changedFiles.length} gemeldete Dateien. Prüfkommandos werden niemals automatisch ausgeführt.</p><div className="actions-row"><Button disabled={!matched || disabled || !known} variant="outline" onClick={() => keep()}>Als ungeprüfte Notiz speichern</Button>{!matched && <Button disabled={disabled || !known} variant="outline" onClick={() => keep(true)}>Historisch als ungeprüfte Notiz sichern</Button>}</div></div>}
    </details>
    {work.notes.some(n => n.text.startsWith('LOW · manuell übernommene Rückmeldung')) && <details><summary>Gespeicherte Rückmeldungen · weiterhin ungeprüft</summary>{work.notes.filter(n => n.text.startsWith('LOW · manuell übernommene Rückmeldung')).slice(0, 3).map(n => <article key={n.id}><p>{new Date(n.createdAt).toLocaleString('de-DE')} · eigene Übernahme, kein Identitätsnachweis</p><pre>{n.text}</pre></article>)}</details>}
  </section>;
}
