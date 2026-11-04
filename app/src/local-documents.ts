import {documents} from '../overlay/local-documents';
export type LocalDocument={readonly name:string;readonly mime:'application/json'|'text/markdown';readonly text:string};
export function findLocalDocument(path:unknown):LocalDocument|null{return typeof path==='string'&&Object.hasOwn(documents,path)?documents[path as keyof typeof documents]:null}
