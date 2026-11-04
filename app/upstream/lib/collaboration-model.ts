import { z } from 'zod';
import registry from './collaboration-registry.json' with { type: 'json' };
import { checkOwnedPaths } from './collaboration-scope.mjs';
import type { WorkState } from './work-contract.ts';
import { contentDigest } from './content-digest.ts';

export { registry as collaborationRegistry };
const sha = z.string().regex(/^[a-f0-9]{40}$/, 'Vollständiger Git-Commit erforderlich.');
export const lowReportContract = z.object({
  schemaVersion: z.literal(1), revision: z.string().min(1).max(80), missionId: z.string().min(1).max(80), briefHash: z.string().regex(/^[a-f0-9]{64}$/),
  from: z.literal('low'), acknowledged: z.literal(true), referenceCommit: sha, baseCommit: sha,
  status: z.enum(['blocked', 'partial', 'completed']), summary: z.string().trim().min(20).max(2000),
  changedFiles: z.array(z.string().min(1).max(240)).max(40).refine(p => new Set(p).size === p.length, 'Dateiliste enthält Duplikate.'),
  tests: z.array(z.object({ command: z.string().trim().min(1).max(500), exitCode: z.number().int().min(0).max(255).nullable(), evidence: z.string().trim().min(12).max(1000) }).strict()).max(20),
  blockers: z.array(z.string().trim().min(5).max(1000)).max(20),
}).strict().superRefine((report, ctx) => {
  for (const v of checkOwnedPaths(registry, 'low', report.changedFiles).violations) ctx.addIssue({ code: 'custom', path: ['changedFiles'], message: `${v.path}: ${v.reason}` });
  if (report.status === 'completed' && (!report.tests.length || report.tests.some(t => t.exitCode !== 0) || report.blockers.length)) ctx.addIssue({ code: 'custom', path: ['status'], message: 'Abschlussmeldung benötigt dokumentierte erfolgreiche Prüfungen und keine offenen Blocker.' });
  if (report.status === 'blocked' && !report.blockers.length) ctx.addIssue({ code: 'custom', path: ['blockers'], message: 'Blockierte Arbeit benötigt einen konkreten Blocker.' });
});
export type LowReport = z.infer<typeof lowReportContract>;
export function parseLowReport(text: string): LowReport {
  if (new TextEncoder().encode(text).byteLength > 24000) throw new Error('Rückmeldung darf höchstens 24.000 UTF-8-Bytes umfassen.');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Rückmeldung ist kein gültiges JSON.'); }
  const result = lowReportContract.safeParse(raw);
  if (!result.success) throw new Error(result.error.issues.map(i => `${i.path.join('.') || 'Rückmeldung'}: ${i.message}`).slice(0, 5).join('\n'));
  return result.data;
}
export function buildCollaborationBrief(work?: WorkState, generatedAt = new Date().toISOString()) {
  const brief = {
    schemaVersion: 1, revision: registry.revision, missionId: registry.missionId, from: 'codex', to: 'low', generatedAt,
    state: 'prepared-not-delivered', identity: registry.identity, referenceCommit: registry.referenceCommit,
    currentSourceHead: 'Read the current source repository HEAD before starting; this reference is not the current HEAD.',
    mission: 'Prüfe den real verfügbaren Zugang zu dieser privaten App und einer relevanten Integration. Dokumentiere Herkunft, Zeitpunkt, minimalen Scope, konkreten Leseabruf und Blocker. Auf dem tatsächlichen Android-Gerät 390px-Bedienung, echte 3D-Fokusauswahl und Kamera-AR prüfen: Surface-Modus, waagerechter Flächentreffer, bewusstes Platzieren, Größenänderung am Auflagepunkt, Trackingverlust, Neuplatzieren und Sitzung beenden. Fehlername/Phase und Browser nennen. Kamerabilder nicht übertragen.',
    niche: registry.roles.low.niche, ownedPaths: registry.roles.low.ownedPaths, protectedPaths: registry.protectedPaths,
    limits: { maxDelegation: 0, maxReadCalls: 8, timeBudgetMinutes: 20, externalWrite: false, install: false, scheduler: false, credentialsInHandoff: false },
    transport: registry.mcp, rules: registry.rules,
    context: work ? { kind: 'own-stored-app-state', updatedAt: work.updatedAt, missions: work.command.missions.filter(m => !m.archived).slice(0, 6).map(m => ({ id: m.id, title: m.title, project: m.project, phase: m.stage })), activeTaskCount: work.tasks.filter(t => !t.archived && t.status !== 'Erledigt').length } : { kind: 'unknown', missions: [], activeTaskCount: null },
    expectedOutput: { format: 'LowReport JSON', required: ['schemaVersion', 'revision', 'missionId', 'briefHash', 'from', 'acknowledged', 'referenceCommit', 'baseCommit', 'status', 'summary', 'changedFiles', 'tests', 'blockers'], verification: 'Submitted claims only. Identity, source HEAD, complete diff and tests must be independently reviewed before integration.' },
    returnTo: 'Codex → unabhängiges Review → lowgiga',
    stopWhen: 'Nach einem prüfbaren Ergebnis oder konkreten Auth-/Zugriffsblocker. Keine blinden Wiederholungen oder Umgehung über andere Clients.',
  };
  // Generated time is not semantic content. Same private state produces the same binding in UI/MCP.
  const { generatedAt: _generatedAt, ...content } = brief;
  return { ...brief, briefHash: contentDigest(JSON.stringify(content)).slice('sha256:'.length) };
}
export function reportMatchesBrief(report: LowReport, work?: WorkState) {
  const brief = buildCollaborationBrief(work);
  return report.missionId === brief.missionId && report.revision === brief.revision && report.referenceCommit === brief.referenceCommit && report.briefHash === brief.briefHash;
}
export function collaborationMarkdown(work?: WorkState) {
  const brief = buildCollaborationBrief(work);
  return `# Codex → Low · getrennte Dashboard-Arbeit\n\nDieser Arbeitsbrief ist vorbereitet. Direkte Verbindung, Zustellung, Identität und Annahme durch Low sind nicht bestätigt.\n\n${JSON.stringify(brief, null, 2)}\n\nAntwort als LowReport JSON. Prüfkommando wird als Text dokumentiert, niemals automatisch ausgeführt. Kein Token oder Cookie gehört in diese Übergabe.\n`;
}
export function lowReportNote(report: LowReport, binding: 'current' | 'historical' | 'unchecked' = 'unchecked') {
  const classification = binding === 'current' ? 'Bei Übernahme passend zum damaligen Brief; Inhalt ungeprüft.' : binding === 'historical' ? 'HISTORISCH: abweichender Arbeitsbrief; kein aktueller Integrationsauftrag.' : 'Briefzuordnung noch ungeprüft.';
  const text = `LOW · manuell übernommene Rückmeldung · NICHT unabhängig verifiziert\n${classification}\nAbsenderidentität und aktueller Source-HEAD ungeprüft. Kein Agent wurde gestartet, keine Freigabe oder Integration geändert.\n${JSON.stringify(report, null, 2)}`;
  if (text.length > 5000) throw new Error('Für eine Notiz ist diese Rückmeldung zu lang. Sichere sie extern als Datei oder kürze sie auf konkrete Belege.');
  return text;
}
