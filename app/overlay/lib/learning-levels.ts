import type { MeshTask, WorkState } from '../../upstream/lib/work-contract.ts';
import { lessons, type LessonId } from '../../upstream/lib/academy.ts';

export type LearningStatus = 'unknown' | 'open' | 'quiz-saved' | 'practice-saved' | 'transfer-open' | 'transfer-complete';
export type LearningAction = { kind: 'learn' | 'practice' | 'transfer' | 'task' | 'repeat'; label: string };
export type LearningLevel = { id: LessonId; number: number; title: string; status: LearningStatus; quizSaved: boolean; practiceSaved: boolean; transferComplete: boolean; transferTaskId: string | null; recommended: readonly LessonId[]; missingRecommended: LessonId[]; nextAction: LearningAction };
export const learningStatusNames: Record<LearningStatus, string> = { unknown: 'Stand unbekannt', open: 'Quiz offen', 'quiz-saved': 'Quiz gespeichert', 'practice-saved': 'Übung dokumentiert', 'transfer-open': 'Transfer offen', 'transfer-complete': 'Transfer in der App belegt' };
/** Curriculum recommendations, never retroactive locks or claimed user prerequisites. */
export const recommendedLearning: Record<LessonId, readonly LessonId[]> = { evidence: [], handoff: ['evidence'], baseline: ['evidence'], automation: ['evidence', 'handoff'], review: ['handoff', 'baseline', 'automation'] };

/** One bounded DFS per state: shared prerequisites are evaluated once, cycles and duplicate IDs fail closed. */
function completionChecker(tasks: MeshTask[]): (id: string) => boolean {
  // These are the existing V4 contract limits. Reject malformed oversized input before traversing it.
  if (tasks.length > 60) return () => false;
  const byId = new Map<string, MeshTask | null>();
  for (const task of tasks) byId.set(task.id, byId.has(task.id) ? null : task);
  const result = new Map<string, boolean>(), visiting = new Set<string>();
  const complete = (id: string): boolean => {
    if (result.has(id)) return result.get(id)!;
    if (visiting.has(id)) return false;
    const task = byId.get(id);
    if (!task || task.status !== 'Erledigt' || !task.reviewed || task.evidence.trim().length < 12 || task.dependencies.length > 12 || new Set(task.dependencies).size !== task.dependencies.length) {
      result.set(id, false); return false;
    }
    visiting.add(id);
    const valid = task.dependencies.every(complete);
    visiting.delete(id); result.set(id, valid);
    return valid;
  };
  return complete;
}

/** Derived read-only levels reuse saved V4 learning, notes and tasks. No XP, state writes or certification. */
export function buildLearningLevels(work: WorkState, known: boolean): LearningLevel[] {
  const complete = completionChecker(known ? work.tasks : []);
  return lessons.map((lesson, index) => {
    const quizSaved = known && work.learning[lesson.id] === true;
    const practiceSaved = known && quizSaved && work.notes.some(n => n.text.startsWith(`[Mesh Academy · ${lesson.id}]\n`) && n.text.includes('\nEigene Begründung: '));
    // The existing V4 contract has no lesson foreign key; preserve its exact-title identity convention.
    const task = known ? work.tasks.find(t => !t.archived && t.category === 'Lernen' && t.title === lesson.taskTitle) : undefined;
    const transferComplete = !!task && complete(task.id);
    const status: LearningStatus = !known ? 'unknown' : transferComplete ? 'transfer-complete' : task ? 'transfer-open' : practiceSaved ? 'practice-saved' : quizSaved ? 'quiz-saved' : 'open';
    const nextAction: LearningAction = task && !transferComplete ? { kind: 'task', label: 'Transfer-Aufgabe prüfen' } : transferComplete ? { kind: 'repeat', label: 'An neuem Fall wiederholen' } : practiceSaved ? { kind: 'practice', label: 'Fall erneut prüfen und Transfer vorbereiten' } : quizSaved ? { kind: 'practice', label: 'Fall und Begründung üben' } : { kind: 'learn', label: 'Wissensfrage bearbeiten' };
    return { id: lesson.id, number: index + 1, title: lesson.title, status, quizSaved, practiceSaved, transferComplete, transferTaskId: task?.id ?? null, recommended: recommendedLearning[lesson.id], missingRecommended: known ? recommendedLearning[lesson.id].filter(id => !work.learning[id]) : [], nextAction };
  });
}
