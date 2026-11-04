import {env} from 'cloudflare:workers';
import {savedWorkContract,emptyWork} from './work-contract';
interface Statement{bind(...values:unknown[]):Statement;first<T>():Promise<T|null>;run():Promise<{meta:{changes:number}}>}
interface Store{prepare(sql:string):Statement}
export function database(){const db=(env as unknown as {DB?:Store}).DB;if(!db)throw new Error('Storage unavailable');return db}
export async function readWork(userId:string){const row=await database().prepare('SELECT payload, updated_at FROM mesh_work WHERE user_id = ?').bind(userId).first<{payload:string;updated_at:string}>();return row?savedWorkContract.parse({...JSON.parse(row.payload),updatedAt:row.updated_at}):emptyWork()}
export async function writeWork(userId:string,payload:Record<string,unknown>,expectedUpdatedAt:string|null){const updatedAt=new Date(Math.max(Date.now(),expectedUpdatedAt?Date.parse(expectedUpdatedAt)+1:0)).toISOString();const result=await database().prepare('INSERT INTO mesh_work (user_id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at WHERE mesh_work.updated_at = ?').bind(userId,JSON.stringify(payload),updatedAt,expectedUpdatedAt||'').run();if(!result.meta.changes)return null;return {...payload,updatedAt}}
