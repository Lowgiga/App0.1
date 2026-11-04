import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseOfflineCompanion,disposeModel,decodeInlineAsset,inspectBundledGLB} from '../../src/companion/offline-asset.ts';
const bytes=()=>{const b=readFileSync(new URL('../../src/companion/assets/paz-companion.glb',import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};
test('audited GLB stays within 1 MiB and exact 19,128-triangle budget with six animation clips',async()=>{
 const b=bytes();assert.equal(b.byteLength,754252);assert.ok(b.byteLength<=1024*1024);
 assert.equal(createHash('sha256').update(new Uint8Array(b)).digest('hex'),'5f7ebfb79deb100e2210aab170a99e2960b0f09f123105ecdd2e424e32de2992');
 const info=inspectBundledGLB(b);assert.equal(info.triangles,19128);assert.equal(info.meshes,66);
 const old=globalThis.fetch;let fetches=0;globalThis.fetch=async()=>{fetches++;throw new Error('Network forbidden')};
 try{const gltf=await parseOfflineCompanion(b,new AbortController().signal);assert.deepEqual(gltf.animations.map(c=>c.name),['Walk','Idle','Think','Celebrate','Idea','Caution']);assert.equal(fetches,0);disposeModel(gltf.scene)}finally{globalThis.fetch=old}
});
test('inline Vite asset bytes decode without fetch and unsupported inputs fail closed',()=>{
 const b=bytes(),encoded='data:model/gltf-binary;base64,'+Buffer.from(b).toString('base64');
 assert.deepEqual(new Uint8Array(decodeInlineAsset(encoded)),new Uint8Array(b));
 assert.throws(()=>decodeInlineAsset('https://example.com/model.glb'));assert.throws(()=>inspectBundledGLB(new ArrayBuffer(100)));
});
test('pre-aborted parse does no work',async()=>{const abort=new AbortController();abort.abort();await assert.rejects(()=>parseOfflineCompanion(bytes(),abort.signal),{name:'AbortError'})});
test('shared geometry and material resources are disposed exactly once',()=>{
 let geometry=0,material=0,texture=0;
 const g={dispose(){geometry++}},t={isTexture:true,dispose(){texture++}},m={map:t,dispose(){material++}};
 disposeModel({traverse(cb:Function){cb({geometry:g,material:[m,m]});cb({geometry:g,material:m})}} as any);
 assert.deepEqual({geometry,material,texture},{geometry:1,material:1,texture:1});
});
