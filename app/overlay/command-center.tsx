'use client';
import {saveTextFile,copyWithFeedback,copyPlatformText} from '../src/platform/runtime';

import { useEffect, useState, type ReactNode } from 'react';
import { Plus, ShieldCheck, Copy, Archive, FileCheck2, Activity, Settings2, Target, MessageSquare, ClipboardList, CheckCircle2, Circle, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { missionContract, approvalContract, approvalState, stageNames, stageTransitions, type Mission, type Approval } from '@/lib/command-contract';
import { agentNames, projectIds } from '@/lib/work-constants';
import type { WorkState } from '@/lib/work-contract';
import { createId } from '@/lib/ids';
import { calculateNeuroScore } from '@/lib/neuro';

type Source = { id: string; title: string; status: string; file: string };
type SnapshotAgent = { id: string; initials: string; color: string; role: string; description: string };
type Props = {
  active?: boolean;
  section: 'missions' | 'approvals' | 'activity' | 'agents'; work: WorkState; disabled: boolean;
  save: (next: WorkState) => Promise<boolean>; data: { sources: Source[]; agents: SnapshotAgent[]; updatedAt: string };
  query: string; go: (view: 'missions' | 'approvals' | 'activity' | 'matrix' | 'chats') => void;
  configure: (agent: string) => void;
  unavailable?: boolean;
};
const projects: Record<typeof projectIds[number], string> = { paz: 'PAZ', make: 'Make', cue: 'Cue Mesh', hermes: 'Hermes', custom: 'Eigene Mission' };
const riskNames = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' };
const decisionNames = { pending: 'Offen', approved: 'Dokumentiert', denied: 'Abgelehnt', expired: 'Abgelaufen' };

export default function CommandCenter(props: Props) {
  if (props.section === 'agents') return <AgentWorkspaces {...props} />;
  if (props.section === 'approvals') return <ApprovalCenter {...props} />;
  if (props.section === 'activity') return <EventStream {...props} />;
  return <MissionCenter {...props} />;
}

function MissionCenter({ work, disabled, save, data, query, go, unavailable, active = true }: Props) {
  const [draft, setDraft] = useState<Mission | null>(null);
  const [archived, setArchived] = useState(false);
  const [filter, setFilter] = useState('all');
  const current = work.command.missions.find(m => m.id === draft?.id);
  const missions = work.command.missions.filter(m => m.archived === archived && (filter === 'all' || m.stage === filter) &&
    [m.title, m.goal, projects[m.project], agentNames[m.owner], m.checkpoint].join(' ').toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.priority.localeCompare(b.priority) || b.createdAt.localeCompare(a.createdAt));
  const done = work.command.missions.filter(m => m.stage === 'Done').length;
  function create() {
    setDraft({ id: createId(), title: '', goal: '', scope: 'Lesen, planen und Ergebnis prüfen.', project: 'custom', owner: 'manus', reviewer: 'junior', stage: 'Created', priority: 'P1', output: 'Ergebnis, konkrete Belege und Checkpoint', taskIds: [], roomId: null, sourceIds: [], evidence: '', reviewed: false, checkpoint: '', archived: false, createdAt: new Date().toISOString(), deadlineAt: null, neuro_profile: calculateNeuroScore({kind:'mission',stage:'Created',priority:'P1'}) });
  }
  async function commit() {
    if (!draft) return;
    const result = missionContract.safeParse(draft);
    if (!result.success) { toast.error(result.error.issues[0].message); return; }
    const missions = current ? work.command.missions.map(m => m.id === draft.id ? draft : m) : [...work.command.missions, draft];
    if (await save({ ...work, command: { ...work.command, missions } })) { setDraft(null); toast.success('Mission gespeichert.'); }
  }
  const valid = draft && missionContract.safeParse(draft).success;
  const set = <K extends keyof Mission>(key: K, value: Mission[K]) => setDraft(m => m ? { ...m, [key]: value } : m);
  const locked = draft && ['Approved', 'Done'].includes(draft.stage);
  return <>
    <div className="command-summary"><div><span className="eyebrow">DEIN AUFTRAG. EIN ZUSTAND.</span><h2>{unavailable ? '—' : work.command.missions.length} Missionen<span>{unavailable ? 'Arbeitsstand nicht geladen' : done + ' abgeschlossen'}</span></h2></div><Button onClick={create} disabled={work.command.missions.length >= 30}><Plus size={17} />Mission anlegen</Button></div>
    <p className="short-note">Die Phasen sind dein dokumentierter App-Arbeitsstand. Sie melden keine Live-Aktivität entfernter Agenten.</p>
    <div className="filter-bar"><Select label="Missionsphase filtern" value={filter} onChange={setFilter} options={[["all", "Alle Phasen"], ...Object.entries(stageNames)]} /><Button variant="outline" aria-pressed={archived} onClick={() => setArchived(!archived)}><Archive size={16} />{archived ? 'Aktive Missionen' : 'Archiv'}</Button><span className="search-result">{missions.length} Treffer</span></div>
    <div className="mission-grid">{missions.map(m => {
      const tasks = work.tasks.filter(t => m.taskIds.includes(t.id));
      const pending = work.command.approvals.filter(a => a.missionId === m.id && a.status === 'pending').length;
      return <button className="panel mission-record" key={m.id} onClick={() => setDraft({ ...m, taskIds: [...m.taskIds], sourceIds: [...m.sourceIds] })}>
        <div className="task-top"><span className="pill neutral">{projects[m.project]} · {m.priority}</span><Stage stage={m.stage} /></div><h3>{m.title}</h3><p>{m.goal}</p>
        <div className="mission-people"><span><Target size={14} />{agentNames[m.owner]}</span><span><ShieldCheck size={14} />{agentNames[m.reviewer]}</span></div>
        <div className="mission-record-foot"><span><ClipboardList size={14} />{tasks.filter(t => t.status === 'Erledigt').length}/{tasks.length} Aufgaben</span><span><FileCheck2 size={14} />{pending} offene Entscheidungen</span></div>
        {m.checkpoint && <small className="checkpoint-excerpt">{m.checkpoint}</small>}
      </button>;
    })}</div>
    {!missions.length && <Empty icon={<Target size={27} />} title={unavailable ? 'Arbeitsstand nicht geladen · Entwurf vorbereiten' : query || filter !== 'all' ? 'Keine passende Mission' : archived ? 'Das Missionsarchiv ist leer' : 'Aus einer Idee wird eine klare Mission.'} text="Ziel, Umfang, Owner und Ergebnis festlegen. Dann passende Aufgaben, Quellen und einen Missionraum zuordnen." action={!query && filter === 'all' && !archived ? <Button onClick={create}><Plus size={16} />Erste Mission vorbereiten</Button> : undefined} />}
    <Sheet open={active && !!draft} onOpenChange={open => { if (active && !open) setDraft(null); }}><SheetContent className="mesh-sheet command-sheet"><SheetHeader><SheetTitle>{current ? 'Mission bearbeiten' : 'Neue Mission'}</SheetTitle><SheetDescription>Phase, Quellen und Abschluss gemeinsam prüfen. Ein Statuswechsel führt keine Agentenaktion aus.</SheetDescription></SheetHeader>
      {draft && <div className="sheet-body"><div className="phase-strip" aria-label="Missionsphase"><Stage stage={draft.stage} /><span>{current ? 'Gespeicherte Mission' : 'Noch nicht gespeichert'}</span></div>
        <Field label="Missionstitel"><Input aria-label="Missionstitel" value={draft.title} maxLength={150} disabled={!!locked} onChange={e => set('title', e.target.value)} placeholder="z. B. PAZ · Konfiguration prüfen" /></Field>
        <Field label="Konkretes Ziel"><Textarea aria-label="Missionsziel" value={draft.goal} maxLength={2000} disabled={!!locked} onChange={e => set('goal', e.target.value)} /></Field>
        <Field label="Umfang und Grenzen"><Textarea aria-label="Missionsumfang" value={draft.scope} maxLength={1500} disabled={!!locked} onChange={e => set('scope', e.target.value)} /></Field>
        <div className="form-grid"><Field label="Projekt"><Select label="Missionsprojekt" value={draft.project} disabled={!!locked} onChange={v => set('project', v as Mission['project'])} options={Object.entries(projects)} /></Field>
          <Field label="Priorität"><Select label="Missionspriorität" value={draft.priority} disabled={!!locked} onChange={v => set('priority', v as Mission['priority'])} options={['P0', 'P1', 'P2'].map(v => [v, v])} /></Field>
          <Field label="Verantwortlicher Agent"><Select label="Missionsowner" value={draft.owner} disabled={!!locked} onChange={v => set('owner', v as Mission['owner'])} options={Object.entries(agentNames)} /></Field>
          <Field label="Unabhängiger Reviewer"><Select label="Missionsreviewer" value={draft.reviewer} disabled={!!locked} onChange={v => set('reviewer', v as Mission['reviewer'])} options={Object.entries(agentNames)} /></Field>
          <Field label="Nächste Phase"><Select label="Missionsphase" value={draft.stage} onChange={v => setDraft(m => m ? { ...m, stage: v as Mission['stage'], reviewed: v === 'Review' && ['Done', 'Approved'].includes(current?.stage || '') ? false : m.reviewed } : m)} options={(current ? [current.stage, ...stageTransitions[current.stage]] : ['Created']).map(s => [s, stageNames[s as Mission['stage']]])} /></Field>
          <Field label="Missionraum"><Select label="Verknüpfter Missionraum" value={draft.roomId || ''} disabled={!!locked} onChange={v => set('roomId', v || null)} options={[["", "Kein Raum"], ...work.rooms.map(r => [r.id, r.title])]} /></Field>
        </div>
        {locked && <p className="short-note">Für inhaltliche Änderungen zuerst zurück in die Gegenprüfung wechseln. Die bisherige Abnahme bleibt im Ereignisverlauf.</p>}
        <Field label="Erwartetes Ergebnis"><Input aria-label="Missionsergebnis" value={draft.output} maxLength={500} disabled={!!locked} onChange={e => set('output', e.target.value)} /></Field>
        <fieldset className="command-references" disabled={!!locked}><legend>Zugeordnete Aufgaben · {draft.taskIds.length}/20</legend><div className="dependency-list">{work.tasks.map(t => <label key={t.id}><Checkbox checked={draft.taskIds.includes(t.id)} disabled={!!locked || (!draft.taskIds.includes(t.id) && draft.taskIds.length >= 20)} onCheckedChange={v => set('taskIds', v ? [...draft.taskIds, t.id] : draft.taskIds.filter(id => id !== t.id))} /><span>{t.title}<small>{t.status}{t.archived ? ' · Archiv' : ''}</small></span></label>)}</div></fieldset>
        <fieldset className="command-references" disabled={!!locked}><legend>Gezielter Quellenkontext</legend><div className="dependency-list">{data.sources.map(s => <label key={s.id}><Checkbox checked={draft.sourceIds.includes(s.id)} disabled={!!locked} onCheckedChange={v => set('sourceIds', v ? [...draft.sourceIds, s.id] : draft.sourceIds.filter(id => id !== s.id))} /><span>{s.title}<small>Snapshot · {s.status === 'verified' ? 'lesend belegt' : 'übergeben / gemeldet'}</small></span></label>)}</div></fieldset>
        <Field label="Konkreter Abschlussbeleg"><Textarea aria-label="Missionsbeleg" value={draft.evidence} maxLength={3000} disabled={!!locked} onChange={e => set('evidence', e.target.value)} placeholder="Tatsächlich ausgeführte Prüfung, Datei oder erhaltenes Review nennen …" /></Field>
        <label className="command-check"><Checkbox disabled={!!locked} checked={draft.reviewed} onCheckedChange={v => set('reviewed', v === true)} /><span>Gegenprüfung dokumentiert<small>Eigener Vermerk über ein erhaltenes Review. Die App führt kein Agentenreview aus.</small></span></label>
        <Field label="Optionaler Termin · Gerätezeit"><Input aria-label="Missionstermin" type="datetime-local" disabled={!!locked} value={draft.deadlineAt?localDate(draft.deadlineAt):''} onChange={e=>{if(!e.target.value)set('deadlineAt',null);else{const d=new Date(e.target.value);if(Number.isFinite(d.getTime()))set('deadlineAt',d.toISOString())}}}/></Field>
        <Field label="Letzter sicherer Fortsetzungspunkt"><Textarea aria-label="Missionscheckpoint" value={draft.checkpoint} maxLength={3000} disabled={!!locked} onChange={e => set('checkpoint', e.target.value)} placeholder="Was ist erledigt, was fehlt und welches ist der nächste konkrete Schritt?" /></Field>
        <label className="command-check"><Checkbox checked={draft.archived} onCheckedChange={v => set('archived', v === true)} /><span>Mission im Archiv ablegen</span></label>
        <div className="actions-row"><Button disabled={disabled || !valid} onClick={commit}>Mission speichern</Button><Button variant="outline" onClick={() => copy(missionHandoff(draft, work, data.sources))}><Copy size={16} />Hand-off kopieren</Button></div>
        <div className="actions-row"><Button variant="ghost" onClick={() => go('matrix')}><ClipboardList size={15} />Aufgabenmatrix</Button><Button variant="ghost" onClick={() => go('chats')}><MessageSquare size={15} />Missionräume</Button></div>
        {current && <EntityEvents work={work} id={current.id} />}
      </div>}
    </SheetContent></Sheet>
  </>;
}

function ApprovalCenter({ work, disabled, save, query, unavailable, active = true }: Props) {
  const [draft, setDraft] = useState<Approval | null>(null);
  const [decision, setDecision] = useState<Approval | null>(null);
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState('pending');
  const now = useClock();
  const current = work.command.approvals.find(a => a.id === draft?.id);
  const approvals = work.command.approvals.filter(a => (filter === 'all' || approvalState(a, now) === filter) &&
    [a.action, a.target, a.reason].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  function create(template?: Approval) {
    setDraft({ id: createId(), missionId: null, action: '', target: '', dataSummary: '', reason: '', expectedResult: '', risk: 'medium', reversibility: 'partial', impact: '', testEvidence: '', rollback: '', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), status: 'pending', scope: 'once', decidedAt: null, decisionNote: '', executed: false,
      ...(template ? { missionId: template.missionId, action: template.action, target: template.target, dataSummary: template.dataSummary, reason: template.reason, expectedResult: template.expectedResult, risk: template.risk, reversibility: template.reversibility, impact: template.impact, testEvidence: template.testEvidence, rollback: template.rollback, scope: template.scope } : {}) });
  }
  const set = <K extends keyof Approval>(key: K, value: Approval[K]) => setDraft(a => a ? { ...a, [key]: value } : a);
  async function commit() {
    if (!draft) return;
    const valid = approvalContract.safeParse(draft);
    if (!valid.success) { toast.error(valid.error.issues[0].message); return; }
    const approvals = current ? work.command.approvals.map(a => a.id === draft.id ? draft : a) : [...work.command.approvals, draft];
    if (await save({ ...work, command: { ...work.command, approvals } })) { setDraft(null); toast.success('Freigabeanfrage gespeichert.'); }
  }
  async function decide(status: 'approved' | 'denied') {
    if (!decision) return;
    const next = { ...decision, status, decidedAt: new Date().toISOString(), decisionNote: note.trim() };
    const valid = approvalContract.safeParse(next);
    if (!valid.success) { toast.error(valid.error.issues[0].message); return; }
    if (await save({ ...work, command: { ...work.command, approvals: work.command.approvals.map(a => a.id === decision.id ? next : a) } })) {
      setDecision(null); setNote(''); toast.success(status === 'approved' ? 'Entscheidung dokumentiert. Keine Aktion ausgeführt.' : 'Anfrage abgelehnt.');
    }
  }
  const immutable = draft?.status !== 'pending';
  const valid = draft && approvalContract.safeParse(draft).success && Date.parse(draft.expiresAt) > now;
  return <>
    <div className="info-line"><LockKeyhole size={21} /><div>Hier prüfst und dokumentierst du konkrete Entscheidungen. Ein Eintrag schaltet keine entfernten Rechte frei und startet keine Aktion.</div></div>
    <div className="command-summary"><div><span className="eyebrow">KLARER INHALT. KLARE ENTSCHEIDUNG.</span><h2>Freigabezentrale<span>{unavailable ? 'Arbeitsstand nicht geladen' : work.command.approvals.filter(a => approvalState(a, now) === 'pending').length + ' offene Anfragen'}</span></h2></div><Button disabled={work.command.approvals.length >= 60} onClick={() => create()}><Plus size={17} />Anfrage vorbereiten</Button></div>
    <div className="filter-bar"><Select label="Entscheidungsstatus filtern" value={filter} onChange={setFilter} options={[["all", "Alle Anfragen"], ...Object.entries(decisionNames)]} /><span className="search-result">{approvals.length} Treffer</span></div>
    <div className="approval-grid">{approvals.map(a => <article key={a.id} className={'panel approval-card risk-' + a.risk}><div className="task-top"><span className={'pill ' + (a.risk === 'high' ? 'red' : 'amber')}>Risiko {riskNames[a.risk]}</span><span className={'pill ' + (approvalState(a, now) === 'approved' ? 'green' : 'neutral')}>{decisionNames[approvalState(a, now)]}</span></div><h3>{a.action}</h3><p>{a.reason}</p><dl className="approval-facts"><dt>Ziel</dt><dd>{a.target}</dd><dt>Ergebnis</dt><dd>{a.expectedResult}</dd><dt>Mission</dt><dd>{work.command.missions.find(m => m.id === a.missionId)?.title || 'Eigenständige Anfrage'}</dd><dt>Ablauf</dt><dd>{date(a.expiresAt)}</dd></dl>
      <div className="actions-row"><Button variant="outline" onClick={() => setDraft(a)}>Details {a.status === 'pending' ? '& Entwurf' : 'ansehen'}</Button>{a.status === 'pending' && <Button onClick={() => { setDecision(a); setNote(''); }}>{approvalState(a, now) === 'expired' ? 'Anfrage schließen' : 'Anfrage prüfen'}</Button>}{(a.status !== 'pending' || approvalState(a, now) === 'expired') && <Button variant="ghost" disabled={work.command.approvals.length >= 60} onClick={() => create(a)}>Neue Anfrage daraus</Button>}</div><small className="approval-foot"><ShieldCheck size={13} />Ausführung: nicht gestartet</small>
    </article>)}</div>
    {!approvals.length && <Empty icon={<FileCheck2 size={28} />} title={unavailable ? 'Entscheidungsstand nicht geladen' : filter === 'pending' ? 'Keine offenen Entscheidungen' : 'Keine passende Anfrage'} text="Bereite eine konkrete Aktion mit Ziel, Datenumfang, Risiko, Prüfbeleg und Rückweg vor. Die Entscheidung bleibt an diesen Inhalt gebunden." />}
    <Sheet open={active && !!draft} onOpenChange={open => { if (active && !open) setDraft(null); }}><SheetContent className="mesh-sheet command-sheet"><SheetHeader><SheetTitle>{immutable ? 'Dokumentierte Entscheidung' : 'Freigabeanfrage vorbereiten'}</SheetTitle><SheetDescription>Entschiedene Inhalte bleiben unveränderlich. Für Änderungen eine neue Anfrage erstellen.</SheetDescription></SheetHeader>{draft && <div className="sheet-body">
      <Field label="Exakte Aktion"><Input aria-label="Freigabeaktion" value={draft.action} maxLength={300} disabled={immutable} onChange={e => set('action', e.target.value)} /></Field><Field label="Zielsystem oder Empfänger"><Input aria-label="Freigabeziel" value={draft.target} maxLength={300} disabled={immutable} onChange={e => set('target', e.target.value)} /></Field>
      <div className="form-grid"><Field label="Zugehörige Mission"><Select label="Freigabemission" value={draft.missionId || ''} disabled={immutable} onChange={v => set('missionId', v || null)} options={[["", "Eigenständige Anfrage"], ...work.command.missions.map(m => [m.id, m.title])]} /></Field><Field label="Geltungsbereich der Notiz"><Select label="Freigabegeltung" value={draft.scope} disabled={immutable} onChange={v => set('scope', v as Approval['scope'])} options={[["once", "Einmalige Entscheidung"], ["mission", "Für diese Mission"], ["session", "Für diese Sitzung"]]} /></Field><Field label="Risiko"><Select label="Freigaberisiko" value={draft.risk} disabled={immutable} onChange={v => set('risk', v as Approval['risk'])} options={Object.entries(riskNames)} /></Field><Field label="Rückgängig machbar"><Select label="Freigabereversibilität" value={draft.reversibility} disabled={immutable} onChange={v => set('reversibility', v as Approval['reversibility'])} options={[["yes", "Ja"], ["partial", "Teilweise"], ["no", "Nein"]]} /></Field></div>
      {([['dataSummary', 'Betroffene Daten', 1000], ['reason', 'Warum diese Aktion?', 1500], ['expectedResult', 'Erwartetes Ergebnis', 1000], ['impact', 'Auswirkungen', 1000], ['testEvidence', 'Prüfbeleg', 2000], ['rollback', 'Rückweg / Stoppen', 1500]] as const).map(([key, label, max]) => <Field key={key} label={label}><Textarea aria-label={label} value={draft[key]} maxLength={max} disabled={immutable} onChange={e => set(key, e.target.value)} /></Field>)}
      <Field label="Ablaufdatum · Gerätezeit"><Input aria-label="Freigabeablauf" type="datetime-local" disabled={immutable} value={localDate(draft.expiresAt)} onChange={e => { const time = new Date(e.target.value); if (Number.isFinite(time.getTime())) set('expiresAt', time.toISOString()); }} /></Field>
      <p className="short-note">Mission und Sitzung beschreiben den Geltungsbereich dieses Vermerks. Es wird kein Ausführungstoken und keine dauerhafte Berechtigung erzeugt.</p>
      {!immutable ? <Button disabled={disabled || !valid} onClick={commit}>Anfrage speichern</Button> : <><div className="info-line"><LockKeyhole size={17} /><div>{decisionNames[draft.status]} · {draft.decidedAt && date(draft.decidedAt)}<p>{draft.decisionNote || 'Kein zusätzlicher Entscheidungsvermerk.'}</p></div></div><Button variant="outline" onClick={() => create(draft)}>Neue Anfrage daraus</Button></>}
      {current && <EntityEvents work={work} id={current.id} />}
    </div>}</SheetContent></Sheet>
    <Sheet open={active && !!decision} onOpenChange={open => { if (active && !open) setDecision(null); }}><SheetContent className="mesh-sheet command-sheet"><SheetHeader><SheetTitle>Konkrete Anfrage prüfen</SheetTitle><SheetDescription>Deine Entscheidung dokumentiert genau den gespeicherten Inhalt. Es wird keine externe Aktion ausgelöst.</SheetDescription></SheetHeader>{decision && <div className="sheet-body"><span className={'pill ' + (decision.risk === 'high' ? 'red' : 'amber')}>Risiko {riskNames[decision.risk]}</span><h2>{decision.action}</h2><dl className="decision-detail">{[['Ziel', decision.target], ['Daten', decision.dataSummary], ['Begründung', decision.reason], ['Ergebnis', decision.expectedResult], ['Auswirkung', decision.impact], ['Prüfbeleg', decision.testEvidence || 'Noch kein Prüfbeleg'], ['Rückweg', decision.rollback || 'Noch kein Rückweg'], ['Ablauf', date(decision.expiresAt)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><Field label="Dein Entscheidungsvermerk"><Textarea aria-label="Entscheidungsvermerk" value={note} maxLength={1500} onChange={e => setNote(e.target.value)} /></Field><div className="actions-row"><Button disabled={disabled || approvalState(decision, now) === 'expired' || decision.testEvidence.trim().length < 12 || decision.rollback.trim().length < 8} onClick={() => decide('approved')}>Entscheidung dokumentieren</Button><Button variant="outline" disabled={disabled} onClick={() => decide('denied')}>Ablehnen</Button></div><p className="short-note">Dokumentieren braucht einen konkreten Prüfbeleg und Rückweg. Die Entscheidungszeit wird vom Server festgehalten. Ausführung bleibt aus.</p></div>}</SheetContent></Sheet>
  </>;
}

function AgentWorkspaces({ work, data, configure, go, query, unavailable }: Props) {
  const profiles = work.profiles.filter(p => [agentNames[p.id], p.role, p.instructions, p.output, p.mode].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <><div className="info-line"><ShieldCheck size={21} /><div>Vier Arbeitsbereiche dieser App: drei vorhandene Cue-Rollen plus ChatGPT/Codex. Der Arbeitsstand entsteht aus deinen Missionen, nicht aus entfernter Agenten-Telemetrie.</div></div><div className="workspace-agent-grid">{profiles.map(p => {
    const snapshot = data.agents.find(a => a.id === p.id);
    const missions = work.command.missions.filter(m => !m.archived && m.owner === p.id && m.stage !== 'Done');
    const reviews = work.command.missions.filter(m => !m.archived && m.reviewer === p.id && m.stage === 'Review');
    const pending = work.command.approvals.filter(a => a.status === 'pending' && missions.some(m => m.id === a.missionId)).length;
    const active = missions.find(m => m.stage === 'Working') || missions.find(m => ['Blocked', 'Error', 'Waiting'].includes(m.stage)) || missions[0];
    return <section key={p.id} className="panel workspace-agent"><div className="workspace-agent-head"><span className="avatar" style={{ background: snapshot?.color || '#617c93' }}>{snapshot?.initials || 'CX'}</span><div><h2>{agentNames[p.id]}</h2><p>{p.role}</p></div><span className={'pill ' + (reviews.length ? 'amber' : active?.stage === 'Blocked' ? 'red' : 'neutral')}>{unavailable ? 'Arbeitsstand unbekannt' : reviews.length ? 'Review offen' : active ? stageNames[active.stage] : 'Keine aktive Mission'}</span></div>
      <p className="workspace-instruction">{p.instructions}</p><div className="workspace-mini-metrics"><div><strong>{unavailable ? '—' : missions.length}</strong><span>Missionen</span></div><div><strong>{unavailable ? '—' : reviews.length}</strong><span>Reviews</span></div><div><strong>{unavailable ? '—' : pending}</strong><span>Entscheidungen</span></div></div>
      <div className="workspace-output"><span className="eyebrow">ERWARTETES ERGEBNIS</span><p>{p.output}</p></div><div className="workspace-limits"><span>{p.mode}</span><span>Delegation ≤ {p.maxDelegation}</span><span>Vorgabe: {p.callBudget} Aufrufe / {p.timeBudget} min</span></div>
      {active && <button className="workspace-current" onClick={() => go('missions')}><Target size={17} /><span><strong>{active.title}</strong><small>{active.checkpoint || active.goal}</small></span></button>}
      <div className="actions-row"><Button variant="outline" onClick={() => configure(p.id)}><Settings2 size={16} />Profil konfigurieren</Button><Button variant="ghost" onClick={() => go('missions')}>Missionen ansehen</Button></div><small>Budgets sind Vorgaben; tatsächlicher Verbrauch unbekannt.</small>
    </section>;
  })}</div>{!profiles.length && <Empty icon={<ShieldCheck size={27} />} title="Kein passender Agentenbereich" text="Nach Name, Rolle, Vorgaben oder Ausgabeformat suchen." />}</>;
}

function EventStream({ work, data, query, unavailable }: Props) {
  const [filter, setFilter] = useState('all');
  const events = [...work.command.events].reverse().filter(e => (filter === 'all' || (filter === 'missions' ? e.kind.startsWith('mission-') : filter === 'approvals' ? e.kind.startsWith('approval-') : e.kind === 'workspace-updated')) && e.title.toLowerCase().includes(query.toLowerCase()));
  return <><div className="command-summary"><div><span className="eyebrow">EIGENE APP-ÄNDERUNGEN</span><h2>Ein nachvollziehbarer Verlauf<span>{unavailable ? 'Verlauf nicht geladen' : work.command.events.length + '/200 Ereignisse'}</span></h2></div><span className="pill neutral"><Activity size={13} />App-Protokoll</span></div><p className="short-note">Nach akzeptierten Änderungen gemeinsam mit deinem Zustand gespeichert. Keine Agenten-Live-Telemetrie. Der separate Quellenstand stammt vom {data.updatedAt}.</p><div className="filter-bar"><Select label="Ereignisart filtern" value={filter} onChange={setFilter} options={[["all", "Alle Ereignisse"], ["missions", "Missionen"], ["approvals", "Freigaben"], ["workspace", "Arbeitsbereich"]]} /><span className="search-result">{unavailable ? '—' : events.length} Treffer</span></div>
    <section className="panel event-stream">{events.map(e => <article key={e.id}><span className="stream-icon">{e.kind.startsWith('mission-') ? <Target size={18} /> : e.kind.startsWith('approval-') ? <FileCheck2 size={18} /> : <Settings2 size={18} />}</span><div><span className="stream-kind">#{e.sequence} · Eigene App-Änderung</span><h3>{e.title}</h3><time dateTime={e.at}>{date(e.at)}</time></div></article>)}</section>
    {!events.length && <Empty icon={<Activity size={27} />} title={unavailable ? 'Ereignisstand nicht geladen' : query || filter !== 'all' ? 'Keine passenden Ereignisse' : 'Hier beginnt dein Verlauf.'} text="Speichere eine Mission, ein Profil oder eine Entscheidung. Akzeptierte Änderungen erscheinen hier mit Zeitpunkt und Sequenz; fehlgeschlagene Schreibversuche erzeugen keinen Eintrag." />}
    <p className="short-note">Die letzten 200 Ereignisse bleiben erhalten. Dieses persönliche Protokoll ist kein revisionssicheres externes Audit.</p>
  </>;
}

function EntityEvents({ work, id }: { work: WorkState; id: string }) {
  const events = work.command.events.filter(e => e.entityId === id).slice(-8).reverse();
  return <section className="entity-events"><h3>Dokumentierte Schritte</h3>{events.map(e => <div key={e.id}><Circle size={9} /><span>{e.title}<small>{date(e.at)}</small></span></div>)}</section>;
}
function Stage({ stage }: { stage: Mission['stage'] }) { return <span className={'pill ' + (stage === 'Done' ? 'green' : ['Blocked', 'Error'].includes(stage) ? 'red' : stage === 'Review' ? 'amber' : 'blue')}>{stage === 'Done' && <CheckCircle2 size={12} />}{stageNames[stage]}</span>; }
function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) { return <section className="panel command-empty"><div>{icon}</div><h2>{title}</h2><p>{text}</p>{action}</section>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="tuning-field"><span>{label}</span>{children}</label>; }
function Select({ value, onChange, options, label, disabled = false }: { value: string; onChange: (v: string) => void; options: string[][]; label: string; disabled?: boolean }) { return <NativeSelect aria-label={label} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>{options.map(([v, l]) => <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>)}</NativeSelect>; }
function date(s: string) { return new Date(s).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }); }
function localDate(s: string) { const d = new Date(s); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function useClock() { const [now, setNow] = useState(Date.now); useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []); return now; }
const copy=copyWithFeedback;
function missionHandoff(m: Mission, work: WorkState, sources: Source[]) {
  const p = work.profiles.find(p => p.id === m.owner)!;
  return `HANDOFF\nFROM: lowgiga / LowQuantFlow\nTO: ${agentNames[m.owner]}\nMISSION: ${m.goal}\nSCOPE: ${m.scope}\nPROJECT: ${projects[m.project]}\nAPP PHASE: ${stageNames[m.stage]} (eigener Vermerk, keine Live-Telemetrie)\nOWNER ROLE: ${p.role}\nINSTRUCTIONS: ${p.instructions}\nREVIEWER: ${agentNames[m.reviewer]}\nOUTPUT REQUIRED: ${m.output}\nTASKS:\n${work.tasks.filter(t => m.taskIds.includes(t.id)).map(t => `- ${t.title}: ${t.status}; fertig wenn ${t.acceptance}`).join('\n') || 'Keine Aufgaben zugeordnet.'}\nSOURCES:\n${sources.filter(s => m.sourceIds.includes(s.id)).map(s => `- ${s.title} [${s.status}] ${s.file}`).join('\n') || 'Keine Quellen ausgewählt.'}\nEVIDENCE: ${m.evidence || 'Noch kein Abschlussbeleg.'}\nCHECKPOINT: ${m.checkpoint || 'Noch kein Fortsetzungspunkt.'}\nLIMITS: Vorgeschlagen ${p.callBudget} Aufrufe / ${p.timeBudget} Minuten; Delegation ${p.maxDelegation}. Verbrauch unbekannt.\nEXECUTION: Kein Agenten-/Worker-Aufruf durch diesen Hand-off. Externe Aktionen separat konkret freigeben.\nRETURN TO: Zimt → lowgiga`;
}
