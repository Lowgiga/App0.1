import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const SOURCE_SCOPE = 'quality-source-v1';
export const MANUAL_EVIDENCE = Object.freeze({ browserVisual: 'not-run', touchAccessibility: 'not-run', gpuPerformanceBattery: 'not-run', nativeUnitTests: 'not-run', nativeLint: 'not-run', nativePermissionFlows: 'not-run', deviceVerification: 'not-run' });
const HASH = /^[a-f0-9]{64}$/;
const CONTRACT = 'quality/contract.json';
const BASELINE = 'quality/baselines/accepted.json';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = (code, detail) => { throw Object.assign(new Error(detail), { qualityCode: code }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function safeRelative(name) {
  if (typeof name !== 'string' || !name || /[\\:\x00-\x1f]/.test(name) || name.split('/').some(part => !part || part === '.' || part === '..')) fail('unsafe-path', String(name));
  return name;
}
export function safePath(root, name, allowMissing = false) {
  safeRelative(name);
  let current = path.resolve(root);
  if (fs.lstatSync(current).isSymbolicLink()) fail('symlink', current);
  for (const part of name.split('/')) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) fail('symlink', name); }
    catch (error) { if (!allowMissing || error.code !== 'ENOENT') throw error; }
  }
  return current;
}
function excluded(name) {
  const directories = ['node_modules', '.git', 'dist', 'artifacts', 'android/.gradle', 'android/.test-signing', 'android/build', 'android/app/build', 'android/cue-native-ar/build', 'android/capacitor-cordova-android-plugins/build'];
  return directories.some(directory => name === directory || name.startsWith(directory + '/'))
    || ['android/local.properties', 'docs/build-manifest.json', 'docs/integration-source-manifest.json'].includes(name);
}
// Fixed reviewed scope. upstream/build and reports/*.test.* are source, not output.
export function snapshotSources(root) {
  root = path.resolve(root);
  if (fs.lstatSync(root).isSymbolicLink()) fail('symlink', root);
  const files = Object.create(null);
  function visit(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (excluded(name)) continue;
      safeRelative(name);
      if (entry.isSymbolicLink()) fail('symlink', name);
      if (entry.isDirectory()) visit(path.join(directory, entry.name), name + '/');
      else if (entry.isFile()) files[name] = sha(fs.readFileSync(safePath(root, name)));
      else fail('unsupported-file', name);
    }
  }
  visit(root);
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  return { sourceScope: SOURCE_SCOPE, sha256: sha(JSON.stringify(sorted)), files: sorted };
}
export function diffFiles(before, after) {
  return {
    added: Object.keys(after).filter(name => !Object.hasOwn(before, name)).sort(),
    removed: Object.keys(before).filter(name => !Object.hasOwn(after, name)).sort(),
    changed: Object.keys(before).filter(name => Object.hasOwn(after, name) && before[name] !== after[name]).sort(),
  };
}
export function isTestSource(name) { return /(^|\/)(tests?|androidTest|__tests__)\//.test(name) || /\.(test|spec)\.[^/]+$/.test(name) || /(?:Test|Tests)\.(?:java|kt)$/.test(name); }
function reviewProtected(name) {
  return /^(?:scripts|quality|android|src\/platform|src\/assistant|provenance|licenses|vendor)\//.test(name)
    || ['package.json', 'package-lock.json', 'index.html', 'capacitor.config.json', 'provenance.json', 'integration-manifest.json'].includes(name)
    || /(^|\/)(?:[^/]*lock[^/]*|[^/]*manifest[^/]*|[^/]*permissions?[^/]*|[^/]*policy[^/]*|[^/]*adapter[^/]*|[^/]*csp[^/]*)$/i.test(name);
}
function memberName(node) {
  if (node && ts.isComputedPropertyName(node) && ts.isStringLiteralLike(node.expression)) return node.expression.text;
  if (node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node))) return node.text;
  return null;
}
function callRoot(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node) || ts.isParenthesizedExpression(node)) return callRoot(node.expression);
  return null;
}
function callMembers(node) {
  if (ts.isPropertyAccessExpression(node)) return [...callMembers(node.expression), node.name.text];
  if (ts.isElementAccessExpression(node)) return [...callMembers(node.expression), memberName(node.argumentExpression)];
  if (ts.isCallExpression(node) || ts.isParenthesizedExpression(node)) return callMembers(node.expression);
  return [];
}
export function inspectTest(name, source) {
  const markers = [], cases = [];
  if (/\.[cm]?[jt]sx?$/.test(name)) {
    const tree = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    if (tree.parseDiagnostics.length) fail('test-syntax', name + ': ' + ts.flattenDiagnosticMessageText(tree.parseDiagnostics[0].messageText, ' '));
    const roots = new Set(['test', 'it', 'describe', 'suite', 't', 'fit', 'fdescribe', 'xit', 'xtest', 'xdescribe']);
    for (const statement of tree.statements) {
      if (ts.isImportDeclaration(statement) && /^(?:node:test|vitest|@jest\/globals)$/.test(statement.moduleSpecifier.text)) {
        const clause = statement.importClause;
        if (clause?.name) roots.add(clause.name.text);
        if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) roots.add(clause.namedBindings.name.text);
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const element of clause.namedBindings.elements) {
          if (['test', 'it', 'describe', 'suite', 'fit', 'fdescribe', 'xit', 'xtest', 'xdescribe'].includes((element.propertyName ?? element.name).text)) roots.add(element.name.text);
        }
      }
    }
    function visit(node) {
      if (ts.isCallExpression(node) && roots.has(callRoot(node.expression))) {
        const line = tree.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const members = callMembers(node.expression);
        const declaration = (!members.length && callRoot(node.expression) !== 't') || ['test', 'it', 'describe', 'suite'].includes(members.at(-1));
        const last = node.arguments.at(-1);
        const callbackOnly = last && (ts.isArrowFunction(last) || ts.isFunctionExpression(last));
        if (declaration && last && ((node.arguments.length === 1 && !callbackOnly) || ts.isObjectLiteralExpression(last) || last.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(last) && last.text === 'undefined'))) markers.push({ marker: 'implicit-todo', line });
        for (const marker of members.filter(value => ['skip', 'only', 'todo'].includes(value))) markers.push({ marker, line });
        if (['fit', 'fdescribe', 'xit', 'xtest', 'xdescribe'].includes(callRoot(node.expression))) markers.push({ marker: 'focused-or-disabled', line });
        if (node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) cases.push(node.arguments[0].text);
        for (const argument of node.arguments) if (ts.isObjectLiteralExpression(argument)) {
          for (const prop of argument.properties) if (['skip', 'only', 'todo'].includes(memberName(prop.name))) {
            if (!ts.isPropertyAssignment(prop) || prop.initializer.kind !== ts.SyntaxKind.FalseKeyword) markers.push({ marker: memberName(prop.name), line });
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  } else if (/\.(?:java|kt|py)$/.test(name)) {
    // Lexical markers for inventoried native/Python sources; not execution evidence.
    const stripped = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, match => match.replace(/[^\n]/g, ' '));
    for (const match of stripped.matchAll(/@(?:[\w]+\.)*(?:Ignore|Disabled|skip|skipIf|skipUnless|skipif|xfail)\b/g)) markers.push({ marker: match[0], line: stripped.slice(0, match.index).split('\n').length });
  }
  return { cases, markers };
}
export function checkQuality({ root, contractSha256 } = {}) {
  const result = { schema: 'lowquantflow.quality-report/v1', status: 'blocked', sourceScope: SOURCE_SCOPE, issues: [], testInventory: [], manualEvidence: { ...MANUAL_EVIDENCE }, releaseClaim: null };
  const issue = (code, detail) => result.issues.push({ code, detail });
  try {
    root = path.resolve(root ?? fileURLToPath(new URL('../', import.meta.url)));
    if (!HASH.test(contractSha256 ?? '')) fail('contract-pin', 'Supply the independently reviewed contract SHA256 through --contract-sha256; candidate-local hashes are not approval.');
    const contractBytes = fs.readFileSync(safePath(root, CONTRACT));
    if (sha(contractBytes) !== contractSha256) fail('contract-pin', 'Contract does not match the external accepted pin.');
    const contract = JSON.parse(contractBytes);
    result.contractSha256 = contractSha256;
    if (!object(contract) || contract.schema !== 'lowquantflow.quality-contract/v1' || Object.keys(contract).some(key => !['schema', 'baseline', 'protectedBehaviors', 'exceptions'].includes(key))) fail('contract-schema', 'Unknown contract schema or fields; commands and mutable policy scopes are not accepted.');
    if (!Array.isArray(contract.exceptions) || contract.exceptions.length) fail('exceptions-unsupported', 'Version one has no automatic exception or approvalRef mechanism.');
    if (!object(contract.baseline)) fail('contract-schema', 'Missing baseline');
    safeRelative(contract.baseline.path);
    if (contract.baseline.path !== BASELINE || !HASH.test(contract.baseline.sha256 ?? '')) fail('contract-schema', 'Baseline path or SHA256 is invalid.');
    let baselineBytes;
    try { baselineBytes = fs.readFileSync(safePath(root, BASELINE)); }
    catch (error) { if (error.qualityCode) throw error; fail('baseline-read', error.message); }
    if (sha(baselineBytes) !== contract.baseline.sha256) fail('baseline-hash', 'Baseline bytes do not match the contract.');
    const baseline = JSON.parse(baselineBytes);
    result.baselineSha256 = contract.baseline.sha256;
    if (!object(baseline) || baseline.schema !== 'lowquantflow.quality-baseline/v1' || baseline.sourceScope !== SOURCE_SCOPE || !object(baseline.files) || !Object.keys(baseline.files).length) fail('baseline-entry', 'Invalid/empty baseline or source scope.');
    for (const [name, hash] of Object.entries(baseline.files)) {
      safeRelative(name);
      if (!HASH.test(hash ?? '') || excluded(name) || [CONTRACT, BASELINE].includes(name)) fail('baseline-entry', 'Invalid baseline entry: ' + name);
    }
    for (const required of ['package.json', 'package-lock.json', 'index.html', 'capacitor.config.json', 'scripts/check-quality.mjs', 'scripts/verify-quality.mjs']) if (!Object.hasOwn(baseline.files, required)) fail('baseline-entry', 'Required protected file missing from baseline: ' + required);
    const snapshot = snapshotSources(root);
    result.sourceSha256 = snapshot.sha256;
    result.sourceFileCount = Object.keys(snapshot.files).length;
    const comparison = Object.fromEntries(Object.entries(snapshot.files).filter(([name]) => ![CONTRACT, BASELINE].includes(name)));
    result.sourceDiff = diffFiles(baseline.files, comparison);
    for (const name of result.sourceDiff.removed) issue(isTestSource(name) || reviewProtected(name) ? 'protected-removed' : 'source-removed', name + ': independent review and deliberate baseline adoption required');
    for (const name of result.sourceDiff.changed) if (isTestSource(name) || reviewProtected(name)) issue('protected-changed', name + ': independent review and deliberate baseline adoption required');
    for (const name of result.sourceDiff.added) if (!isTestSource(name) && reviewProtected(name)) issue('protected-added', name + ': independent review and deliberate baseline adoption required');
    const testCases = new Map();
    for (const name of Object.keys(comparison).filter(isTestSource)) {
      const inspected = inspectTest(name, fs.readFileSync(safePath(root, name), 'utf8'));
      testCases.set(name, inspected.cases);
      result.testInventory.push({ path: name, sha256: comparison[name], kind: name.includes('/src/androidTest/') ? 'android-device' : name.includes('/src/test/') ? 'android-unit' : 'host-or-source-fixture', literalCaseNames: inspected.cases, execution: 'not-run' });
      for (const marker of inspected.markers) issue('test-marker', name + ':' + marker.line + ' ' + marker.marker);
    }
    if (!Array.isArray(contract.protectedBehaviors) || !contract.protectedBehaviors.length) fail('contract-schema', 'Protected behavior bindings are required.');
    const ids = new Set();
    for (const behavior of contract.protectedBehaviors) {
      if (!object(behavior) || typeof behavior.id !== 'string' || !behavior.id || ids.has(behavior.id) || !Array.isArray(behavior.cases) || !behavior.cases.length) fail('contract-schema', 'Invalid or duplicate protected behavior');
      ids.add(behavior.id);
      for (const binding of behavior.cases) {
        safeRelative(binding.path);
        if (!Object.hasOwn(baseline.files, binding.path) || typeof binding.name !== 'string' || !testCases.get(binding.path)?.includes(binding.name)) issue('behavior-missing', behavior.id + ': ' + binding.path + ' :: ' + binding.name);
      }
    }
    result.protectedBehaviorIds = [...ids];
    result.status = result.issues.length ? 'blocked' : 'pass';
  } catch (error) { issue(error.qualityCode ?? 'check-error', error.message); }
  return result;
}
export function cliOptions(args) {
  const options = { root: fileURLToPath(new URL('../', import.meta.url)) };
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--root', '--contract-sha256'].includes(key) || !args[index + 1] || options[key] !== undefined) fail('cli-arguments', 'Usage: --root <project> --contract-sha256 <independently-reviewed-sha256>');
    options[key] = args[index + 1];
    if (key === '--root') options.root = path.resolve(args[index + 1]);
    else options.contractSha256 = args[index + 1];
  }
  return options;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = checkQuality(cliOptions(process.argv.slice(2))); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'pass' ? 0 : 1; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
