import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';
const w=new Window({url:'https://localhost/'});for(const k of ['window','document','Node','Element','HTMLElement','Event','MouseEvent','MutationObserver'] as const)Object.defineProperty(globalThis,k,{configurable:true,value:k==='window'?w:(w as any)[k]});Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');const {NativeARPanel}=await import('../../src/NativeARPanel.tsx');const {buildSpaceGraph}=await import('../../overlay/lib/space-model.ts');const {emptyWork}=await import('../../upstream/lib/work-contract.ts');
test('appearance-only preview changes reject an in-flight native return without changing WorkState',async()=>{
 const work=emptyWork(),before=JSON.stringify(work),base=buildSpaceGraph(work,[],true);let color='#123456';
 const selected:string[]=[],details:string[]=[];let snapshot:any,finish!:(value:any)=>void;
 const service={native:true,availability:async()=>({available:true,status:'supported-installed' as const}),open:async(s:any)=>{snapshot=s;return new Promise<any>(resolve=>finish=resolve)}};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=()=>act(async()=>root.render(<React.StrictMode><NativeARPanel graph={{...base,nodes:base.nodes.map(n=>({...n,appearance:{core:'#112233',shell:color,orbit:'#778899',shape:'cube',size:'large',motion:'breathe'}}))}} work={work} known scope="all" disabled={false} onSelect={id=>selected.push(id)} onOpenDetails={id=>details.push(id)} onSettings={()=>{}} service={service}/></React.StrictMode>));
 try{await render();const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('AR-Hinweise öffnen'));assert.ok(button);await act(async()=>button.click());assert.equal(snapshot.version,2);assert.equal(snapshot.nodes[0].appearance.shell,color);color='#ABCDEF';await render();await act(async()=>finish({status:'closed',placed:true,snapshotRevision:snapshot.snapshotRevision,selectedNodeId:snapshot.nodes[0].id,openDetails:true}));assert.deepEqual(selected,[]);assert.deepEqual(details,[]);assert.match(host.textContent??'',/veraltet/);assert.equal(JSON.stringify(work),before)}finally{await act(async()=>root.unmount());host.remove()}
});
test('native motion explanation identifies both the per-node Atmen choice and session opt-in',async()=>{
 const work=emptyWork(),host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>root.render(<NativeARPanel graph={buildSpaceGraph(work,[],true)} work={work} known scope="all" disabled={false} onSelect={()=>{}} onSettings={()=>{}}/>));assert.match(host.textContent??'',/Atmen/);assert.match(host.textContent??'',/Sitzung/)}finally{await act(async()=>root.unmount());host.remove();await w.happyDOM.abort()}
});
