import {LoadingManager,type Object3D,type Material,type Texture,type BufferGeometry} from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';

export const COMPANION_ASSET_BYTES=754252;
export const COMPANION_TRIANGLES=19128;
/** Guard for this bundled asset only. This is intentionally not a user importer. */
export function inspectBundledGLB(bytes:ArrayBuffer):{meshes:number;triangles:number}{
 if(bytes.byteLength!==COMPANION_ASSET_BYTES||bytes.byteLength>1024*1024)throw new Error('Unexpected companion asset size');
 const view=new DataView(bytes);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw new Error('Invalid bundled GLB');
 const length=view.getUint32(12,true);
 if(length<2||20+length+8>bytes.byteLength)throw new Error('Invalid GLB JSON chunk');
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
 if(json.asset?.version!=='2.0'||json.buffers?.length!==1||json.buffers.some((b:any)=>b.uri!==undefined)||(json.images??[]).some((i:any)=>i.uri!==undefined)||(json.extensionsRequired??[]).length)throw new Error('Bundled model must be self-contained');
 const bin=20+length;
 if(view.getUint32(bin+4,true)!==0x004e4942||bin+8+view.getUint32(bin,true)!==bytes.byteLength)throw new Error('Invalid GLB BIN chunk');
 let triangles=0;
 for(const mesh of json.meshes??[])for(const primitive of mesh.primitives??[]){
  if(primitive.mode!==undefined&&primitive.mode!==4)throw new Error('Unsupported primitive');
  const count=json.accessors?.[primitive.indices??primitive.attributes?.POSITION]?.count;
  if(!Number.isSafeInteger(count)||count<0||count%3!==0)throw new Error('Invalid primitive count');triangles+=count/3;
 }
 if(json.meshes?.length!==66||triangles!==COMPANION_TRIANGLES)throw new Error('Unexpected model budget');
 return {meshes:json.meshes.length,triangles};
}
export function decodeInlineAsset(data:string):ArrayBuffer{
 if(!/^data:[^;,]*;base64,/.test(data)||data.length>1_100_000)throw new Error('Only the bundled inline asset is accepted');
 const binary=atob(data.slice(data.indexOf(',')+1)),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 inspectBundledGLB(bytes.buffer);return bytes.buffer;
}
const aborted=()=>new DOMException('Companion load cancelled','AbortError');
export async function parseOfflineCompanion(bytes:ArrayBuffer,signal:AbortSignal):Promise<GLTF>{
 if(signal.aborted)throw aborted();inspectBundledGLB(bytes);
 const manager=new LoadingManager();
 manager.setURLModifier(()=>{throw new Error('Companion external resources are disabled')});
 const gltf=await new GLTFLoader(manager).parseAsync(bytes,'');
 if(signal.aborted){disposeModel(gltf.scene);throw aborted()}
 return gltf;
}
/** Shared resources are released once even when referenced by several meshes. */
export function disposeModel(root:Object3D){
 const geometries=new Set<BufferGeometry>(),materials=new Set<Material>(),textures=new Set<Texture>();
 root.traverse(object=>{
  const mesh=object as Object3D & {geometry?:BufferGeometry;material?:Material|Material[]};
  if(mesh.geometry)geometries.add(mesh.geometry);
  for(const material of mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[]){
   materials.add(material);
   for(const value of Object.values(material))if(value&&typeof value==='object'&&'isTexture' in value&&value.isTexture)textures.add(value as Texture);
  }
 });
 geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
}
