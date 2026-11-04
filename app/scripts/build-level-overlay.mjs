import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),layer=path.join(root,'extensions/level-ar');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifestBytes=fs.readFileSync(path.join(layer,'manifest.json'));if(hash(manifestBytes)!=='6600c0f710dc00a199c0715173d9e05af1d15ee60642129ec658654cdd65b190')throw new Error('Level/AR manifest drift');
const manifest=JSON.parse(manifestBytes);if(hash(fs.readFileSync(path.join(layer,'level-ar.patch')))!==manifest.patchSha256)throw new Error('Level/AR patch drift');
const outputs=new Map();
for(const file of manifest.files){const raw=fs.readFileSync(path.join(layer,'source',file.path));if(hash(raw)!==file.sha256)throw new Error('Reviewed layer changed: '+file.path);outputs.set(file.path,raw.toString())}
// Only these unchanged V7 inputs may reuse the reviewed Rev3 transformations.
for(const name of ['lib/space-model.ts','app/academy-panel.tsx']){const entry=manifest.files.find(f=>f.path===name);if(hash(fs.readFileSync(path.join(root,'upstream',name)))!==entry.baselineSha256)throw new Error('Unreviewed Level baseline: '+name)}
const v7=JSON.parse(fs.readFileSync(path.join(root,'extensions/v7-integration/manifest.json'))),provenance=JSON.parse(fs.readFileSync(path.join(root,'provenance.json')));
if(v7.sourceCommit!=='3e921804b13e0d7c70d1ff15474f0387e84d70b6'||provenance.sourceCommit!==v7.sourceCommit)throw Error('V7 integration revision mismatch');
for(const [name,pins]of Object.entries(v7.files)){const source=fs.readFileSync(path.join(root,'extensions/v7-integration/source',name));if(hash(source)!==pins.integratedSha256||hash(fs.readFileSync(path.join(root,'upstream',name)))!==pins.upstreamSha256)throw Error('V7 source/layer drift: '+name);outputs.set(name,source.toString())}
for(const name of ['lib/spatial-learning.ts','lib/ar-runtime.ts'])outputs.set(name,fs.readFileSync(path.join(root,'upstream',name),'utf8'));
for(const [name,source]of outputs){const target=path.join(root,'overlay/level-base',name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,source)}
const names=new Set([...outputs.keys()].filter(k=>k.startsWith('lib/')).map(k=>path.basename(k)));
for(const name of names){let source=outputs.get('lib/'+name);source=source.replace(/(['"])\.\/([^'"]+)\1/g,(full,q,file)=>names.has(file.endsWith('.ts')?file:file+'.ts')?full:q+'../../upstream/lib/'+file+q);
 if(name==='ar-support.ts'){
  const anchor="  if (!env.secureContext)";if(source.split(anchor).length!==2)throw new Error('AR diagnostic priority anchor drift');
  source=source.replace(anchor,"  if (env.nativeApp) return no('api-missing', 'Diese Capacitor-App nutzt Android WebView und bietet kein Browser-WebXR. Die separat integrierte native AR-Funktion ist über „AR-Hinweise öffnen“ optional und experimentell verfügbar. Eine Geräteprüfung steht noch aus. 2D und Bildschirm-3D bleiben verfügbar.');\n"+anchor);
 }
 if(name==='spatial-learning.ts')source=source.replace('Kamera-AR entsteht erst in einer freigegebenen immersiven AR-Sitzung.','Kamera-AR entsteht erst in einer freigegebenen WebXR- oder nativen ARCore-Sitzung.');
 fs.mkdirSync(path.join(root,'overlay/lib'),{recursive:true});fs.writeFileSync(path.join(root,'overlay/lib',name),source);
}
fs.mkdirSync(path.join(root,'tests/level'),{recursive:true});
let domain=outputs.get('tests/level-ar-domain.mts');domain=domain.replaceAll("'../lib/","'../../overlay/lib/");for(const name of ['work-contract','academy'])domain=domain.replaceAll("'../../overlay/lib/"+name+".ts'","'../../upstream/lib/"+name+".ts'");domain=domain.replaceAll("'../app/","'../../overlay/").replaceAll("'./lib/work-contract.ts'","'./upstream/lib/work-contract.ts'").replaceAll("'./lib/academy.ts'","'./upstream/lib/academy.ts'").replaceAll("'./lib/learning-levels.ts'","'./overlay/lib/learning-levels.ts'").replace("cwd: new URL('../', import.meta.url)","cwd: new URL('../../', import.meta.url)");domain=domain.replace("assert.doesNotMatch(renderer,/group\\.position\\.set\\(0, 0, -1\\.25\\)/);", "assert.match(renderer,/arMode === 'free'/);");
domain=domain.replace("assert.match(ui,/arStartError\\(error\\)/); assert.match(ui,/setARStatus\\(message\\)/);", "assert.match(ui,/diagnoseARFailure\\(error\\)/); assert.match(ui,/setDiagnosis\\(detail\\)/);");
domain=domain.replace("/placement !== 'surface-found'/", "/!arState.canPlace/");
domain=domain.replace("/hitResource\\?\\.dispose\\(\\)/","/owned.dispose\\(\\)/");
fs.writeFileSync(path.join(root,'tests/level/level-ar-domain.mts'),domain);
let renderer=outputs.get('tests/level-ar-renderer.mjs');renderer=renderer.replaceAll("'../node_modules/","'../../node_modules/").replace("new URL('../app/space-renderer.tsx',import.meta.url)","new URL('../../overlay/space-renderer.tsx',import.meta.url)").replace('new URL(`../lib/${id.slice(\'@/lib/\'.length)}.ts`,import.meta.url)','new URL(`../../overlay/lib/${id.slice(\'@/lib/\'.length)}.ts`,import.meta.url)');renderer=renderer.replace("const overlay={hidden:true}","const overlay=Object.assign(new Emitter(),{hidden:true})").replace("isSecureContext:true,DOMException", "isSecureContext:true,performance,DOMException").replace("onPlacement(v){states.placement=v}","onPlacement(v){states.placement=v},onARState(v){states.arState=v;states.placement=v.phase==='surface-found'?'surface-found':v.phase==='placed'?'placed':'scanning'}");
renderer=renderer.replace("const frame=matrix=>({getHitTestResults", "const frame=matrix=>({getViewerPose(){return{transform:{matrix:pose(0),orientation:{x:0,y:0,z:0,w:1}}}},getHitTestResults");
renderer=renderer.replace("id.startsWith('@/lib/')?","id==='../src/appearance/web-three.ts'?nativeRequire(new URL('../../src/appearance/web-three.ts',import.meta.url).pathname):id.startsWith('@/lib/')?");
fs.writeFileSync(path.join(root,'tests/level/level-ar-renderer.mjs'),renderer);
let fixture=renderer.split('// Real installed Three.js XR manager')[0].replace('  const local=deferred()', '  const clock={value:0},requests=[];\n  const local=deferred()').replace('isSecureContext:true,performance,DOMException','isSecureContext:true,performance:{now:()=>clock.value},DOMException').replace('requestSession:async()=>{requestCalls++;','requestSession:async(mode,init)=>{requests.push({mode,init});requestCalls++;').replace('return{session,states,renderer:', 'return{props,media,clock,requests,session,states,renderer:');
fixture=fixture.replace('pendingViewer=false}={}', 'pendingViewer=false,holographic=false,allowMotion=false,powerSaver=false}={}').replace('moving:false,powerSaver:false,allowMotion:false,controls:', 'moving:false,powerSaver,allowMotion,holographic,controls:').replace('return{props,media,clock,requests,', 'return{props,media,document,clock,requests,');
// Retain hook refs and compare effect dependencies for appearance-only rerender lifecycle tests.
fixture=fixture.replace('  const effects=[];let refs=0;\n  const hooks={useRef(v){return{current:refs++===0?host:v}},useEffect(fn){effects.push(fn)}};', `  const effects=[],slots=[],effectSlots=[];let refs=0,effectIndex=0;
  const hooks={useRef(v){const index=refs++;return slots[index]??=( {current:index===0?host:v})},useEffect(fn,deps){const index=effectIndex++,prior=effectSlots[index];if(!prior||deps.some((v,i)=>!Object.is(v,prior.deps[i]))){effects.push(()=>{prior?.cleanup?.();const cleanup=fn();effectSlots[index]={deps,cleanup};return cleanup})}}};`);
fixture=fixture.replace('return{props,media,document,clock,requests,', 'return{update(next){Object.assign(props,next);refs=0;effectIndex=0;effects.length=0;context.exports.default(props);effects.forEach(fn=>fn());},props,media,document,clock,requests,');
fixture=fixture.replace('unmount(){for(const cleanup of cleanups)cleanup()}', 'unmount(){for(const effect of effectSlots)effect?.cleanup?.()}');
fs.writeFileSync(path.join(root,'tests/level/renderer-fixture.mjs'),fixture+'\nexport {mount,tick,deferred};\n');
console.log('Generated explicit V7 layer plus reviewed Academy/graph/abort primitives, with one shared graph contract');
