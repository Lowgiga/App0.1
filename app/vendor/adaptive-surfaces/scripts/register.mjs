import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
registerHooks({load(url,context,next){if(url.startsWith('file:')&&/\.(tsx|ts)$/.test(url)&&!url.includes('/node_modules/')){const code=ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url}).outputText;return{format:'module',source:code,shortCircuit:true}}return next(url,context)}});
