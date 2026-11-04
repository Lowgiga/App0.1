import {workSizeError} from '@/lib/work-budget';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { actionContract } from '@/lib/interaction-contract';
import { savedWorkContract } from '@/lib/work-contract';
import { readWork, writeWork } from '@/lib/work-storage';
import { applyIntelligenceAction } from '@/lib/intelligence-actions';
import { withAppEvents, workChangeErrors } from '@/lib/work-updates';
import { getAttention } from '@/lib/intelligence';
import { readJsonRequest } from '../request-body';
import data from '@/lib/mesh-data.json';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Only own, bounded state transitions. No outbound requests or execution permissions. */
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Authentication required' }, 401);
  const input = await readJsonRequest(request, 32768);
  if ('response' in input) return input.response;
  const action = actionContract.safeParse(input.body);
  if (!action.success) return json({ error: 'Ungültige App-Aktion. Bitte Ziel und Begründung prüfen.' }, 400);
  try {
    const current = await readWork(user.userId);
    if (action.data.expectedUpdatedAt !== current.updatedAt) return json({ error: 'State changed; reload before saving' }, 409);
    const now = new Date();
    let candidate;
    try { candidate = savedWorkContract.parse(applyIntelligenceAction(current, action.data, now)); }
    catch (error) { return json({ error: error instanceof Error ? error.message : 'Diese Aktion ist nicht mehr aktuell.' }, 400); }
    const errors = workChangeErrors(current, candidate, now, data.sources.map(s => s.id), true);
    if (errors.length) return json({ error: errors[0] }, 400);
    const complete = withAppEvents(current, candidate, now);
    // Creating a task can reopen review, so bind its record to the resulting risk revision.
    if (action.data.action === 'risk-plan') {
      const record = complete.command.interactions.at(-1)!;
      const risk = getAttention(complete, now.getTime()).find(a => a.id === record.sourceId);
      if (risk) record.fingerprint = risk.fingerprint;
    }
    const validated = savedWorkContract.parse(complete);
    const sizeError=workSizeError(validated);if(sizeError)return json({error:sizeError},400);
    const { updatedAt: _at, ...payload } = validated;
    const result = await writeWork(user.userId, payload, action.data.expectedUpdatedAt);
    if (!result) return json({ error: 'State changed; reload before saving' }, 409);
    return json(savedWorkContract.parse(result));
  } catch { return json({ error: 'Storage unavailable' }, 503); }
}
