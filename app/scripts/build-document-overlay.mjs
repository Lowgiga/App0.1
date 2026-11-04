import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['cue-team-initialisierung.md','cue-handoff.md','low-handoff.md','make-pruefung.json'];
const documents=Object.fromEntries(files.map(name=>['/documents/'+name,{name,mime:name.endsWith('.json')?'application/json':'text/markdown',text:fs.readFileSync(path.join(root,'upstream/public/documents',name),'utf8')} ]));
fs.writeFileSync(path.join(root,'overlay/local-documents.ts'),'// Generated from the four pinned upstream snapshot documents. No runtime fetching.\nexport const documents='+JSON.stringify(documents,null,2)+' as const;\n');
console.log('Bundled four allowlisted original text documents without runtime URL loading');
