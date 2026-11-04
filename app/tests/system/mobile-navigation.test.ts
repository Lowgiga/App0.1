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
const memoryHref='https://localhost/?studio=1&studioTab=memory&contextId=b1111111-1111-4111-8111-111111111111&contextCreatedAt=2026-10-04T12%3A00%3A00.000Z';
test('Memory to Assistant emits a clean URL and explicit Memory return restores the exact incarnation',()=>{
 w.history.replaceState({},'',memoryHref);const {navigateStudioTab}=required();navigateStudioTab('assistant');const assistant=new URL(w.location.href);assert.equal(assistant.searchParams.has('contextId'),false);assert.equal(assistant.searchParams.has('contextCreatedAt'),false);assert.equal(assistant.searchParams.get('studioTab'),'assistant');navigateStudioTab('memory');assert.equal(w.location.href,memoryHref);
});
test('Back and Forward keep clean Assistant and the original Memory incarnation',async()=>{
 w.history.replaceState({},'',memoryHref);const {navigateStudioTab}=required();navigateStudioTab('assistant');const assistant=w.location.href;assert.ok(!assistant.includes('contextId'));w.history.back();await new Promise(r=>setTimeout(r,15));assert.equal(w.location.href,memoryHref);w.history.forward();await new Promise(r=>setTimeout(r,15));assert.equal(w.location.href,assistant);navigateStudioTab('memory');assert.equal(w.location.href,memoryHref);
});
test('a malformed Memory identity is not retained as a hidden return target',()=>{
 w.history.replaceState({},'',memoryHref.replace('contextId=b1111111-1111-4111-8111-111111111111','contextId=invalid'));const {navigateStudioTab}=required();navigateStudioTab('assistant');assert.ok(!w.location.href.includes('contextId'));navigateStudioTab('memory');assert.equal(new URL(w.location.href).searchParams.has('contextId'),false);
});
test.after(()=>w.happyDOM.abort());

test('Memory return rejects malformed History metadata and never overrides explicit foreign link identity',()=>{
 const {navigateStudioTab}=required();w.history.replaceState({},'',memoryHref);navigateStudioTab('assistant');const valid=structuredClone(w.history.state) as {lowQuantFlowMemoryReturn:{schema:string;studioTab:string;context:{contextId:string;contextCreatedAt:string}}},clean=w.location.href;
 const variants=[null,{lowQuantFlowMemoryReturn:{...valid.lowQuantFlowMemoryReturn,schema:'unknown'}},{lowQuantFlowMemoryReturn:{...valid.lowQuantFlowMemoryReturn,studioTab:'graph'}},{lowQuantFlowMemoryReturn:{...valid.lowQuantFlowMemoryReturn,context:{contextId:valid.lowQuantFlowMemoryReturn.context.contextId}}},{lowQuantFlowMemoryReturn:{...valid.lowQuantFlowMemoryReturn,extra:true}}];
 for(const state of variants){w.history.replaceState(state,'',clean);navigateStudioTab('memory');assert.equal(new URL(w.location.href).searchParams.has('contextId'),false)}
 w.history.replaceState(valid,'',clean+'&contextId=foreign');navigateStudioTab('memory');assert.equal(new URL(w.location.href).searchParams.get('contextId'),'foreign');assert.equal(new URL(w.location.href).searchParams.has('contextCreatedAt'),false);
});

test('History return cannot authorize a context for an unknown or identity-free Memory destination',()=>{
 const {navigateStudioTab}=required();w.history.replaceState({},'',memoryHref);navigateStudioTab('assistant');const valid=structuredClone(w.history.state) as any;
 for(const tab of ['unknown','memory']){w.history.replaceState({lowQuantFlowMemoryReturn:{...valid.lowQuantFlowMemoryReturn,studioTab:tab}},'','https://localhost/?studio=1&studioTab='+tab);navigateStudioTab('memory');assert.equal(new URL(w.location.href).searchParams.has('contextId'),false)}
});
