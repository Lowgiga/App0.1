'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { savedWorkContract, emptyWork, type WorkState } from '@/lib/work-contract';
import type { IntelligenceAction } from '@/lib/interaction-contract';
import {workSizeError} from '@/lib/work-budget';
import {createId} from '@/lib/ids';
import { toast } from 'sonner';
import { writeIntentObserved, actionIntentObserved } from '@/lib/write-reconciliation';

export type ActionInput = IntelligenceAction extends infer T ? T extends IntelligenceAction ? Omit<T, 'expectedUpdatedAt' | 'requestId'> : never : never;
export function useWorkState() {
  const [work, setWork] = useState<WorkState>(emptyWork);
  const current = useRef(work);
  const [storage, setStorage] = useState('Arbeitsstand wird geladen …');
  const [storageError, setStorageError] = useState(false);
  const [loadingWork, setLoadingWork] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [hasLoaded,setHasLoaded]=useState(false);
  const [busy, setBusy] = useState(false);
  const loading = useRef(true), failed = useRef(false), saving = useRef(false), mounted = useRef(true);
  const generation = useRef(0), loadController = useRef<AbortController | null>(null), saveController = useRef<AbortController | null>(null);
  const accept = useCallback((saved: WorkState) => {
    current.current = saved; setWork(saved); setHasLoaded(true); failed.current = false; setStorageError(false);
    setStorage(saved.updatedAt ? 'Arbeitsstand gespeichert · ' + new Date(saved.updatedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }) : 'Dein Arbeitsstand ist bereit');
  }, []);
  const load = useCallback(async (duringSave = false) => {
    if (saving.current && !duringSave) return false;
    const id = ++generation.current; loadController.current?.abort();
    const controller = new AbortController(); loadController.current = controller;
    loading.current = true; setLoadingWork(true);
    try {
      const r = await fetch('/api/state', { headers: { 'X-Mesh-State-Version': '4' }, signal: controller.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('Arbeitsstand nicht erreichbar');
      const saved = savedWorkContract.parse(await r.json());
      if (!mounted.current || generation.current !== id) return false;
      accept(saved); return true;
    } catch {
      if (!controller.signal.aborted && mounted.current && generation.current === id) {
        failed.current = true; setStorageError(true); setStorage('Arbeitsstand nicht erreichbar. Speichern ist bis zu einem erfolgreichen Abruf gesperrt. Der letzte geladene Snapshot bleibt exportierbar.');
      }
      return false;
    } finally {
      if (mounted.current && generation.current === id) { loading.current = false; setLoadingWork(false); setInitialized(true); }
    }
  }, [accept]);
  useEffect(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; generation.current++; loadController.current?.abort(); saveController.current?.abort(); };
  }, [load]);
  const commit = useCallback(async (url: string, body: Record<string, unknown>, method: 'PUT' | 'POST') => {
    if (saving.current || loading.current || failed.current) return false;
    saving.current = true; setBusy(true); generation.current++; loadController.current?.abort();
    const controller = new AbortController(); saveController.current = controller;
    const before = current.current;
    let uncertain = true;
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-Mesh-State-Version': '4' }, signal: controller.signal, body: JSON.stringify({ ...body, expectedUpdatedAt: current.current.updatedAt }) });
      if (!mounted.current) return false;
      if (r.status === 409) { uncertain = false; await load(true); toast.error('Ein anderer Tab hat gespeichert. Aktueller Stand geladen; Formularentwürfe bleiben erhalten. Erneut prüfen.'); return false; }
      if (!r.ok) { uncertain = r.status >= 500; const result = await r.json().catch(() => ({})) as {error?:string}; throw new Error(result.error || 'Speichern fehlgeschlagen'); }
      accept(savedWorkContract.parse(await r.json())); return true;
    } catch (error) {
      if (!mounted.current) return false;
      if (uncertain) {
        const recovered = await load(true);
        if (recovered && (method === 'PUT' ? writeIntentObserved(before, savedWorkContract.parse({ ...body, updatedAt: before.updatedAt }), current.current) : actionIntentObserved(before, { ...body, expectedUpdatedAt: before.updatedAt } as IntelligenceAction, current.current))) {
          toast.success('Speicherung nach Antwortverlust im neu geladenen Serverstand bestätigt.');
          return true;
        }
        toast.error(recovered ? 'Der Ausgang der Anfrage war unklar. Der Serverstand wurde neu geladen. Prüfe den Verlauf vor einer Wiederholung.' : 'Der Ausgang der Anfrage ist unklar. Erst den Serverstand neu laden, dann den Verlauf prüfen.');
      } else toast.error(error instanceof Error ? error.message : 'Speichern fehlgeschlagen');
      return false;
    } finally { saving.current = false; if (mounted.current) setBusy(false); }
  }, [accept, load]);
  const changeWork = (next: WorkState) => {const error=workSizeError(next);if(error){toast.error(error);return Promise.resolve(false)} const { updatedAt: _at, ...payload } = next; return commit('/api/state', payload, 'PUT'); };
  const performAction = (action: ActionInput) => commit('/api/actions', { ...action, requestId: createId() }, 'POST');
  return { work, storage, storageError, loadingWork, initialized, hasLoaded, busy, loadWork: () => load(), changeWork, performAction };
}
