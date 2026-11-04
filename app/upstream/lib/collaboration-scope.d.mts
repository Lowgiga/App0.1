export type ScopeRegistry = { roles: Record<string, { ownedPaths: string[] }>; protectedPaths: string[] };
export function checkOwnedPaths(registry: ScopeRegistry, agent: string, paths: string[]): { ok: boolean; violations: { path: string; reason: string }[] };
