/** Browser/Android entry: no Node dependencies and no backend required. */
export { createKernel } from './kernel.mjs';
export { createHostAuthority } from './host.mjs';
export { validateSchema,validateData,validateManifest,parseSkill,hashManifestWeb } from './contract.mjs';
