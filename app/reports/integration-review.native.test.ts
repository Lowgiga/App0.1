import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('review: native system Back has an explicit path to the WebView history',()=>{
 const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));const root=new URL('../android/app/src/main/java/de/lowgiga/cuecommandmesh/preview/',import.meta.url);const java=fs.readdirSync(root).filter(name=>name.endsWith('.java')).map(name=>fs.readFileSync(new URL(name,root),'utf8')).join('\n');
 const appPlugin=Boolean(pkg.dependencies?.['@capacitor/app']);if(appPlugin){const gradle=fs.readFileSync(new URL('../android/capacitor.settings.gradle',import.meta.url),'utf8');assert.match(gradle,/capacitor-app/)}else{assert.match(java,/OnBackPressedCallback|OnBackInvokedCallback/,'Without AppPlugin, native Activity must explicitly bind system Back');assert.match(java,/canGoBack\s*\(/);assert.match(java,/goBack\s*\(/)}
});
