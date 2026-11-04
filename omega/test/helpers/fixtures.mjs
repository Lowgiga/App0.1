import { generateNodeKeys, nodeIdFromKey, HybridLogicalClock } from '../../runtime/index.mjs';

export const fakeClock = (start = 1_700_000_000_000) => {
  let t = start;
  const now = () => t;
  now.advance = (ms) => {
    t += ms;
  };
  now.set = (value) => {
    t = value;
  };
  return now;
};

/** Knoten mit selbstzertifizierender ID, Schluesselpaar und eigener HLC. */
export function makeNode(now = () => Date.now(), options = {}) {
  const keys = generateNodeKeys();
  const node = nodeIdFromKey(keys.publicKey);
  return { ...keys, node, clock: new HybridLogicalClock({ node, now, ...options }) };
}
