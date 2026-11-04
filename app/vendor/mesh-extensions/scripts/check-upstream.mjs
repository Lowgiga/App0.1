import {readFile} from 'node:fs/promises';import{createHash}from'node:crypto';import{resolve}from'node:path';
const root=resolve(import.meta.dirname,'..');const info=JSON.parse(await readFile(resolve(root,'upstream/provenance.json'),'utf8'));
for(const [file,hash]of Object.entries(info.files)){const local=createHash('sha256').update(await readFile(resolve(root,'upstream',file))).digest('hex');if(local!==hash)throw Error('Vendored upstream modified: '+file);try{const current=createHash('sha256').update(await readFile(resolve(root,'../cue-audit',file))).digest('hex');if(current!==hash)throw Error('Current V4 drift: '+file)}catch(e){if(e.code!=='ENOENT')throw e}}
console.log('Exact upstream schema/graph snapshot verified: '+info.commit);
