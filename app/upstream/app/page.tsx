import MeshApp from './mesh-app';
import data from '@/lib/mesh-data.json';
import {viewIds} from '@/lib/work-contract';

export const dynamic = 'force-dynamic';

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const params=await searchParams;const v=typeof params.view==='string'&&viewIds.includes(params.view as any)?params.view as typeof viewIds[number]:'overview';
 return <MeshApp data={data} initialView={v} initialQuery={typeof params.q==='string'?params.q:''} explicitView={typeof params.view==='string'}/>;
}
