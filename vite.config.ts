import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
// import renderer from 'vite-plugin-electron-renderer';
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
      if (file.endsWith('preload.cjs')) {
        fs.copyFileSync('electron/preload.cjs', 'dist-electron/preload.cjs');
        console.log('[Preload] Copied preload.cjs');
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
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
              external: ['electron', 'better-sqlite3'],
            },
          },
        },
      },
    ]),
    // renderer(), // Disabled - causing renderer.bundle.js error
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
    },
  },
});
