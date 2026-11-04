import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import {
  HybridLogicalClock, LeaseManager, FencedResource, TrustKernel, TaskerCommandGate,
  buildTaskerCommand, toTaskerHttp, fromTaskerHttp,
} from '../runtime/index.mjs';

test('HTTP-Transport: Header-MAC ueber Rohbytes, Rundweg durch das Gate', () => {
  const secret = randomBytes(32);
  const lease = new LeaseManager().acquire('t', 'win-1', 60_000).lease;
  const cmd = buildTaskerCommand({ action: 'OMEGA_STATUS', lease, hlc: new HybridLogicalClock({ node: 'win-1' }).tick() }, secret);
  const { body, headers } = toTaskerHttp(cmd);
  // Genau das rechnet Tasker nach: HMAC-SHA256(secret, body) als base64url.
  assert.equal(createHmac('sha256', secret).update(body, 'utf8').digest('base64url'), headers['x-omega-mac']);
  assert.equal(body.includes('"mac"'), false);
  const gate = new TaskerCommandGate({
    secret, clock: new HybridLogicalClock({ node: 'android-1' }), fence: new FencedResource(), kernel: new TrustKernel(),
  });
  assert.equal(gate.admit(fromTaskerHttp(body, headers['x-omega-mac'])).ok, true);
  assert.throws(() => fromTaskerHttp(JSON.stringify(JSON.parse(body), null, 2), headers['x-omega-mac']), /kanonisch/);
});
