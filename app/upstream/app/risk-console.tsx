'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Attention } from '@/lib/intelligence';
import type { WorkState } from '@/lib/work-contract';
import type { ActionInput } from './use-work-state';
import { toast } from 'sonner';

export default function RiskConsole({ risk, work, disabled, action, onClose, go }: { risk: Attention | null; work: WorkState; disabled: boolean; action: (a: ActionInput) => Promise<boolean>; onClose: () => void; go: (view: 'matrix' | 'missions' | 'approvals', query?: string) => void }) {
  const [reason, setReason] = useState('');
  useEffect(() => setReason(''), [risk?.id, risk?.fingerprint]);
  const mission = work.command.missions.find(m => m.id === risk?.missionId);
  async function commit(kind: 'risk-accept' | 'risk-plan') {
    if (!risk) return;
    if (await action({ action: kind, sourceId: risk.id, fingerprint: risk.fingerprint, reason: reason.trim() })) {
      toast.success(kind === 'risk-accept' ? 'Risikoakzeptanz dokumentiert. Die Bedingung bleibt sichtbar.' : 'Verknüpfte Prüfaufgabe angelegt. Der Konflikt ist noch offen.');
      if (kind === 'risk-plan') go('matrix', 'Risiko prüfen: ' + risk.title);
      onClose();
    }
  }
  return <Dialog open={!!risk} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="risk-console"><DialogHeader><DialogTitle><AlertTriangle size={21} />Konflikt-Auflösungs-Konsole</DialogTitle><DialogDescription>Eine konkrete Entscheidung dokumentieren oder die Behebung als eigene Prüfaufgabe beginnen. Kein Git-, Worker- oder externer Schreibaufruf.</DialogDescription></DialogHeader>{risk && <div className="risk-console-body"><h3>{risk.title}</h3><div className="risk-comparison"><section><h4>Dokumentierte Bedingung</h4><p>{risk.reason}</p><p>Priorität: {risk.score}/100</p>{mission && <p>Mission: {mission.title}<br />Phase: {mission.stage}<br />Auftrag: {mission.goal}</p>}</section><section><h4>Erforderliche Entscheidung</h4><p>{risk.kind === 'decision' ? 'Gespeicherte Anfrage und Nachweise prüfen. Eine Risikoakzeptanz genehmigt diese Anfrage nicht.' : risk.kind === 'deadline' ? 'Termin und Auftrag überprüfen; Behebung oder begründete Risikoentscheidung dokumentieren.' : 'Blocker konkret prüfen, Voraussetzungen klären und Ergebnis belegen.'}</p>{risk.accepted && <p><CheckCircle2 size={16} />Akzeptiertes Risiko; die ursprüngliche Bedingung besteht.</p>}{risk.plannedTaskId && <p><ClipboardList size={16} />Eine Prüfaufgabe ist bereits verknüpft.</p>}</section></div><label className="tuning-field"><span>Begründung · mindestens 8 Zeichen</span><Textarea aria-label="Begründung der Risikobehandlung" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} placeholder="Welche Auswirkung akzeptierst du oder was soll konkret geprüft werden?" /></label><div className="risk-console-actions"><Button variant="outline" disabled={disabled || reason.trim().length < 8 || risk.accepted} onClick={() => commit('risk-accept')}>Risiko bewusst akzeptieren</Button><Button disabled={disabled || reason.trim().length < 8 || risk.accepted || !!risk.plannedTaskId} onClick={() => commit('risk-plan')}>Prüfaufgabe zur Auflösung anlegen</Button><Button variant="ghost" onClick={() => { go(risk.view, risk.query); onClose(); }}>Betroffenen Datensatz öffnen</Button></div><p className="short-note">Eine Akzeptanz gilt für die angezeigte Bedingung und ihren Stand. Bei einer neuen Bedingung ist sie erneut zu prüfen. „Behoben“ wird erst aus einer tatsächlichen Zustandsänderung abgeleitet. Alle Entscheidungen bleiben im Verlauf erhalten.</p></div>}</DialogContent></Dialog>;
}
