// Ed25519 fuer Knoten-zu-Knoten (omega.event/v1, omega.peer/v1) und HMAC-SHA256 fuer die
// Tasker-Bruecke (Tasker kann HMAC mit Standard-Java pruefen, Ed25519 nicht ohne Zusatz).
import {
  createHash, createHmac, createPublicKey, generateKeyPairSync, sign, timingSafeEqual, verify,
} from 'node:crypto';
import { canonicalize } from './canonical.mjs';

const B64URL_32 = /^[A-Za-z0-9_-]{43}$/;

export function generateNodeKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKey: exportPublicKey(publicKey), privateKey };
}

export function exportPublicKey(keyObject) {
  return keyObject.export({ format: 'jwk' }).x;
}

export function importPublicKey(x) {
  if (typeof x !== 'string' || !B64URL_32.test(x)) throw new TypeError('Ed25519: oeffentlicher Schluessel ungueltig');
  return createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' });
}

/** Kurze, stabile Kennung eines oeffentlichen Schluessels (fuer Logs und Peer-Listen). */
export function keyId(x) {
  return `k1_${createHash('sha256').update(x, 'utf8').digest('base64url').slice(0, 16)}`;
}

function bodyBytes(obj, field) {
  const body = { ...obj };
  delete body[field];
  return Buffer.from(canonicalize(body), 'utf8');
}

export function signObject(obj, privateKey) {
  return sign(null, bodyBytes(obj, 'sig'), privateKey).toString('base64url');
}

export function verifyObject(obj, publicKeyX) {
  if (typeof obj?.sig !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(obj.sig)) return false;
  const signature = Buffer.from(obj.sig, 'base64url');
  if (signature.length !== 64) return false;
  return verify(null, bodyBytes(obj, 'sig'), importPublicKey(publicKeyX), signature);
}

export function assertSecret(secret) {
  if (!Buffer.isBuffer(secret) || secret.length < 32) {
    throw new TypeError('HMAC: Geheimnis muss ein Buffer mit mindestens 32 Byte sein');
  }
}

export function macObject(obj, secret) {
  assertSecret(secret);
  return createHmac('sha256', secret).update(bodyBytes(obj, 'mac')).digest('base64url');
}

export function verifyMac(obj, secret) {
  if (typeof obj?.mac !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(obj.mac)) return false;
  const expected = Buffer.from(macObject(obj, secret), 'base64url');
  const given = Buffer.from(obj.mac, 'base64url');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
