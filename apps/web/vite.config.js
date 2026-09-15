import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5178,
    strictPort: true,
    /* The availability and AI endpoints live on the express server. Proxying
       them means the app calls /api/... in dev exactly as it will in
       production, so the "is this feed real?" path is exercised for real
       instead of always falling through to the labelled stand-in. */
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  build: {
    // The prototype shipped one 2MB file. Splitting the vendor chunk means a
    // return visit re-downloads only what actually changed.
    rollupOptions: {
      output: {
        // A function, not an object: Vite 8 dropped the object form. Splitting
        // the vendors means a return visit re-downloads only what changed.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (/node_modules\/(motion|motion-dom|motion-utils|framer-motion)\//.test(id)) return 'motion';
          return undefined;
        },
      },
    },
  },
});
