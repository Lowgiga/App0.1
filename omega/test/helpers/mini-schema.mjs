// Kleiner Pruefer fuer die in contracts/ benutzte Teilmenge von JSON Schema 2020-12
// (type, const, enum, pattern, Laengen, Grenzen, required, properties, additionalProperties,
// items, uniqueItems). Dient nur dazu, Laufzeit-Objekte gegen die Vertraege zu pruefen.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../../contracts/', import.meta.url));
export const loadSchema = (name) => JSON.parse(readFileSync(`${dir}${name}`, 'utf8'));

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);

export function validate(schema, value, path = '$') {
  const errors = [];
  const fail = (msg) => errors.push(`${path}: ${msg}`);
  if ('const' in schema && value !== schema.const) fail(`const ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail(`enum ${JSON.stringify(value)}`);
  if (schema.type) {
    const t = typeOf(value);
    const ok = schema.type === t || (schema.type === 'number' && (t === 'integer' || t === 'number'));
    if (!ok) {
      fail(`type ${t} != ${schema.type}`);
      return errors;
    }
  }
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) fail(`pattern ${schema.pattern}`);
    if (schema.minLength !== undefined && [...value].length < schema.minLength) fail('minLength');
    if (schema.maxLength !== undefined && [...value].length > schema.maxLength) fail('maxLength');
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) fail('minimum');
    if (schema.maximum !== undefined && value > schema.maximum) fail('maximum');
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail('minItems');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail('maxItems');
    if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) fail('uniqueItems');
    if (schema.items) value.forEach((item, i) => errors.push(...validate(schema.items, item, `${path}[${i}]`)));
  }
  if (typeOf(value) === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) fail(`required ${key}`);
    for (const [key, sub] of Object.entries(value)) {
      if (schema.properties?.[key]) errors.push(...validate(schema.properties[key], sub, `${path}.${key}`));
      else if (schema.additionalProperties === false) fail(`additional ${key}`);
    }
  }
  return errors;
}
