import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
// Build output only; regular files avoid unsupported tar hardlink members.
const output=process.argv[2];
if(!output || !path.isAbsolute(output) || !output.endsWith('.tar.gz')) throw new Error('Absolute .tar.gz output path required.');
const root=process.cwd();
if(path.resolve(execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim())!==root) throw new Error('Run from app project root.');
for(const file of ['dist/.openai/hosting.json','dist/server/index.js','dist/.openai/drizzle/0000_ambitious_squirrel_girl.sql']) if(!fs.statSync(file).isFile())throw new Error('Build artifact missing: '+file);
const scan=dir=>{for(const file of fs.readdirSync(dir)){const p=path.join(dir,file),s=fs.lstatSync(p);if(s.isSymbolicLink())throw new Error('Unexpected symlink in build output');if(s.isDirectory())scan(p);else if(!s.isFile())throw new Error('Unsupported build file type');if(file==='.env'||file.startsWith('.env.'))throw new Error('Environment file must not be packaged');}};scan(path.join(root,'dist'));
const result=spawnSync('tar',['--hard-dereference','-czf',output,'-C',path.join(root,'dist'),'.openai','-C',root,'dist'],{stdio:'inherit'});
if(result.status!==0)throw new Error('Release packaging failed');
console.log(JSON.stringify({archive:output,bytes:fs.statSync(output).size,entrypoint:'dist/server/index.js',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),qualification:'Build package only; source must be clean, pushed and matching before Sites save/deploy.'}));
