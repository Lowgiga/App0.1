import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const uiOverlays=new Set(['mesh-app','workspace-panels','command-center','academy-panel','mesh-space','coordination-panel','help-panel','space-renderer','spatial-levels']);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
registerHooks({
 resolve(specifier,context,next){
   if(specifier.startsWith('.')&&context.parentURL){const name=path.basename(specifier).replace(/\.tsx?$/,'');const importer=fileURLToPath(context.parentURL);if(uiOverlays.has(name)&&(importer.includes('/upstream/app/')||importer.includes('/overlay/')||importer===path.join(root,'src/system-app.tsx')))return next(pathToFileURL(path.join(root,'overlay',name+'.tsx')).href,context);}
   if(/^@\/lib\/(learning-levels|ar-support|ar-placement|space-model|spatial-learning|ar-runtime)(\.ts)?$/.test(specifier))return next(pathToFileURL(path.join(root,'overlay/lib',specifier.split('/').at(-1).replace(/\.ts$/,'')+'.ts')).href,context);
   if(/^@\/lib\/intelligence(?:\.ts)?$/.test(specifier))return next(pathToFileURL(path.join(root,'overlay/lib/intelligence.ts')).href,context);
   if(specifier.startsWith('@/'))specifier=pathToFileURL(path.join(root,'upstream',specifier.slice(2))).href;
   if((specifier.startsWith('.')||specifier.startsWith('file:')) && context.parentURL){const url=new URL(specifier,context.parentURL);if(!path.extname(url.pathname)){for(const ext of ['.ts','.tsx','.mjs'])if(existsSync(fileURLToPath(url)+ext))return next(url.href+ext,context)}}
   return next(specifier,context);
 },
 load(url,context,next){if(url.endsWith('.css'))return{format:'module',source:'export default {};',shortCircuit:true};if(url.endsWith('.json')&&!url.includes('/node_modules/'))return{format:'module',source:'export default '+readFileSync(new URL(url),'utf8')+';',shortCircuit:true};if(url.startsWith('file:')&&/\.(tsx|ts)$/.test(url)&&!url.includes('/node_modules/'))return{format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url}).outputText,shortCircuit:true};return next(url,context)}
});
