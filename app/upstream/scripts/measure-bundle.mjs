import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import ts from 'typescript';

const root = path.resolve('dist/client');
const dir = path.join(root, '_next/static/chunks');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
const byPrefix = prefix => {
  const matches = files.filter(f => f.startsWith(prefix));
  if (matches.length !== 1) throw new Error(`Expected one current ${prefix} chunk, found ${matches.length}; use a clean build.`);
  return path.join(dir, matches[0]);
};
const entry = path.join(root, JSON.parse(fs.readFileSync(path.join(root, 'vinext-client-entry-manifest.json'))).appBrowserEntry);
function closure(entries) {
  const seen = new Set();
  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    for (const s of source.statements) {
      if ((ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text.startsWith('.')) {
        visit(path.resolve(path.dirname(file), s.moduleSpecifier.text));
      }
    }
  }
  entries.forEach(visit);
  return seen;
}
const app = byPrefix('mesh-app-');
const initial = closure([entry, app]);
const bytes = file => ({ bytes: fs.statSync(file).size, gzip: zlib.gzipSync(fs.readFileSync(file)).byteLength });
const sum = set => [...set].reduce((total, f) => total + bytes(f).gzip, 0);
const initialGzip = sum(initial);
const commandAdditional = sum(new Set([...closure([byPrefix('command-center-')])].filter(f => !initial.has(f))));
const optional = prefix => sum(new Set([...closure([byPrefix(prefix)])].filter(f => !initial.has(f))));
const spatial = closure([byPrefix('mesh-space-')]);
const renderer = byPrefix('space-renderer-');
const coordination = byPrefix('coordination-panel-');
const engine = closure([byPrefix('three.module-'), byPrefix('OrbitControls-')]);
const lazyBoundaries = { coordinationOutsideInitial: !initial.has(coordination), rendererOutsideInitial: !initial.has(renderer), rendererOutside2DStatic: !spatial.has(renderer), engineOutsideInitial: [...engine].every(f => !initial.has(f)), engineOutside2DStatic: [...engine].every(f => !spatial.has(f)) };
const baseline = JSON.parse(fs.readFileSync('docs/PERFORMANCE_BASELINE_V1_2.json', 'utf8'));
const cssFiles = fs.readdirSync(path.join(root, '_next/static/css')).filter(f => f.endsWith('.css'));
const css = cssFiles.reduce((sum, f) => { const asset = bytes(path.join(root, '_next/static/css', f)); return { bytes: sum.bytes + asset.bytes, gzip: sum.gzip + asset.gzip }; }, { bytes: 0, gzip: 0 });
const cssGrowth = (css.bytes / baseline.css.bytes - 1) * 100;
const report = {
  measuredAt: new Date().toISOString(), method: 'gzip build assets; static imports of browser entry plus root client component; excludes dynamic imports; no network/hardware benchmark',
  appChunk: bytes(app), initialStaticJsGzip: initialGzip, initialFiles: [...initial].map(f => path.basename(f)), commandAdditionalGzip: commandAdditional,
  baselineVersion: baseline.version, appChunkAdditionalGzip: bytes(app).gzip - baseline.appChunk.gzip, initialJsChangeGzip: initialGzip - baseline.initialStaticJsGzip,
  css, cssGrowthPercent: cssGrowth,
  optionalAdditionalGzip: { coordination: optional('coordination-panel-'), intelligence: optional('neuro-panel-'), palette: optional('command-palette-'), spatial: optional('mesh-space-'), spatialRenderer: optional('space-renderer-'), threeAndOrbit: sum(new Set([...engine].filter(f => !initial.has(f) && !spatial.has(f)))) },
  lazyBoundaries,
  assets: files.map(f => ({ file: f, ...bytes(path.join(dir, f)), initial: initial.has(path.join(dir, f)) })),
  budgets: { appChunkGzip: 100 * 1024, appChunkAdditionalGzip: 100 * 1024, initialStaticJsGzip: 220 * 1024, commandAdditionalGzip: 45 * 1024, cssGrowthPercent: 10 },
};
if (!process.argv.includes('--check-only')) {
  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/BUNDLE_REPORT.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ appChunk: report.appChunk, appChunkAdditionalGzip: report.appChunkAdditionalGzip, initialStaticJsGzip: initialGzip, commandAdditionalGzip: commandAdditional, css, cssGrowthPercent: cssGrowth, optionalAdditionalGzip: report.optionalAdditionalGzip, lazyBoundaries, initialFiles: report.initialFiles, budgets: report.budgets }, null, 2));
if (report.appChunk.gzip > report.budgets.appChunkGzip || report.appChunkAdditionalGzip > report.budgets.appChunkAdditionalGzip || initialGzip > report.budgets.initialStaticJsGzip || commandAdditional > report.budgets.commandAdditionalGzip || cssGrowth > report.budgets.cssGrowthPercent || !Object.values(lazyBoundaries).every(Boolean)) process.exitCode = 1;
