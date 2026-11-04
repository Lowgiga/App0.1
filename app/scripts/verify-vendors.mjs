import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'integration-manifest.json'),'utf8'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
for(const[name,module]of Object.entries(manifest.modules)){const base=path.join(root,'vendor',name),actual=walk(base).map(p=>path.relative(base,p));if(actual.length!==Object.keys(module.files).length)throw new Error(name+' file inventory drift');for(const[file,entry]of Object.entries(module.files))if(hash(fs.readFileSync(path.join(base,file)))!==entry.installedSha256)throw new Error(name+' changed: '+file)}
console.log('Verified '+Object.keys(manifest.modules).length+' pinned modules against installed SHA-256 inventory');
