/** Place app-level navigation in the existing toolbar, never a second header. */
export function applySystemMenu(source){
 const replace=(before,after)=>{const count=source.split(before).length-1;if(count!==1)throw new Error(`System menu drift: expected one anchor, got ${count}: ${before.slice(0,90)}`);source=source.replace(before,after)};
 replace("'use client';","'use client';\nimport {SystemModeMenu} from '../src/SystemModeMenu.tsx';");
 replace('<div className="topbar-right"><span className="snapshot-label">Snapshot · 29. Sep. 2026</span>','<div className="topbar-right">');
 replace('<Download size={15}/>Export</Button></div></header>','<Download size={15}/>Export</Button><SystemModeMenu active={active}/></div></header>');
 replace('<header className="topbar">','<header className="topbar system-mode-toolbar">');
 return source;
}
