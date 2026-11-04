import test from 'node:test';
import assert from 'node:assert/strict';
const viewport: any = await import(new URL('../../src/mobile/mobile-viewport.ts', import.meta.url).href).catch(() => ({}));
const required = () => { assert.equal(typeof viewport.mobileViewportMetrics, 'function', 'viewport calculation is implemented'); return viewport; };

test('viewport inset subtracts height and top offset, and clamps invalid values', () => {
  const {mobileViewportMetrics} = required();
  assert.deepEqual(mobileViewportMetrics(800, {height:500,offsetTop:20,scale:1}), {bottomInset:280,keyboardOccluded:true});
  assert.deepEqual(mobileViewportMetrics(800, {height:780,offsetTop:20,scale:1}), {bottomInset:0,keyboardOccluded:false});
  assert.deepEqual(mobileViewportMetrics(800, {height:900,offsetTop:0,scale:1}), {bottomInset:0,keyboardOccluded:false});
  for (const value of [null, {height:NaN,offsetTop:0,scale:1}, {height:-1,offsetTop:0,scale:1}]) assert.deepEqual(mobileViewportMetrics(800,value), {bottomInset:0,keyboardOccluded:false});
});

test('pinch zoom is not treated as a keyboard and small browser chrome changes do not hide navigation', () => {
  const {mobileViewportMetrics} = required();
  assert.deepEqual(mobileViewportMetrics(800,{height:400,offsetTop:0,scale:2}), {bottomInset:0,keyboardOccluded:false});
  assert.deepEqual(mobileViewportMetrics(800,{height:760,offsetTop:0,scale:1}), {bottomInset:40,keyboardOccluded:false});
});
