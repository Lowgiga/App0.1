import {viewIds} from '../upstream/lib/work-contract.ts';
type ViewId=typeof viewIds[number];
export type SystemNavigation={view:ViewId;query?:string};
export function validNavigation(input:unknown):input is SystemNavigation {if(!input||typeof input!=='object')return false;const value=input as Record<string,unknown>;return Object.keys(value).every(k=>['view','query'].includes(k))&&viewIds.includes(value.view as ViewId)&&(value.query===undefined||typeof value.query==='string'&&value.query.length<=200)}
export function navigateOriginal(target:SystemNavigation){if(!validNavigation(target))throw new Error('Invalid navigation target');window.dispatchEvent(new CustomEvent('cue:navigate',{detail:target}))}
