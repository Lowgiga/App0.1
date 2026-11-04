/** Add the explicit preview/commit surface after the frozen domain overlay generator. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'overlay/mesh-app.tsx');
let source=fs.readFileSync(file,'utf8');
function replaceOne(before,after,label){
 const count=source.split(before).length-1;
 if(count!==1)throw Error(`Legacy import overlay drift (${label}): expected one anchor, found ${count}`);
 source=source.replace(before,after);
}
function removeBlock(start,end,label){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 if(a<0||b<0)throw Error(`Legacy import overlay drift (${label}): block anchors missing`);
 replaceOne(source.slice(a,b),'',label);
}
replaceOne("import {LocalSourceDocument} from '../src/LocalSourceDocument';","import {LocalSourceDocument} from '../src/LocalSourceDocument';\nimport {LegacyImportPanel} from '../src/LegacyImportPanel';",'panel import');
replaceOne("import {decodeSnapshot,encodeSnapshot,mergeSnapshot} from '@/lib/work-snapshots';","import {encodeSnapshot} from '@/lib/work-snapshots';",'snapshot encoder only');
replaceOne("import type {WorkState} from '@/lib/work-contract';\n",'', 'unused work type');
replaceOne('Download,Upload,','Download,','unused upload icon');
replaceOne(' const importRef=useRef<HTMLInputElement>(null);\n','','legacy ref');
removeBlock(' async function importJSON(file?:File){',' const checks=','legacy read and merge');
replaceOne('<Button variant="outline" disabled={busy} onClick={()=>importRef.current?.click()}><Upload size={15}/>Arbeitsstand importieren</Button><input ref={importRef} className="hidden-input" type="file" accept="application/json,.json" onChange={e=>importJSON(e.target.files?.[0])}/>',`<LegacyImportPanel blocked={busy||loadingWork||storageError||!hasLoaded} active={active&&view==='evidence'} revision={work.updatedAt} onCommitted={loadWork} onExport={exportJSON} validateFile={file=>{if(file.size>3*1024*1024)throw new Error('Die Datei darf höchstens 3 MiB (3.145.728 Byte) groß sein.')}}/>`,'evidence controls');
replaceOne("detail?.kind==='import'?'Import prüfen':",'', 'detail title');
removeBlock(" {detail?.kind==='import'&&<>"," {detail?.kind==='handoff'&&<>",'old confirmation sheet');
replaceOne('<input ref={view===\'evidence\'?undefined:importRef} type="file" accept="application/json,.json" className="hidden-input" onChange={e=>importJSON(e.target.files?.[0])}/>','','legacy hidden fallback');
if(/importJSON|mergeImport|importRef|decodeSnapshot|mergeSnapshot/.test(source))throw Error('Legacy import overlay left a direct-import path');
fs.writeFileSync(file,source);
console.log('Generated guarded legacy import preview/commit UI; original files untouched.');
