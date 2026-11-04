import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [name,source,accept]=process.argv.slice(2);
if(!['portable-kit','skill-core','mesh-extensions','local-workflows','adaptive-surfaces'].includes(name)||!source)throw new Error('Use vendor-module.mjs <known-name> <source-directory> [--accept=<digest>]');
const exclude=new Set(['node_modules','dist','reports','.git','.npm-cache','.test-tools','upstream']);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>exclude.has(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const original=Object.fromEntries(walk(source).map(f=>[path.relative(source,f),hash(fs.readFileSync(f))]));const contentHash=hash(JSON.stringify(original));
if(accept!=='--accept='+contentHash){console.log(JSON.stringify({name,sourceContentHash:contentHash,files:Object.keys(original).length}));process.exit(0)}
const dest=path.join(root,'vendor',name);if(fs.existsSync(dest))throw new Error('Already vendored; review removal separately');
const files={},adaptations=[];
for(const [file,sha] of Object.entries(original)){let bytes=fs.readFileSync(path.join(source,file));if(name==='mesh-extensions'&&/\.(ts|tsx)$/.test(file)){const text=bytes.toString();const next=text.replaceAll("'../upstream/lib/","'../../../upstream/lib/");if(next!==text){adaptations.push({file,change:'Domain imports rebound to canonical V5 upstream'});bytes=Buffer.from(next)}}fs.mkdirSync(path.dirname(path.join(dest,file)),{recursive:true});fs.writeFileSync(path.join(dest,file),bytes);files[file]={originalSha256:sha,installedSha256:hash(bytes)}}
const manifestPath=path.join(root,'integration-manifest.json');const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{schema:1,upstreamCommit:'2b838b4f574acfaff72013c270a1fa637eb995c6',modules:{}};manifest.modules[name]={sourceContentHash:contentHash,adaptations,files};fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');console.log('Pinned '+name+' '+contentHash);
