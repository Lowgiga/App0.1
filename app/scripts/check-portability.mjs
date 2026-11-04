import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>['node_modules','build','.gradle'].includes(e.name)?[]:e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
for(const scope of ['src','overlay','scripts','android'])for(const file of walk(path.join(root,scope)))if(/\.(ts|tsx|mjs|json|java|gradle|properties|sh)$/.test(file)){const text=fs.readFileSync(file,'utf8');if(/(?:["'=])\/(?:workspace|home\/agent|tmp)\//.test(text))throw new Error('Absolute development path in '+path.relative(root,file));}
if(fs.existsSync(path.join(root,'android/local.properties')))throw new Error('Machine-specific local.properties must not be packaged');
console.log('Runtime, overlays, build scripts and Android sources have no absolute development paths or local SDK config');
