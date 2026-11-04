import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const overlays=new Set(['mesh-app','workspace-panels','command-center','academy-panel','mesh-space','coordination-panel','help-panel','space-renderer','spatial-levels']);
export default defineConfig({plugins:[{name:'explicit-system-overlays',enforce:'pre',resolveId(source,importer){
 if(!importer)return;
 let candidate:string|undefined;
 if(source.startsWith('.')&&(importer.startsWith(path.join(root,'upstream/app'))||importer.startsWith(path.join(root,'overlay'))))candidate=path.basename(source).replace(/\.tsx?$/,'');
 if(importer===path.join(root,'src/system-app.tsx')&&source.includes('mesh-app'))candidate='mesh-app';
 if(candidate&&overlays.has(candidate))return path.join(root,'overlay',candidate+'.tsx');
 if(importer.startsWith(path.join(root,'overlay'))&&source.startsWith('./')){for(const ext of ['.tsx','.ts']){const file=path.join(root,'upstream/app',source+ext);if(fs.existsSync(file))return file}}
 }},react()],resolve:{alias:[{find:/^@\/lib\/intelligence(?:\.ts)?$/,replacement:path.join(root,'overlay/lib/intelligence.ts')},...['learning-levels','ar-support','ar-placement','space-model','spatial-learning','ar-runtime'].map(name=>({find:new RegExp('^@/lib/'+name+'(?:\\.ts)?$'),replacement:path.join(root,'overlay/lib',name+'.ts')})),{find:'@',replacement:path.join(root,'upstream')}]},publicDir:'upstream/public',base:'/',build:{outDir:'dist',sourcemap:false,rollupOptions:{output:{manualChunks(id){if(id.includes('/three/'))return 'three';if(/\/(react|react-dom|scheduler)\//.test(id))return 'react';}}}},server:{host:'127.0.0.1',port:4173,strictPort:true},preview:{host:'127.0.0.1',port:4173,strictPort:true}});
