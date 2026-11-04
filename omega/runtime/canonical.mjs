// Kanonisches JSON (RFC-8785-kompatibel fuer die hier erlaubten Typen):
// Schluessel nach UTF-16-Codeeinheiten sortiert, keine Leerzeichen, Zahlen nach ECMAScript.
// Grundlage jeder Signatur und jedes MAC - beide Seiten muessen byte-identisch serialisieren.
export function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonicalize: Zahl ist nicht endlich');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError('canonicalize: nur einfache Objekte erlaubt');
    }
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  }
  throw new TypeError(`canonicalize: Typ ${typeof value} nicht unterstuetzt`);
}
