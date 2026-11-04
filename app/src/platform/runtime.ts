import {Capacitor,registerPlugin} from '@capacitor/core';
import {toast} from 'sonner';
import {createFileService,type SaveRequest} from './files.ts';
interface NativeFiles {saveText(request:SaveRequest):Promise<unknown>;copyText(request:{text:string}):Promise<{status:'copied'}>}
const plugin=registerPlugin<NativeFiles>('CueFiles');
type PickerWindow=Window & {showSaveFilePicker?:(options:unknown)=>Promise<{createWritable:()=>Promise<{write:(s:string)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>}>}>};
const native=Capacitor.isNativePlatform();
const files=createFileService({native,saveNative:request=>plugin.saveText(request),
 ...(typeof window!=='undefined'&&(window as PickerWindow).showSaveFilePicker?{pickSave:(request:SaveRequest)=>(window as PickerWindow).showSaveFilePicker!({suggestedName:request.name,types:[{description:'LowQuantFlow Export',accept:{[request.mime]:[request.mime==='application/json'?'.json':request.mime==='text/plain'?'.txt':'.md']}}]})}:{}),
 download(request){const url=URL.createObjectURL(new Blob([request.text],{type:request.mime+';charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=request.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
});
export async function saveTextFile(name:string,text:string,mime:string){
 try{const result=await files.save({name,text,mime:mime.split(';')[0] as SaveRequest['mime']});if(result.status==='saved')toast.success('Datei am gewählten Ort gespeichert.');else if(result.status==='cancelled')toast.info('Speichern abgebrochen.');else toast.info('Datei an den Browser-Download übergeben. Abschluss in den Downloads prüfen.');return result}
 catch(error){toast.error('Datei nicht bestätigt gespeichert: '+(error instanceof Error?error.message:'Unbekannter Fehler'));return{status:'error' as const}}
}
export async function copyPlatformText(text:string):Promise<void>{if(new TextEncoder().encode(text).length>1024*1024)throw new Error('Zwischenablage: Text zu groß.');if(native){const result=await plugin.copyText({text});if(result?.status!=='copied')throw new Error('Zwischenablage nicht bestätigt.')}else await navigator.clipboard.writeText(text)}
export async function copyWithFeedback(text:string){try{await copyPlatformText(text);toast.success('Text kopiert.')}catch{toast.error('Kopieren fehlgeschlagen. Wähle den Text manuell oder nutze den Datei-Export.')}}
