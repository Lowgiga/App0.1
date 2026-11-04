import { z } from 'zod';
import { agentIds, projectIds } from './work-constants.ts';
import { neuroProfileContract, zeroNeuro } from './neuro-contract.ts';
import { interactionContract } from './interaction-contract.ts';
import { calculateNeuroScore } from './neuro.ts';

export const missionStages = ['Created', 'Planned', 'Assigned', 'Working', 'Waiting', 'Blocked', 'Review', 'Approved', 'Done', 'Error'] as const;
export const stageNames: Record<typeof missionStages[number], string> = {
  Created: 'Erstellt', Planned: 'Geplant', Assigned: 'Zugeordnet', Working: 'In Arbeit',
  Waiting: 'Wartet', Blocked: 'Blockiert', Review: 'Gegenprüfung', Approved: 'Abgenommen', Done: 'Abgeschlossen', Error: 'Fehler',
};
export const stageTransitions: Record<typeof missionStages[number], readonly typeof missionStages[number][]> = {
  Created: ['Planned', 'Blocked'], Planned: ['Created', 'Assigned', 'Blocked'],
  Assigned: ['Planned', 'Working', 'Blocked'], Working: ['Waiting', 'Blocked', 'Review', 'Error'],
  Waiting: ['Working', 'Blocked', 'Review', 'Error'], Blocked: ['Planned', 'Assigned', 'Working'],
  Review: ['Working', 'Approved', 'Error'], Approved: ['Review', 'Done'], Done: ['Review'], Error: ['Planned', 'Working', 'Blocked'],
};

const distinct = (a: { id: string }[]) => new Set(a.map(x => x.id)).size === a.length;
const references = (max: number) => z.array(z.string().min(1).max(80)).max(max).refine(a => new Set(a).size === a.length, 'Referenzen müssen eindeutig sein.');
const meaningful = (min: number, max: number) => z.string().max(max).refine(s => s.trim().length >= min, `Mindestens ${min} aussagekräftige Zeichen erforderlich.`);

export const missionContract = z.object({
  id: z.string().uuid(), title: meaningful(3, 150), goal: meaningful(5, 2000), scope: meaningful(3, 1500),
  project: z.enum(projectIds), owner: z.enum(agentIds), reviewer: z.enum(agentIds),
  stage: z.enum(missionStages), priority: z.enum(['P0', 'P1', 'P2']), output: meaningful(3, 500),
  taskIds: references(20), roomId: z.string().uuid().nullable(), sourceIds: references(20),
  evidence: z.string().max(3000), reviewed: z.boolean(), checkpoint: z.string().max(3000),
  archived: z.boolean(), createdAt: z.string().datetime(),
  deadlineAt: z.string().datetime().nullable().default(null),
  neuro_profile: neuroProfileContract.default(zeroNeuro),
}).strict().superRefine((m, ctx) => {
  if (['Approved', 'Done'].includes(m.stage) && (m.owner === m.reviewer || !m.reviewed || m.evidence.trim().length < 12)) {
    ctx.addIssue({ code: 'custom', message: 'Abnahme braucht einen anderen Reviewer, einen konkreten Beleg und dokumentierte Gegenprüfung.' });
  }
}).transform(m => ({ ...m, neuro_profile: calculateNeuroScore({ kind: 'mission', stage: m.stage, priority: m.priority }) }));

export const approvalContract = z.object({
  id: z.string().uuid(), missionId: z.string().uuid().nullable(), action: meaningful(3, 300),
  target: meaningful(3, 300), dataSummary: meaningful(3, 1000), reason: meaningful(3, 1500),
  expectedResult: meaningful(3, 1000), risk: z.enum(['low', 'medium', 'high']),
  reversibility: z.enum(['yes', 'partial', 'no']), impact: meaningful(3, 1000),
  testEvidence: z.string().max(2000), rollback: z.string().max(1500),
  createdAt: z.string().datetime(), expiresAt: z.string().datetime(),
  status: z.enum(['pending', 'approved', 'denied']), scope: z.enum(['once', 'mission', 'session']),
  decidedAt: z.string().datetime().nullable(), decisionNote: z.string().max(1500),
  executed: z.literal(false),
}).strict().superRefine((a, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (Date.parse(a.expiresAt) <= Date.parse(a.createdAt)) fail('Das Ablaufdatum muss nach der Erstellung liegen.');
  if (a.scope === 'mission' && !a.missionId) fail('Eine missionsbezogene Entscheidung braucht eine Mission.');
  if ((a.status === 'pending') !== (a.decidedAt === null)) fail('Entscheidung und Entscheidungszeit müssen zusammenpassen.');
  if (a.decidedAt && Date.parse(a.decidedAt) < Date.parse(a.createdAt)) fail('Die Entscheidung kann nicht vor der Erstellung liegen.');
  if (a.status === 'approved') {
    if (a.testEvidence.trim().length < 12 || a.rollback.trim().length < 8) fail('Genehmigen braucht einen konkreten Prüfbeleg und beschriebenen Rückweg.');
    if (a.decidedAt && Date.parse(a.decidedAt) >= Date.parse(a.expiresAt)) fail('Eine abgelaufene Karte kann nicht genehmigt werden.');
  }
});

export const eventContract = z.object({
  id: z.string().uuid(), sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  at: z.string().datetime(), origin: z.literal('app'), entityId: z.string().max(80).nullable(),
  kind: z.enum(['mission-created', 'mission-updated', 'mission-stage', 'approval-created', 'approval-updated', 'approval-decided', 'workspace-updated', 'task-updated', 'risk-accepted', 'risk-task-created', 'focus-followed']),
  title: z.string().min(1).max(350),
  neuro_context: z.object({ stage: z.enum(missionStages).optional(), priority: z.enum(['P0', 'P1', 'P2']).optional(), risk: z.enum(['low', 'medium', 'high']).optional(), taskStatus: z.enum(['Offen', 'In Arbeit', 'Blockiert', 'Review', 'Erledigt']).optional(), decision: z.enum(['approved', 'denied']).optional() }).strict().default({}),
  neuro_profile: neuroProfileContract.default(zeroNeuro),
}).strict().transform(e => ({ ...e, neuro_profile: calculateNeuroScore({ kind: e.kind, ...e.neuro_context }) }));

export const commandContract = z.object({
  missions: z.array(missionContract).max(30).refine(distinct, 'Missions-IDs müssen eindeutig sein.'),
  approvals: z.array(approvalContract).max(60).refine(distinct, 'Freigabe-IDs müssen eindeutig sein.'),
  interactions: z.array(interactionContract).max(120).refine(distinct, 'Interaktions-IDs müssen eindeutig sein.').default([]),
  events: z.array(eventContract).max(200).refine(distinct, 'Ereignis-IDs müssen eindeutig sein.'),
}).strict().superRefine((c, ctx) => {
  const byId = new Map(c.missions.map(m => [m.id, m]));
  if (new Set([...c.missions, ...c.approvals].map(x => x.id)).size !== c.missions.length + c.approvals.length) ctx.addIssue({ code: 'custom', message: 'Missionen und Freigaben benötigen verschiedene IDs.' });
  for (const a of c.approvals) {
    if (a.missionId && !byId.has(a.missionId)) ctx.addIssue({ code: 'custom', message: 'Die Mission einer Freigabekarte fehlt.' });
  }
  for (const m of c.missions) {
    if (m.stage === 'Done' && c.approvals.some(a => a.missionId === m.id && a.status === 'pending')) {
      ctx.addIssue({ code: 'custom', message: 'Eine offene Freigabe verhindert den Missionsabschluss.' });
    }
  }
  for (let i = 1; i < c.events.length; i++) {
    if (c.events[i].sequence <= c.events[i - 1].sequence) ctx.addIssue({ code: 'custom', message: 'Ereignisse müssen in eindeutiger Sequenzfolge stehen.' });
  }
});

export type Mission = z.infer<typeof missionContract>;
export type Approval = z.infer<typeof approvalContract>;
export type AppEvent = z.infer<typeof eventContract>;
export type CommandState = z.infer<typeof commandContract>;
export const emptyCommand = (): CommandState => ({ missions: [], approvals: [], events: [], interactions: [] });

export function approvalState(a: Approval, now = Date.now()): 'pending' | 'approved' | 'denied' | 'expired' {
  return a.status !== 'denied' && Date.parse(a.expiresAt) <= now ? 'expired' : a.status;
}
