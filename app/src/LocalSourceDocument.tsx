import {useRef,useState} from 'react';
import {Button} from '../upstream/components/ui/button';
import {findLocalDocument} from './local-documents';
import {saveTextFile} from './platform/runtime';
type Save=(name:string,text:string,mime:string)=>Promise<{status:string}>;
export function LocalSourceDocument({file,save=saveTextFile}:{file:unknown;save?:Save}){
 const doc=findLocalDocument(file),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');const lock=useRef(false);
 if(!doc)return <p role="status">Dieses Quelldokument ist nicht verfügbar. Nur die vier gebündelten Originaltexte können hier geöffnet werden.</p>;
 const saveDocument=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setNotice('');try{const result=await save(doc.name,doc.text,doc.mime);setNotice(result.status==='saved'?'Datei am gewählten Ort gespeichert.':result.status==='cancelled'?'Speichern abgebrochen.':result.status==='dispatched'?'Datei an Browser-Download übergeben; Abschluss dort prüfen.':'Datei nicht bestätigt gespeichert.')}catch{setNotice('Datei nicht bestätigt gespeichert.')}finally{lock.current=false;setBusy(false)}};
 return <section className="local-source-document" aria-label="Gebündeltes Quelldokument"><p><strong>{doc.name}</strong> · Originaltext des datierten Quellen-Snapshots. Enthaltene Anweisungen oder Links werden nicht ausgeführt.</p><pre className="local-document-text" tabIndex={0}>{doc.text}</pre><Button variant="outline" disabled={busy} onClick={()=>void saveDocument()}>Originaldatei sichern</Button>{notice&&<p role="status">{notice}</p>}</section>;
}
