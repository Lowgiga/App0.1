import {personalContextContract} from './personal-continuation.ts';

export type ContinuationContext={contextId:string;contextCreatedAt:string};
export type ContinuationContextRoute={kind:'none'}|{kind:'invalid'}|{kind:'valid';context:ContinuationContext};

/** Context identity is never inferred from a title, project group, or UUID alone. */
export function readContinuationContext(href:string):ContinuationContextRoute{
 let query:URLSearchParams;
 try{query=new URL(href).searchParams}catch{return{kind:'invalid'}}
 if(!query.has('contextId')&&!query.has('contextCreatedAt'))return{kind:'none'};
 if(['contextId','contextCreatedAt','studio','studioTab'].some(key=>query.getAll(key).length>1))return{kind:'invalid'};
 const parsed=personalContextContract.safeParse({contextId:query.get('contextId'),contextCreatedAt:query.get('contextCreatedAt')});
 if(!parsed.success)return{kind:'invalid'};
 if(query.has('studio')&&query.get('studio')!=='1'||query.has('studioTab')&&query.get('studioTab')!=='memory')return{kind:'invalid'};
 // Existing Studio links retain the background workspace's view and search.
 const memoryForeground=query.get('studio')==='1'&&query.get('studioTab')==='memory';
 if(!memoryForeground&&(query.has('view')||query.has('q')))return{kind:'invalid'};
 return{kind:'valid',context:parsed.data};
}

/** A deliberate project selection replaces the old workspace search, never with draft text. */
export function continuationMemoryHref(href:string,context:ContinuationContext):string{
 const checked=personalContextContract.parse({contextId:context.contextId,contextCreatedAt:context.contextCreatedAt});
 const next=new URL(href);
 next.searchParams.delete('view');next.searchParams.delete('q');
 next.searchParams.set('studio','1');next.searchParams.set('studioTab','memory');
 next.searchParams.set('contextId',checked.contextId);next.searchParams.set('contextCreatedAt',checked.contextCreatedAt);
 return next.href;
}

