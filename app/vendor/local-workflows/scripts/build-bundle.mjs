/** Build-time only. Rebuild after reviewing changes to skill-core's trusted packages. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createCatalog} from '../../skill-core/src/loader.mjs';
const root=new URL('../../skill-core/skills/',import.meta.url);
const catalog=createCatalog({root:fileURLToPath(root)});
const bundles=catalog.list().map(m=>{
 if(catalog.verify(m.id).status!=='passed') throw new Error('Source package verification failed');
 const dir=new URL(m.name+'/',root);
 const read=p=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(fs.readFileSync(new URL(p,dir)));
 return {directory:m.name,manifest:read('cue-skill.json'),files:Object.fromEntries(m.files.map(f=>[f.path,read(f.path)]))};
});
fs.writeFileSync(new URL('../src/bundled-skills.mjs',import.meta.url),'// Generated static local package data. Not executable skill instructions.\nexport const bundledSkills = '+JSON.stringify(bundles,null,2)+';\n');
console.log(`Bundled ${bundles.length} verified local packages`);
