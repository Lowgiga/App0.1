'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkState } from '@/lib/work-contract';
import type { NeuroMode } from '@/lib/neuro';
import { getAttention } from '@/lib/intelligence';

/** View changes are local immediately; persistence is a separate explicit action. */
export function useDashboardState(work: WorkState) {
  const saved = work.settings.neuro;
  const [preferences, setPreferences] = useState(saved);
  const savedSignature = useRef(JSON.stringify(saved));
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const signature = JSON.stringify(saved); if (signature !== savedSignature.current) { savedSignature.current = signature; setPreferences(saved); } }, [saved]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const attention = useMemo(() => getAttention(work, now), [work, now]);
  const highest = attention.find(a => !a.accepted)?.score || 0;
  const automaticPriority = preferences.autoPriority && highest >= preferences.alertThreshold;
  const currentNeuroMode: NeuroMode = automaticPriority ? 'risk' : preferences.mode;
  return { preferences, setPreferences, currentNeuroMode, automaticPriority, attention, highest, now };
}
