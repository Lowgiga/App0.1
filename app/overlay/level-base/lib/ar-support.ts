export type ARSupportCode = 'supported' | 'insecure' | 'policy-blocked' | 'api-missing' | 'unsupported' | 'probe-failed';
export type ARSupport = { code: ARSupportCode; supported: boolean; message: string };
type Environment = { secureContext: boolean; policyAllowsXR?: boolean; nativeApp?: boolean; xr?: Pick<XRSystem, 'isSessionSupported'> };

/** Read-only capability probe. A positive probe does not prove hit-test, permissions or a working camera session. */
export async function inspectARSupport(env: Environment): Promise<ARSupport> {
  const no = (code: ARSupportCode, message: string): ARSupport => ({ code, supported: false, message });
  if (!env.secureContext) return no('insecure', 'Kamera-AR braucht HTTPS oder localhost. Diese Seite läuft nicht in einem sicheren Kontext.');
  if (env.policyAllowsXR === false) return no('policy-blocked', 'Die Einbettungsrichtlinie sperrt räumliches Tracking. Öffne die originale HTTPS-Seite direkt in einem kompatiblen Browser.');
  if (!env.xr) return no('api-missing', env.nativeApp ? 'Diese App-WebView stellt WebXR nicht bereit. Öffne die HTTPS-Website separat in Chrome auf einem ARCore-fähigen Android-Gerät.' : 'Dieser Browser stellt WebXR nicht bereit. Prüfe die originale HTTPS-Seite in Chrome auf einem ARCore-fähigen Android-Gerät.');
  try {
    return await env.xr.isSessionSupported('immersive-ar') ? { code: 'supported', supported: true, message: 'Immersive AR wird gemeldet. Hit-Test, Kamerafreigabe und Bedienelemente werden erst beim bewussten Start geprüft.' } : no('unsupported', 'Der Browser meldet keine immersive AR-Unterstützung. Auf Android: ARCore-fähiges Gerät und aktivierte Google Play-Dienste für AR prüfen.');
  } catch (error) {
    return no('probe-failed', 'AR-Unterstützung konnte nicht geprüft werden. ' + arStartError(error));
  }
}

export function arStartError(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  if (name === 'NotAllowedError') return 'Die AR-Freigabe wurde abgelehnt oder ist im Browser gesperrt. Prüfe die Website-Berechtigungen und starte AR erneut per Klick.';
  if (name === 'SecurityError') return 'Die Sicherheitsrichtlinie verhindert AR. HTTPS, direkte Seitenöffnung und die Freigabe für xr-spatial-tracking prüfen.';
  if (name === 'NotSupportedError') return 'Kamera-AR mit Hit-Test und bedienbarem Overlay wird hier nicht unterstützt. Eine normale 3D-Ansicht erkennt keine realen Flächen.';
  if (name === 'InvalidStateError') return 'Die AR-Sitzung ist nicht startbereit oder eine andere XR-Sitzung ist aktiv. Beende sie und starte erneut.';
  if (name === 'AbortError') return 'Der AR-Start wurde abgebrochen. Es wurde keine Fläche platziert.';
  return 'Kamera-AR konnte nicht starten. Prüfe Geräteunterstützung, Website-Berechtigungen und Google Play-Dienste für AR. 2D und Bildschirm-3D bleiben verfügbar.';
}

export function surfaceSessionInit(root: HTMLElement): XRSessionInit {
  return { requiredFeatures: ['hit-test', 'dom-overlay'], domOverlay: { root } };
}
