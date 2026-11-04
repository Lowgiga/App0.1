import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../src/view.ts';
import { createDemandTimeline, transitionDuration, interpolateLayout } from '../src/motion.ts';
import { TestFrameClock } from './frame-clock.ts';

test('timeline exists only on demand and reaches the exact end without a further frame', () => {
 const clock = new TestFrameClock(), timeline = createDemandTimeline(clock), values: number[] = [];
 assert.equal(clock.pending.size, 0);
 timeline.run(200, value => values.push(value));
 assert.deepEqual(values, [0]); assert.equal(clock.pending.size, 1);
 clock.step(100); assert.equal(values.at(-1), .5);
 clock.step(201); assert.equal(values.at(-1), 1); assert.equal(clock.pending.size, 0);
 const count = values.length; clock.step(500); assert.equal(values.length, count);
});

test('rapid retarget, cancel, stale delivery and disposal cannot revive an old timeline', () => {
 const clock = new TestFrameClock(), timeline = createDemandTimeline(clock), a: number[] = [], b: number[] = [];
 timeline.run(200, value => a.push(value)); clock.step(50);
 timeline.run(100, value => b.push(value));
 const oldCount = a.length; for (const callback of clock.canceled) callback(75);
 assert.equal(a.length, oldCount); assert.equal(clock.pending.size, 1);
 clock.step(150); assert.equal(b.at(-1), 1); assert.equal(clock.pending.size, 0);
 timeline.run(100, value => b.push(value)); timeline.cancel();
 const count = b.length; clock.step(500); assert.equal(b.length, count); assert.equal(clock.pending.size, 0);
 timeline.run(100, value => b.push(value)); timeline.dispose(); timeline.dispose();
 const disposedCount = b.length; timeline.run(100, value => b.push(value)); clock.step(900);
 assert.equal(b.length, disposedCount); assert.equal(clock.pending.size, 0);
});

test('zero, invalid, capped and background-delayed duration are bounded and cancellation is reentrant', () => {
 const clock = new TestFrameClock(), timeline = createDemandTimeline(clock), values: number[] = [];
 for (const duration of [0, -4, NaN, Infinity]) { timeline.run(duration, value => values.push(value)); assert.equal(values.at(-1), 1); assert.equal(clock.pending.size, 0); }
 timeline.run(99999, value => values.push(value)); clock.step(400); assert.equal(values.at(-1), 1); assert.equal(clock.pending.size, 0);
 timeline.run(200, () => timeline.cancel()); assert.equal(clock.pending.size, 0);
 timeline.run(200, () => timeline.dispose()); assert.equal(clock.pending.size, 0);
});

test('disabled, reduced-motion, power-saving and hidden states always beat requested transitions', () => {
 const config = { ...defaultConfig(), transitions: 'smooth' as const, reducedMotion: false };
 assert.equal(transitionDuration(config), 240);
 assert.equal(transitionDuration({ ...config, quality: 'high' }), 320);
 assert.equal(transitionDuration({ ...config, transitions: 'brief' }), 160);
 for (const patch of [{ reducedMotion: true }, { quality: 'low' as const }, { transitions: 'off' as const }]) assert.equal(transitionDuration({ ...config, ...patch }), 0);
 assert.equal(transitionDuration(config, { hidden: true }), 0);
 assert.equal(transitionDuration(config, { systemReduced: true }), 0);
});

test('2D interpolation preserves IDs, truthful target membership and exact end coordinates', () => {
 const a = { positions: { one: { x: 0, y: 0, z: 0 }, removed: { x: 8, y: 2, z: 1 } }, lanes: [], bounds: { x: 0, y: 0, width: 100, height: 100 } };
 const b = { positions: { one: { x: 100, y: -50, z: 20 }, added: { x: 40, y: 3, z: 2 } }, lanes: [], bounds: { x: -20, y: -30, width: 300, height: 200 } };
 const middle = interpolateLayout(a, b, .5);
 assert.deepEqual(Object.keys(middle.positions), ['one', 'added']);
 assert.deepEqual(middle.positions.one, { x: 50, y: -25, z: 10 });
 assert.deepEqual(middle.positions.added, b.positions.added);
 assert.deepEqual(interpolateLayout(a, b, 1), b);
 assert.equal(a.positions.one.x, 0);
});
