import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'path';
import fs from 'fs';

// Custom plugin to copy preload without transformation
function copyPreload(): Plugin {
  return {
    name: 'copy-preload',
    buildStart() {
      // Ensure dist-electron exists
      if (!fs.existsSync('dist-electron')) {
        fs.mkdirSync('dist-electron', { recursive: true });
      }
      // Copy preload.cjs without transformation
      fs.copyFileSync('electron/preload.cjs', 'dist-electron/preload.cjs');
    },
    handleHotUpdate({ file }) {
      // Only trigger for source file, not destination
      // Check: ends with electron/preload.cjs AND does not contain dist-electron
      if (file.endsWith('electron/preload.cjs') && !file.includes('dist-electron')) {
        fs.copyFileSync('electron/preload.cjs', 'dist-electron/preload.cjs');
        console.log('[Preload] Copied preload.cjs');
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5200,
    strictPort: true, // Fail if port is in use instead of trying another
  },
  plugins: [
    react(),
    copyPreload(),
    electron([
      {
        // Main process entry file
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'node-pty'],
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electron': path.resolve(__dirname, './electron'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        // 4C: Manual chunks — split heavy vendor deps into separate cacheable bundles
        manualChunks: {
          'vendor-xterm': ['xterm', 'xterm-addon-fit', 'xterm-addon-web-links'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
