import path from 'node:path';
if (process.argv.length !== 3) {
  console.error('Usage: node examples/verify-v4.mjs /absolute/path/to/v4-checkout');
  process.exitCode = 2;
} else {
  process.env.MESH_V4_ROOT = path.resolve(process.argv[2]);
  await import('../test/v4.integration.mjs');
}
