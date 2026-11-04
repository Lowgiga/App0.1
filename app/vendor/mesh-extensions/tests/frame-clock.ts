import type { FrameClock } from '../src/motion.ts';
/** Synthetic monotonic RAF clock. Canceled callbacks can be retained to test late delivery. */
export class TestFrameClock implements FrameClock {
 time = 0; next = 0;
 pending = new Map<number, (time: number) => void>();
 canceled: Array<(time: number) => void> = [];
 now = () => this.time;
 request = (callback: (time: number) => void) => { const id = ++this.next; this.pending.set(id, callback); return id; };
 cancel = (id: number) => { const callback = this.pending.get(id); if (callback) this.canceled.push(callback); this.pending.delete(id); };
 step(time: number) { this.time = time; const callbacks = [...this.pending.values()]; this.pending.clear(); for (const callback of callbacks) callback(time); }
}
