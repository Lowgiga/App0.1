import { readFile, mkdir, symlink, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const own=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
for (const name of [...Object.keys(own.dependencies),...Object.keys(own.devDependencies)]) {
  const target=resolve(root,name==='happy-dom'?'.test-tools/node_modules':'../android-port/node_modules',name);
  const manifest=JSON.parse(await readFile(resolve(target,'package.json'),'utf8'));
  const expected={...own.dependencies,...own.devDependencies}[name];
  if(manifest.version!==expected)throw Error(`${name}: expected ${expected}, got ${manifest.version}`);
  const dest=resolve(root,'node_modules',name);await mkdir(dirname(dest),{recursive:true});
  try { await lstat(dest); } catch { await symlink(target,dest,'dir'); }
}
await mkdir(resolve(root,'node_modules/.bin'),{recursive:true});
for(const [name,path] of Object.entries({tsc:'typescript/bin/tsc',vite:'vite/bin/vite.js'})){
 const dest=resolve(root,'node_modules/.bin',name);try{await lstat(dest)}catch{await symlink(resolve(root,'node_modules',path),dest)}
}
console.log('Verified existing runtime/build dependencies and linked read-only; happy-dom is isolated in .test-tools.');
