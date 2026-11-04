import type {AdvisoryAdapter} from './contracts.ts';
import {createSimulator} from './simulator.ts';
/** Host-owned injection seam. Receives a role, never transport or write authority. */
export type AdvisoryAdapterFactory=(role:'advisor'|'specialist')=>AdvisoryAdapter;
export const createDefaultAdvisoryAdapter:AdvisoryAdapterFactory=()=>createSimulator();
