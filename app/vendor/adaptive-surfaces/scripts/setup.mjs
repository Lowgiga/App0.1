// Optional local bootstrap: links only already installed, pinned dependencies.
// A fresh checkout can instead use npm install in this package.
import {readFile, mkdir, symlink, access} from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
for (const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})) {
 const base = name==='happy-dom'?'mesh-extensions/.test-tools':'android-port';
 const target=path.resolve(root,'..',base,'node_modules',name);
 const installed=JSON.parse(await readFile(path.join(target,'package.json'),'utf8'));
 if(installed.version!==version) throw new Error(`Dependency version mismatch: ${name}`);
 const dest=path.join(root,'node_modules',name); await mkdir(path.dirname(dest),{recursive:true});
 try{await access(dest)}catch{await symlink(target,dest,'dir')}
}

await mkdir(path.join(root,'node_modules/.bin'),{recursive:true});
for(const [bin,target] of Object.entries({tsc:'../typescript/bin/tsc',vite:'../vite/bin/vite.js'})){try{await access(path.join(root,'node_modules/.bin',bin))}catch{await symlink(target,path.join(root,'node_modules/.bin',bin))}}
