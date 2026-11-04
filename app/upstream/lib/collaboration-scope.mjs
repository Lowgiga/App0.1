/** Advisory project ownership checks. This is not an OS or authorization boundary. */
export function checkOwnedPaths(registry, agent, paths) {
  const role = Object.hasOwn(registry.roles, agent) ? registry.roles[agent] : null;
  if (!role) return { ok: false, violations: [{ path: '', reason: 'Unbekannter Agent.' }] };
  const matches = (file, rule) => rule.endsWith('/') ? file.startsWith(rule) : file === rule;
  const violations = [];
  for (const file of new Set(paths)) {
    if (typeof file !== 'string' || !file || file !== file.trim() || file.startsWith('/') || file.includes('\\') || /[\x00-\x1f\x7f]/.test(file) || file.split('/').some(segment => { const s = segment.toLowerCase(); return !s || s === '.' || s === '..' || s === '.git' || s === 'node_modules' || s === 'dist' || s === '.wrangler' || s === '.sites-runtime' || s === '.env' || s.startsWith('.env.'); })) {
      violations.push({ path: typeof file === 'string' ? file : '', reason: 'Ungültiger oder ausgeschlossener Projektpfad.' });
    } else if (registry.protectedPaths.some(rule => matches(file, rule))) {
      violations.push({ path: file, reason: 'Gemeinsame geschützte Datei: neue Übergabe erforderlich.' });
    } else if (!role.ownedPaths.some(rule => matches(file, rule))) {
      violations.push({ path: file, reason: 'Außerhalb der zugeordneten Dateigrenzen.' });
    }
  }
  return { ok: violations.length === 0, violations };
}
