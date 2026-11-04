import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),base=path.join(root,'extensions/v7-integration');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=['app/mesh-space.tsx','app/space-renderer.tsx','app/help-panel.tsx'];
const manifest={sourceCommit:'3e921804b13e0d7c70d1ff15474f0387e84d70b6',status:'integration-layer-review-required',files:Object.fromEntries(files.map(name=>[name,{upstreamSha256:sha(path.join(root,'upstream',name)),integratedSha256:sha(path.join(base,'source',name))}]))};
fs.writeFileSync(path.join(base,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('Captured explicit V7 integration layer hashes');
