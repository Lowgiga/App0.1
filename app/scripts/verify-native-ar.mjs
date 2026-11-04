import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const raw=fs.readFileSync(path.join(root,'extensions/native-ar/source-manifest.json'));
if(hash(raw)!=='04feda4a1ba41d5bb0781d167b26be6a58f369f766fc8b3bf5f68f1011ecf8ea')throw Error('Pinned native AR manifest changed');
const manifest=JSON.parse(raw),base=path.join(root,'android/cue-native-ar');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).filter(e=>!['build','.gradle'].includes(e.name)).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
if(walk(base).length!==manifest.files.length)throw Error('Native AR module inventory drift');
for(const f of manifest.files)if(hash(fs.readFileSync(path.join(base,f.path.slice('android/'.length))))!==f.sha256)throw Error('Native AR source drift: '+f.path);
console.log('Verified native AR revision 10: all '+manifest.files.length+' pinned module files byte-identical');
