import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=path.join(root,'extensions/domain-fixes'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const raw=fs.readFileSync(path.join(base,'freeze.json'));if(hash(raw)!=='c5ef75a267f3a7f871a3f02639ce5e91ded01c417becdda7289e48a190ac74fb')throw Error('Domain kit freeze changed');
const m=JSON.parse(raw);for(const [name,sha]of Object.entries(m.files))if(hash(fs.readFileSync(path.join(base,name)))!==sha)throw Error('Domain kit changed: '+name);
for(const name of ['scripts/build-domain-overlays.mjs','tests/domain-fixes.test.mjs','src/task-review-impact.ts'])if(hash(fs.readFileSync(path.join(root,name)))!==m.files['files/'+name+(name.endsWith('.ts')?'.txt':'')])throw Error('Installed reviewed domain file changed: '+name);
console.log('Verified reviewed domain fixes and installed generator/tests; original contracts unchanged');
