import {fileURLToPath} from 'node:url';
const config = {
  plugins: {
    // Only the current copied UI supplies utility classes; archives/tests are not app content.
    '@tailwindcss/postcss': {base:fileURLToPath(new URL('./upstream/',import.meta.url))},
  },
};
export default config;
