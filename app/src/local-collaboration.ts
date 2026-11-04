import { buildCollaborationBrief as buildWebsiteBrief } from '../upstream/lib/collaboration-model';
import type { LowReport } from '../upstream/lib/collaboration-model';
import { contentDigest } from '../upstream/lib/content-digest';
import type { WorkState } from '../upstream/lib/work-contract';

export { collaborationRegistry, lowReportNote, parseLowReport } from '../upstream/lib/collaboration-model';

/** A local brief is a different semantic artifact from the website/MCP brief.
 * The digest includes provenance and transport; it is a binding, not authentication.
 * No verified cloud-import provenance is currently stored by the local state contract.
 */
export function buildCollaborationBrief(work?: WorkState, generatedAt = new Date().toISOString()) {
  const { briefHash: _websiteHash, ...website } = buildWebsiteBrief(work, generatedAt);
  const brief = {
    ...website,
    mission: 'Prüfe diese lokale Installation und ihre real verfügbaren Integrationswege. Dieser Gerätestand belegt keinen persönlichen Websiteauftrag. Dokumentiere Herkunft, Zeitpunkt, minimalen Scope, konkreten Leseabruf und Blocker. Auf Android zusätzlich 390px-Bedienung und optional WebGL/AR nach eigenem Start prüfen.',
    transport: {
      kind: 'manual-local-export', automaticDelivery: false, cloudSynchronization: false,
      separateWebsiteReadPath: { ...website.transport, context: 'separate-cloud-state', bindsThisLocalBrief: false },
    },
    context: {
      ...website.context, kind: work ? 'device-local' : 'unknown',
      provenance: {
        schema: 'cue.local-collaboration/v1', origin: 'local-installation',
        personalCloudImport: 'not-verified', personalWebsiteAssignment: 'not-established',
        notice: 'Lokaler Arbeitsbrief dieser Installation. Kein verifizierter persönlicher Cloudimport liegt vor. Die private Website und ihr MCP-Leseweg haben einen separaten Arbeitsstand.',
      },
    },
  };
  const { generatedAt: _time, ...content } = brief;
  return { ...brief, briefHash: contentDigest(JSON.stringify(content)).slice('sha256:'.length) };
}

export function reportMatchesBrief(report: LowReport, work?: WorkState) {
  const brief = buildCollaborationBrief(work);
  return report.missionId === brief.missionId && report.revision === brief.revision
    && report.referenceCommit === brief.referenceCommit && report.briefHash === brief.briefHash;
}

export function collaborationMarkdown(work?: WorkState) {
  const brief = buildCollaborationBrief(work);
  return `# Codex → Low · lokaler Arbeitsbrief\n\n${brief.context.provenance.notice}\n\nDieser Arbeitsbrief ist vorbereitet. Direkte Verbindung, Zustellung, Identität und Annahme durch Low sind nicht bestätigt.\n\n${JSON.stringify(brief, null, 2)}\n\nAntwort als LowReport JSON mit genau diesem lokalen Briefhash. Prüfkommando wird als Text dokumentiert, niemals automatisch ausgeführt. Kein Token oder Cookie gehört in diese Übergabe.\n`;
}
