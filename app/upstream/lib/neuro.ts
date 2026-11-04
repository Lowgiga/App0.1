/** UI relevance signals, not biological measurements or predictions of a person's state. */
export type NeuroProfile = { acetylcholin: number; dopamine: number; serotonin: number; noradrenaline: number };
export const neuroModes = ['overview', 'focus', 'progress', 'stability', 'risk'] as const;
export type NeuroMode = typeof neuroModes[number];
export const neuroNames: Record<NeuroMode, string> = { overview: 'Überblick', focus: 'Deep Focus', progress: 'Fortschritt', stability: 'Stabilität', risk: 'Risiko & Konflikt' };
export const zeroNeuro = (): NeuroProfile => ({ acetylcholin: 0, dopamine: 0, serotonin: 0, noradrenaline: 0 });
export type NeuroInput = { kind: string; stage?: string; priority?: string; risk?: string; taskStatus?: string; decision?: string };

/** Deterministic, versioned rule set. Scores are UI weights in 0–100, not confidence percentages. */
export function calculateNeuroScore(input: NeuroInput): NeuroProfile {
  const p: NeuroProfile = { acetylcholin: 20, dopamine: 0, serotonin: 30, noradrenaline: 0 };
  if (input.kind.startsWith('mission')) {
    p.acetylcholin = input.stage === 'Working' ? 90 : input.stage === 'Review' ? 80 : 55;
    p.dopamine = input.stage === 'Done' ? 100 : input.stage === 'Approved' ? 85 : input.stage === 'Review' ? 65 : input.kind === 'mission-created' ? 25 : 15;
    p.serotonin = ['Approved', 'Done'].includes(input.stage || '') ? 80 : 40;
    p.noradrenaline = input.stage === 'Error' ? 95 : input.stage === 'Blocked' ? 85 : input.stage === 'Waiting' ? 45 : input.priority === 'P0' && input.stage !== 'Done' ? 60 : 0;
  } else if (input.kind.startsWith('approval')) {
    p.acetylcholin = 65;
    p.noradrenaline = input.kind === 'approval-decided' ? 0 : input.risk === 'high' ? 90 : input.risk === 'medium' ? 55 : 30;
    p.dopamine = input.kind === 'approval-decided' ? 45 : 0;
  } else if (input.kind === 'task-updated') {
    p.acetylcholin = 65; p.dopamine = input.taskStatus === 'Erledigt' ? 75 : input.taskStatus === 'Review' ? 50 : 10;
    p.noradrenaline = input.taskStatus === 'Blockiert' ? 80 : 0;
  } else if (input.kind === 'risk-accepted') {
    p.serotonin = 80; p.acetylcholin = 30;
  } else if (input.kind === 'risk-task-created') {
    p.acetylcholin = 80; p.dopamine = 25; p.noradrenaline = 40;
  } else if (input.kind === 'focus-followed') {
    p.acetylcholin = 90; p.dopamine = 45; p.serotonin = 60;
  } else if (input.kind === 'storage-error' || input.kind === 'external-alert') {
    p.noradrenaline = 95; p.serotonin = 0;
  } else if (input.kind === 'deadline-in-1h') {
    p.noradrenaline = 85;
  } else if (input.kind === 'workspace-updated') {
    p.serotonin = 65;
  }
  return p;
}

export function dominantSignal(p: NeuroProfile): keyof NeuroProfile {
  return (Object.keys(p) as (keyof NeuroProfile)[]).reduce((best, key) => p[key] > p[best] ? key : best, 'serotonin');
}
