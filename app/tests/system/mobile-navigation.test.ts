import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';
const w=new Window({url:'https://localhost/?view=matrix&q=test'});Object.defineProperty(globalThis,'window',{configurable:true,value:w});Object.defineProperty(globalThis,'Event',{configurable:true,value:w.Event});
const navigation:any=await import(new URL('../../src/mobile/mobile-navigation.ts',import.meta.url).href).catch(()=>({}));
const required=()=>{assert.equal(typeof navigation.readMobileRoute,'function','mobile route adapter is implemented');return navigation;};
test('selected action derives from the current URL and validates original and Studio destinations',()=>{
 const {readMobileRoute}=required();assert.deepEqual(readMobileRoute('https://localhost/?view=matrix'),{studio:false,selectedAction:'view:matrix',studioTab:'graph'});assert.equal(readMobileRoute('https://localhost/?studio=1&studioTab=memory').selectedAction,'studio:memory');assert.equal(readMobileRoute('https://localhost/?view=unknown').selectedAction,'view:overview');assert.equal(readMobileRoute('https://localhost/?studio=1&studioTab=delete').selectedAction,'studio:graph');assert.equal(readMobileRoute('https://localhost/?studio=1&studioTab=assistant',true).selectedAction,'studio:assistant');
});
test('unavailable assistant deep links use one consistent fallback for content, hint and current marker',()=>{
 const {readMobileRoute}=required();assert.deepEqual(readMobileRoute('https://localhost/?studio=1&studioTab=assistant',false),{studio:true,studioTab:'graph',selectedAction:'studio:graph'});
});
test('Studio navigation uses browser history and a read-only route notification, preserving original location',()=>{
 const {navigateStudioTab}=required();let signals=0;const listener=()=>signals++;w.addEventListener('cue:route-changed',listener);const before=w.history.length;navigateStudioTab('backup');assert.equal(w.history.length,before+1);assert.equal(new URL(w.location.href).searchParams.get('studioTab'),'backup');assert.equal(new URL(w.location.href).searchParams.get('view'),'matrix');assert.equal(new URL(w.location.href).searchParams.get('q'),'test');assert.equal(signals,1);navigateStudioTab('backup');assert.equal(w.history.length,before+1);const url=w.location.href;assert.throws(()=>navigateStudioTab('approve'));assert.equal(w.location.href,url);w.removeEventListener('cue:route-changed',listener);
});
test.after(()=>w.happyDOM.abort());
