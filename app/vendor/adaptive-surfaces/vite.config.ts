import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],build:{outDir:'dist/library',lib:{entry:'src/library.ts',formats:['es'],fileName:'adaptive-surfaces'},sourcemap:true,rollupOptions:{external:['react','react-dom','react/jsx-runtime']}}});
