import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultAppearanceState,parseAppearanceState} from '../../src/appearance/contracts.ts';
const binding={kind:'room',id:'4c212008-fec2-4489-b1ca-dc7026e2e2a9',createdAt:'2026-10-05T12:00:00.000Z'};
test('partial appearance fields reject explicit undefined instead of treating it as absence',()=>{
 for(const field of ['core','shell','orbit','shape','size','motion']){
  assert.throws(()=>parseAppearanceState({...defaultAppearanceState(),global:{[field]:undefined}}),/APPEARANCE_INVALID/,`global.${field}`);
  assert.throws(()=>parseAppearanceState({...defaultAppearanceState(),overrides:[{binding,style:{[field]:undefined}}]}),/APPEARANCE_INVALID/,`override.${field}`);
 }
 assert.deepEqual(parseAppearanceState(defaultAppearanceState()),defaultAppearanceState());
});
test('appearance starts with independent empty preferences and normalizes exact six-digit HEX colors',()=>{
 const a=defaultAppearanceState(),b=defaultAppearanceState();a.global.core='#abcdef';assert.deepEqual(b,{schema:'lowquantflow.appearance/v1',global:{},overrides:[]});
 const input={...b,global:{core:'#aAbB09',shell:'#000000',orbit:'#ffffff',shape:'cube',size:'large',motion:'breathe'},overrides:[{binding,style:{size:'small'}}]};
 const result=parseAppearanceState(input);assert.equal(result.global.core,'#AABB09');assert.notEqual(result.global,input.global);
});
test('appearance rejects unsupported schemas, fields, malformed identities, colors and enums',()=>{
 const base=defaultAppearanceState();for(const raw of [null,undefined,{...base,schema:'lowquantflow.appearance/v2'},{...base,extra:true},{...base,global:{core:'#abc'}},{...base,global:{core:'red'}},{...base,global:{core:'#fffffff'}},{...base,global:{shell:'#12345g'}},{...base,global:{shape:'sphere'}},{...base,global:{size:1}},{...base,global:{motion:'spin'}},{...base,global:{opacity:0.5}},{...base,overrides:[{binding:{...binding,createdAt:''},style:{}}]},{...base,overrides:[{binding:{...binding,id:'fake'},style:{}}]},{...base,overrides:[{binding:{...binding,kind:'task'},style:{}}]},{...base,overrides:[{binding,style:{},extra:true}]}])assert.throws(()=>parseAppearanceState(raw));
});
test('appearance bounds retained overrides and rejects duplicate entity incarnations without eviction',()=>{
 const base=defaultAppearanceState();const entry={binding,style:{core:'#123456'}};
 assert.throws(()=>parseAppearanceState({...base,overrides:[entry,entry]}));
 const overrides=Array.from({length:256},()=>({binding:{...binding,id:crypto.randomUUID()},style:{}}));assert.equal(parseAppearanceState({...base,overrides}).overrides.length,256);
 assert.throws(()=>parseAppearanceState({...base,overrides:[...overrides,entry]}));
 assert.equal(parseAppearanceState({...base,overrides:[entry,{...entry,binding:{...binding,createdAt:'2026-10-05T12:01:00.000Z'}}]}).overrides.length,2);
 assert.throws(()=>parseAppearanceState({...base,global:{core:'x'.repeat(262145)}}));
});
