// Source integration guards only: actual OpenGL appearance and device performance still require hardware tests.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../android/cue-native-ar/src/main/java/de/lowgiga/cuear/GraphRenderer.java',import.meta.url),'utf8');
test('native renderer binds all appearance channels, shape meshes and bounded size factors',()=>{
 for(const channel of ['core','shell','orbit'])assert.match(source,new RegExp('appearance\\.'+channel));
 assert.match(source,/shellLines\("cube"\)/);assert.match(source,/coreTriangles\("cube"\)/);assert.match(source,/appearance\.shape/);assert.match(source,/HologramGeometry\.sizeScale\(appearance\.size\)/);assert.match(source,/HologramMotion\.forNode\(appearance,breath\)/);
});
test('native appearance retains depth stages, detailed-node budget and position-only picking',()=>{
 const draw=source.slice(source.indexOf('private void drawGraph()'),source.indexOf('private void nodeColor('));
 assert.ok(draw.indexOf('GLES20.GL_TRIANGLES')<draw.indexOf('glDepthMask(false)'));assert.ok(draw.indexOf('glDepthMask(false)')<draw.indexOf('GLES20.GL_LINES'));
 assert.match(draw,/HologramGeometry\.detailed\(i,graph.nodes.size\(\),chosen\)/);assert.match(source,/SceneMath\.pick\(projected,touch\[0\],touch\[1\],28f\*density\)/);
 const centers=source.slice(source.indexOf('local=new float'),source.indexOf('edges=buffer(links)'));assert.doesNotMatch(centers,/appearance|breath/);
});
