import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const dist=path.join(root,'dist');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const files=Object.fromEntries(walk(dist).sort().map(file=>[path.relative(dist,file).replaceAll(path.sep,'/'),hash(fs.readFileSync(file))]));
const provenance=JSON.parse(fs.readFileSync(path.join(root,'provenance.json'),'utf8'));
const manifest={generatedAt:new Date().toISOString(),sourceCommit:provenance.sourceCommit,sourceLabel:provenance.sourceLabel??'Unlabeled source',status:'Final upstream source imported; local-port preview NOT runtime-approved',distContentSha256:hash(JSON.stringify(files)),packageLockSha256:hash(fs.readFileSync(path.join(root,'package-lock.json'))),files};
fs.writeFileSync(path.join(root,'docs/build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({...manifest,files:Object.keys(files).length},null,2));
