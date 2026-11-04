// Local compiled app + isolated D1. This does not verify production login or a Low connection.
// Optional browser QA dependencies live outside the app; all third-party requests are blocked.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Miniflare } from 'miniflare';
const require = createRequire(import.meta.url);
const { chromium } = await import(process.env.MESH_PLAYWRIGHT_MODULE || 'playwright');
const axePath = process.env.MESH_AXE_SOURCE || require.resolve('axe-core/axe.min.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.MESH_BROWSER_AUDIT_OUTPUT || '/tmp/cue-coordination-browser';
fs.mkdirSync(output, { recursive: true });
const origin = 'http://127.0.0.1:8791';
const identity = { 'oai-authenticated-user-id': 'coordination-e2e-' + crypto.randomUUID(), 'oai-authenticated-user-email': 'qa@example.invalid', 'X-Mesh-State-Version': '4' };
const serverRoot = path.join(root, 'dist/server');
const modules = ['index.js', ...fs.readdirSync(serverRoot, { recursive: true }).filter(f => f !== 'index.js' && /\.m?js$/.test(f))].map(f => ({ type: 'ESModule', path: path.join(serverRoot, f) }));
const mf = new Miniflare({ modules, modulesRoot: serverRoot, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 8791, cf: false, assets: { directory: path.join(root, 'dist/client'), binding: 'ASSETS', routerConfig: { has_user_worker: true } }, d1Databases: { DB: 'coordination-browser-only' }, d1Persist: path.join(output, 'isolated-d1') });
const checks = [], consoleLog = [], screenshots = [], metrics = {};
let browser;
function check(name, ok, detail) { assert.ok(ok, name); checks.push({ name, status: 'PASS', ...(detail ? { detail } : {}) }); console.log('PASS', name); }
async function get() { const r = await fetch(origin + '/api/state', { headers: identity }); assert.equal(r.status, 200); return r.json(); }
async function put(state) { const { updatedAt, ...body } = state; const r = await fetch(origin + '/api/state', { method: 'PUT', headers: { ...identity, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, expectedUpdatedAt: updatedAt }) }); const result = await r.json(); assert.equal(r.status, 200, JSON.stringify(result)); return result; }
async function brief() { const r = await fetch(origin + '/mcp', { method: 'POST', headers: { ...identity, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'mesh_get_collaboration_brief', arguments: {} } }) }); assert.equal(r.status, 200); const result = await r.json(); assert.equal(result.result.isError, false); return JSON.parse(result.result.content[0].text); }
function report(b) { return { schemaVersion: 1, revision: b.revision, missionId: b.missionId, briefHash: b.briefHash, from: 'low', acknowledged: true, referenceCommit: b.referenceCommit, baseCommit: b.referenceCommit, status: 'blocked', summary: 'Manueller QA-Bericht: kein erreichbarer Low-Kanal. <img src=x onerror="globalThis.lowCommandExecuted=true">', changedFiles: ['docs/low/access.md'], tests: [{ command: 'globalThis.lowCommandExecuted=true', exitCode: null, evidence: 'Nur gemeldeter Text, kein ausgeführter Befehl.' }], blockers: ['Der direkte Gerätekanal ist nicht erreichbar.'] }; }
async function context(options = {}) { const c = await browser.newContext({ viewport: { width: 1440, height: 1050 }, extraHTTPHeaders: identity, ...options }); await c.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort()); return c; }
function watch(page) { page.setDefaultTimeout(10000); page.on('pageerror', e => consoleLog.push({ type: 'pageerror', message: e.message })); page.on('console', m => { if (['warning', 'error'].includes(m.type())) consoleLog.push({ type: m.type(), message: m.text() }); }); }
async function shot(page, name, panel = false) { const file = path.join(output, name + '.png'); if (panel) await page.locator('.coordination-panel').screenshot({ path: file }); else await page.screenshot({ path: file }); screenshots.push(name + '.png'); }
async function audit(page, name) { await page.addScriptTag({ path: axePath }); const result = await page.evaluate(async () => axe.run('.coordination-panel', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })); const violations = result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })); metrics[name] = violations; fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(violations, null, 2)); check(name + ' has no automated WCAG A/AA violations', violations.length === 0, JSON.stringify(violations)); }
try {
  await mf.ready; const db = await mf.getD1Database('DB'); await db.exec(fs.readFileSync(path.join(root, 'drizzle/0000_ambitious_squirrel_girl.sql'), 'utf8').replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS').replace(/\s+/g, ' '));
  let state = await get(); const missionId = crypto.randomUUID();
  state.command.missions.push({ id: missionId, title: 'Getrennte Integrationsprüfung · QA', goal: 'Konkreten datierten Befund prüfen.', scope: 'Eigene isolierte App', project: 'cue', owner: 'codex', reviewer: 'junior', stage: 'Created', priority: 'P1', output: 'Befund und Blocker', taskIds: [], roomId: null, sourceIds: [], evidence: '', reviewed: false, checkpoint: '', archived: false, createdAt: new Date().toISOString() });
  state.notes.push({ id: crypto.randomUUID(), text: 'PRIVATE NOTE excluded from handoff', createdAt: new Date().toISOString() }); state = await put(state);
  browser = await chromium.launch({ ...(process.env.MESH_CHROMIUM_EXECUTABLE ? { executablePath: process.env.MESH_CHROMIUM_EXECUTABLE } : {}), headless: true, args: ['--no-sandbox', '--no-zygote', '--single-process'] }); metrics.browser = browser.version();
  const c = await context({ permissions: ['clipboard-read', 'clipboard-write'] }), page = await c.newPage(); watch(page); const requests = []; page.on('request', r => requests.push(r.url()));
  await page.goto(origin, { waitUntil: 'networkidle' }); await page.getByRole('button', { name: 'Agenten', exact: true }).waitFor();
  check('Initial dashboard does not fetch the optional coordination panel', !requests.some(url => /coordination-panel/.test(url)));
  await page.getByRole('button', { name: 'Agenten', exact: true }).click(); const panel = page.locator('.coordination-panel'); await panel.getByRole('heading', { name: 'Codex & Low: gemeinsam weiterarbeiten', exact: true }).waitFor();
  check('Agent view loads the real lazy cooperation panel', requests.some(url => /coordination-panel/.test(url)) && await panel.isVisible());
  check('Low presence and acceptance are explicitly unverified', (await panel.innerText()).includes('Lows Identität, Verbindung und Annahme sind noch nicht bestätigt'));
  await panel.getByRole('button', { name: 'Low-Arbeitsbrief kopieren', exact: true }).click(); const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  check('Clipboard contains a bounded unsent brief without private notes', clipboard.includes('prepared-not-delivered') && !clipboard.includes('PRIVATE NOTE'));
  const downloadEvent = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Brief als JSON', exact: true }).click(); const download = await downloadEvent; await download.saveAs(path.join(output, 'mesh-low-arbeitsbrief.json')); const exported = JSON.parse(fs.readFileSync(path.join(output, 'mesh-low-arbeitsbrief.json'), 'utf8')), b = await brief();
  check('UI export matches the own MCP content fingerprint', exported.briefHash === b.briefHash && exported.context.missions[0].id === missionId);
  check('Copy and export neither dispatch Low nor create state events', (await get()).updatedAt === state.updatedAt);
  await panel.locator('summary').filter({ hasText: 'Rückmeldung von Low zuordnen' }).click(); const input = panel.getByRole('textbox', { name: 'Erhaltene Rückmeldung als JSON' });
  await input.fill('{'); await panel.getByRole('button', { name: 'Rückmeldung prüfen', exact: true }).click();
  check('Invalid report JSON produces a readable error', await panel.getByRole('alert').innerText().then(t => t.includes('kein gültiges JSON')));
  const r = report(b); await input.fill(JSON.stringify({ ...r, changedFiles: ['app/mesh-app.tsx'] })); await panel.getByRole('button', { name: 'Rückmeldung prüfen', exact: true }).click();
  check('Reports outside Lows ownership are blocked', (await panel.getByRole('alert').innerText()).includes('Dateigrenzen') && await panel.getByRole('button', { name: 'Als ungeprüfte Notiz speichern', exact: true }).count() === 0);
  await input.fill(JSON.stringify({ ...r, briefHash: '0'.repeat(64) })); await panel.getByRole('button', { name: 'Rückmeldung prüfen', exact: true }).click();
  check('Divergent briefs remain visible and cannot be accepted', (await panel.innerText()).includes('Abweichender Arbeitsbrief') && await panel.getByRole('button', { name: 'Als ungeprüfte Notiz speichern', exact: true }).isDisabled());
  await input.fill(JSON.stringify(r)); await panel.getByRole('button', { name: 'Rückmeldung prüfen', exact: true }).click();
  check('A matching manual report stays an unverified claim', (await panel.innerText()).includes('Format und aktueller Brief passen · Inhalt ungeprüft'));
  check('HTML and reported commands remain inert text', await panel.locator('img').count() === 0 && await page.evaluate(() => !globalThis.lowCommandExecuted));
  let concurrent = await get(); concurrent.notes.push({ id: crypto.randomUUID(), text: 'Concurrent independent QA note', createdAt: new Date().toISOString() }); await put(concurrent);
  await panel.getByRole('button', { name: 'Als ungeprüfte Notiz speichern', exact: true }).click(); await panel.getByText('Abweichender Arbeitsbrief · nur historische Aufbewahrung', { exact: true }).waitFor();
  check('CAS conflict preserves the raw report and invalidates its old brief', await input.inputValue() === JSON.stringify(r) && await panel.getByRole('button', { name: 'Als ungeprüfte Notiz speichern', exact: true }).isDisabled());
  state = await get(); check('Conflict cannot overwrite another work note', state.notes.some(n => n.text === 'Concurrent independent QA note') && !state.notes.some(n => n.text.startsWith('LOW ·')));
  await panel.getByRole('button', { name: 'Historisch als ungeprüfte Notiz sichern', exact: true }).click(); await panel.locator('summary').filter({ hasText: 'Gespeicherte Rückmeldungen · weiterhin ungeprüft' }).waitFor();
  const historical = await get(); check('Parallel work permits explicit historical claim storage without changing mission status', historical.notes[0].text.includes('HISTORISCH: abweichender Arbeitsbrief') && historical.notes[0].text.includes(r.briefHash) && historical.command.missions[0].stage === 'Created');
  state = historical;
  const refreshed = report(await brief()); await input.fill(JSON.stringify(refreshed)); await panel.getByRole('button', { name: 'Rückmeldung prüfen', exact: true }).click(); await panel.getByRole('button', { name: 'Als ungeprüfte Notiz speichern', exact: true }).click(); await panel.locator('summary').filter({ hasText: 'Gespeicherte Rückmeldungen · weiterhin ungeprüft' }).waitFor();
  const saved = await get(); check('Successful acceptance stores only a labelled personal claim note', saved.notes[0].text.includes('NICHT unabhängig verifiziert') && saved.command.missions.length === 1 && saved.command.missions[0].stage === 'Created' && saved.profiles.length === 4 && saved.command.approvals.length === 0);
  check('Claim acceptance emits exactly one canonical note event', saved.command.events.length === state.command.events.length + 1 && saved.command.events.at(-1).title === 'Arbeitsnotizen aktualisiert');
  check('Successful save clears the import draft', await input.inputValue() === '');
  await panel.locator('summary').filter({ hasText: 'Gespeicherte Rückmeldungen · weiterhin ungeprüft' }).click(); await audit(page, 'a11y-desktop-light');
  await panel.locator('summary').filter({ hasText: 'Gespeicherte Rückmeldungen · weiterhin ungeprüft' }).click(); await panel.locator('summary').filter({ hasText: 'Rückmeldung von Low zuordnen' }).click(); await page.getByRole('button', { name: 'Low-Arbeitsbrief kopieren', exact: true }).focus(); await shot(page, 'coordination-desktop', true);
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('.coordination-panel h2').waitFor(); await page.locator('.coordination-panel summary').filter({ hasText: 'Gespeicherte Rückmeldungen · weiterhin ungeprüft' }).click();
  check('Reload retains the unverified report and leaves Low unconnected', (await page.locator('.coordination-panel').innerText()).includes('Manueller QA-Bericht') && (await page.locator('.coordination-panel').innerText()).includes('Annahme sind noch nicht bestätigt'));
  state = await get(); state.settings.theme = 'dark'; await put(state);
  const mc = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }), mobile = await mc.newPage(); watch(mobile); await mobile.goto(origin + '/?view=agents', { waitUntil: 'networkidle' }); const mp = mobile.locator('.coordination-panel'); await mp.locator('h2').waitFor(); await mp.scrollIntoViewIfNeeded();
  check('Mobile 390px has no horizontal document overhang', await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mp.locator('summary').filter({ hasText: 'Rückmeldung von Low zuordnen' }).tap(); await mp.getByRole('textbox', { name: 'Erhaltene Rückmeldung als JSON' }).fill('{'); await mp.getByRole('button', { name: 'Rückmeldung prüfen', exact: true }).tap();
  check('Touch report validation is functional', (await mp.getByRole('alert').innerText()).includes('kein gültiges JSON'));
  const small = await mp.evaluate(root => [...root.querySelectorAll('button,textarea,summary')].filter(e => e.getClientRects().length).map(e => ({ label: e.getAttribute('aria-label') || e.textContent.trim().slice(0,70), width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })).filter(t => t.width < 43.9 || t.height < 43.9)); metrics.mobileSmallTargets = small;
  check('Mobile cooperation controls have at least 44px touch targets', small.length === 0, JSON.stringify(small));
  const copyButton = mp.getByRole('button', { name: 'Low-Arbeitsbrief kopieren', exact: true }); await copyButton.focus(); await copyButton.press('Tab'); await mobile.keyboard.press('Shift+Tab');
  check('Keyboard focus is visible on cooperation controls', await copyButton.evaluate(e => { const s = getComputedStyle(e); return (parseFloat(s.outlineWidth) >= 2 && s.outlineStyle !== 'none') || (s.boxShadow !== 'none'); }));
  check('Reduced Motion is respected by the cooperation panel', await mp.evaluate(e => matchMedia('(prefers-reduced-motion: reduce)').matches && ![e, ...e.querySelectorAll('*')].some(n => { const s = getComputedStyle(n); return s.animationName !== 'none' && parseFloat(s.animationDuration) > .01; })));
  await audit(mobile, 'a11y-mobile-dark'); await mp.locator('summary').filter({ hasText: 'Rückmeldung von Low zuordnen' }).tap(); await mp.scrollIntoViewIfNeeded(); await shot(mobile, 'coordination-mobile');
  const failedContext = await context(), failed = await failedContext.newPage(); await failed.route('**/api/state', r => r.abort()); await failed.goto(origin + '/?view=agents', { waitUntil: 'networkidle' }); await failed.locator('.coordination-panel h2').waitFor();
  check('Unknown personal state cannot be copied or exported as current context', await failed.locator('.coordination-panel').getByRole('button', { name: 'Low-Arbeitsbrief kopieren', exact: true }).isDisabled() && await failed.locator('.coordination-panel').getByRole('button', { name: 'Brief als JSON', exact: true }).isDisabled());
  metrics.consoleExpected = consoleLog.filter(l => /409|Conflict/.test(l.message)); metrics.consoleUnexpected = consoleLog.filter(l => !/409|Conflict/.test(l.message)); check('No unexpected browser errors in accepted and recovery flows', metrics.consoleUnexpected.length === 0, JSON.stringify(metrics.consoleUnexpected));
  metrics.scope = 'Own compiled app and isolated D1; no real Low identity, client authentication or remote action is verified'; metrics.viewports = ['1440x1050','390x844'];
} catch (error) { metrics.failure = error.stack; console.error(error); process.exitCode = 1; }
finally { fs.writeFileSync(path.join(output, 'COLLABORATION_BROWSER_AUDIT.json'), JSON.stringify({ measuredAt: new Date().toISOString(), status: metrics.failure ? 'PARTIAL' : 'PASS', passed: checks.length, checks, metrics, screenshots }, null, 2)); await browser?.close(); await mf.dispose(); }
