import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Window} from 'happy-dom';
import {AppearanceGlyph} from '../../src/appearance/WebNodeGlyph.tsx';

const appearance={core:'#112233',shell:'#445566',orbit:'#778899',shape:'cube' as const,size:'normal' as const,motion:'off' as const};
const css=(file:string)=>fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8');
function fixture(hologram:boolean,foreground:string,order=0,selected=true){
 const win=new Window();
 const vendor=css('vendor/mesh-extensions/src/styles.css'),host=css('src/appearance/appearance.css'),system=css('src/system.css');
 const style=win.document.createElement('style');style.textContent=[[vendor,system,host],[host,vendor,system],[system,host,vendor]][order].join('\n');win.document.head.append(style);
 win.document.documentElement.style.setProperty('--foreground',foreground);
 win.document.documentElement.style.setProperty('--secondary',foreground==='#FFFFFF'?'#111827':'#F0F3F7');
 win.document.documentElement.style.setProperty('--card','#FFFFFF');
 win.document.body.innerHTML='<div class="system-studio"><div class="mesh-explorer '+(hologram?'mesh-style-hologram':'')+'"><div class="mesh-map"><svg class="mesh-svg"><g role="button" tabindex="0">'+renderToStaticMarkup(<AppearanceGlyph appearance={appearance} selected={selected}/>)+'</g></svg></div></div></div>';
 const node=win.document.querySelector('g[role=button]')!;
 return{win,node,hit:node.querySelector('[data-appearance-hit-target]')!,map:win.document.querySelector('.mesh-map')!};
}
test('real host/vendor CSS keeps the enlarged hit target invisible until keyboard focus',async()=>{
 for(const order of [0,1,2])for(const hologram of [true,false])for(const selected of [false,true]){
  const h=fixture(hologram,'#FFFFFF',order,selected);try{
   assert.equal(h.win.getComputedStyle(h.hit).stroke,'none','a nonvisual hit area must not inherit the old hologram circle stroke');
   assert.equal(h.win.getComputedStyle(h.hit).filter,'none','hit area is not a glow layer');
   const focus=[...h.node.querySelectorAll('[data-appearance-focus-ring]')];assert.equal(focus.length,2);
   for(const ring of focus)assert.equal(h.win.getComputedStyle(ring).opacity,'0');
   (h.node as any).focus();assert.equal(h.node.matches(':focus-visible'),true);
   // happy-dom does not invalidate cached SVG computed styles on focus alone.
   // This unrelated attribute only flushes that cache; selectors still use real focus.
   h.node.setAttribute('data-style-probe','focused');
   assert.equal(h.win.getComputedStyle(h.hit).stroke,'none','the hit target remains nonvisual even during focus');
   assert.deepEqual(focus.map(r=>h.win.getComputedStyle(r).stroke),['#07111E','#FFFFFF']);
   for(const ring of focus){assert.equal(h.win.getComputedStyle(ring).opacity,'1');assert.equal(h.win.getComputedStyle(ring).pointerEvents,'none')}
   (h.node as any).blur();h.node.setAttribute('data-style-probe','blurred');assert.equal(h.win.getComputedStyle(h.hit).stroke,'none');
   for(const ring of focus)assert.equal(h.win.getComputedStyle(ring).opacity,'0');
  }finally{await h.win.happyDOM.abort()}
 }
});
test('selection remains theme-readable and independent of legacy hologram tint and custom layer colors',async()=>{
 for(const foreground of ['#FFFFFF','#182433'])for(const order of [0,1,2]){
  const h=fixture(true,foreground,order);try{
   const rings=[...h.node.querySelectorAll('[data-appearance-selection-ring]')];assert.equal(rings.length,2);
   assert.deepEqual(rings.map(r=>h.win.getComputedStyle(r).stroke),['#07111E','#FFFFFF']);
   for(const ring of rings){assert.equal(h.win.getComputedStyle(ring).filter,'none');assert.equal(h.win.getComputedStyle(ring).pointerEvents,'none')}
   if(order===2)assert.match(h.win.getComputedStyle(h.map).backgroundImage,/#091c27/,'true lazy vendor-last order keeps the legacy dark hologram gradient');
   assert.equal(h.node.querySelector('[data-appearance-layer=core] rect')!.getAttribute('fill'),appearance.core);
   assert.equal(h.node.querySelector('[data-appearance-layer=shell] rect')!.getAttribute('stroke'),appearance.shell);
   assert.equal(h.node.querySelector('[data-appearance-layer=orbit]')!.getAttribute('stroke'),appearance.orbit);
  }finally{await h.win.happyDOM.abort()}
 }
});
