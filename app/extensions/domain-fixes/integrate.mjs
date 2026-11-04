/** Preflight/apply this reviewed kit only to a separate Android candidate. Never edits upstream/. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const kit=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(process.argv[2]||'');
const mode=process.argv[3];if(!process.argv[2]||!['--check','--apply'].includes(mode))throw new Error('Use: node integrate.mjs TARGET --check|--apply');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=JSON.parse(fs.readFileSync(path.join(kit,'input-contract.json'),'utf8'));
for(const [name,digest] of Object.entries(expected.domainSources))if(hash(fs.readFileSync(path.join(root,'upstream/lib',name)))!==digest)throw new Error('Domain source changed; re-review required: '+name);
const writes=new Map();
function edit(name,before,after){let s=writes.get(name)??fs.readFileSync(path.join(root,name),'utf8');const n=s.split(before).length-1;if(n!==1)throw new Error(`Integration drift ${name}: expected one anchor, found ${n}`);writes.set(name,s.replace(before,after));}
edit('scripts/build-overlay.mjs',"await import('./build-sidebar-overlay.mjs');","await import('./build-sidebar-overlay.mjs');\nawait import('./build-domain-overlays.mjs');");
for(const name of ['work-updates','intelligence-actions','intelligence'])edit('src/local-domain.ts',`'../upstream/lib/${name}.ts'`,`'../overlay/lib/${name}.ts'`);
edit('src/local-domain.ts','/** Mirrors upstream state route, using unchanged production domain functions. */','/** Local state route: frozen contracts plus explicit canonical-event overlay. */');
edit('scripts/register.mjs',"   if(specifier.startsWith('@/'))","   if(/^@\\/lib\\/intelligence(?:\\.ts)?$/.test(specifier))return next(pathToFileURL(path.join(root,'overlay/lib/intelligence.ts')).href,context);\n   if(specifier.startsWith('@/'))");
edit('vite.config.ts','resolve:{alias:[',"resolve:{alias:[{find:/^@\\/lib\\/intelligence(?:\\.ts)?$/,replacement:path.join(root,'overlay/lib/intelligence.ts')},");
edit('tsconfig.json','"@/lib/space-model": [','"@/lib/intelligence": [\n        "overlay/lib/intelligence.ts"\n      ],\n      "@/lib/space-model": [');
for(const name of ['scripts/build-domain-overlays.mjs','tests/domain-fixes.test.mjs','src/task-review-impact.ts']){if(fs.existsSync(path.join(root,name)))throw new Error('Target already contains kit file; do not apply twice: '+name);writes.set(name,fs.readFileSync(path.join(kit,'files',name+(name.endsWith('.ts')?'.txt':'')),'utf8'));}
// No replacement file is written before all anchors and immutable source hashes pass.
if(mode==='--apply')for(const [name,content] of writes){fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),content)}
console.log(`${mode==='--apply'?'Applied':'Preflight passed'}: ${writes.size} explicit files; no upstream changes. Next: node scripts/build-overlay.mjs, node --test tests/domain-fixes.test.mjs, npm test, npm run build.`);
