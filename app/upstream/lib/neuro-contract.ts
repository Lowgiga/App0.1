import { z } from 'zod';
import { neuroModes, zeroNeuro } from './neuro.ts';

export const neuroProfileContract = z.object({
  acetylcholin: z.number().int().min(0).max(100), dopamine: z.number().int().min(0).max(100),
  serotonin: z.number().int().min(0).max(100), noradrenaline: z.number().int().min(0).max(100),
}).strict();
export const neuroSettingsContract = z.object({
  mode: z.enum(neuroModes), focusMissionId: z.string().uuid().nullable(),
  autoPriority: z.boolean(), autoConsole: z.boolean().default(false), alertThreshold: z.number().int().min(60).max(100),
  signalMotion: z.boolean(), progressSort: z.enum(['time', 'meaning']),
}).strict();
export const defaultNeuroSettings: z.infer<typeof neuroSettingsContract> = {
  mode: 'overview', focusMissionId: null, autoPriority: false, autoConsole: false, alertThreshold: 80,
  signalMotion: true, progressSort: 'time',
};
export { zeroNeuro };
