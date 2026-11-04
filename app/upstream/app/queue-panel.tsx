'use client';
import { Button } from '@/components/ui/button';
import { agentNames } from '@/lib/work-constants';
import type { WorkState } from '@/lib/work-contract';

export default function QueuePanel({ work, onOpen }: { work: WorkState; onOpen: () => void }) {
  const items = work.tasks.filter(t => !t.archived && t.status !== 'Erledigt').sort((a, b) => a.priority.localeCompare(b.priority)).slice(0, 3);
  return <section className="panel queue-panel" data-widget="queue"><div className="panel-title"><h2>Deine nächsten Schritte</h2><Button variant="ghost" onClick={onOpen}>Matrix öffnen</Button></div>
    {items.map(t => <button key={t.id} className="queue-row" onClick={onOpen}><span className="pill amber">{t.priority}</span><div><strong>{t.title}</strong><small>{agentNames[t.owner]} · {t.status}</small></div></button>)}
    {!items.length && <p className="short-note">Alle aktiven Aufgaben sind abgeschlossen. Lege die nächste Mission in der Matrix an.</p>}
  </section>;
}
