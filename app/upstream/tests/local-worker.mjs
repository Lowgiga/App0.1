// Own compiled Cloudflare Worker, isolated D1; no Wrangler hot-reload proxy.
import { Miniflare } from 'miniflare';
import fs from 'node:fs';
import path from 'node:path';
const output = process.env.MESH_AUDIT_OUTPUT || '/workspace/scratch/b8715f176960/cue-audit';
const serverRoot=path.resolve('dist/server');
const modules=['index.js',...fs.readdirSync(serverRoot,{recursive:true}).filter(f=>f!=='index.js'&&/\.m?js$/.test(f))].map(f=>({type:'ESModule',path:path.join(serverRoot,f)}));
const mf = new Miniflare({
  modules, modulesRoot:serverRoot,
  compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  host:'127.0.0.1',port:8787,cf:false,
  d1Databases:{DB:'cue-local-audit'},d1Persist:path.join(output,'isolated-d1'),
});
await mf.ready;
const db = await mf.getD1Database('DB');
await db.exec(fs.readFileSync('drizzle/0000_ambitious_squirrel_girl.sql','utf8').replace('CREATE TABLE','CREATE TABLE IF NOT EXISTS').replace(/\s+/g,' '));
const plan=await db.prepare('EXPLAIN QUERY PLAN SELECT payload, updated_at FROM mesh_work WHERE user_id = ?').bind('local-plan').all();
fs.writeFileSync(path.join(output,'QUERY_PLAN.json'),JSON.stringify(plan.results,null,2));
console.log('Own isolated API test worker ready');
await new Promise(resolve=>{
  for(const signal of ['SIGTERM','SIGINT']) process.once(signal,()=>mf.dispose().then(resolve));
});
