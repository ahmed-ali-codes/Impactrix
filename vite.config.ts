import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      root: 'src/webview',
      build: {
        outDir: '../../out/webview',
        emptyOutDir: true,
        rollupOptions: {
          output: {
            entryFileNames: 'bundle.js',
            chunkFileNames: 'bundle.js',
            assetFileNames: 'bundle.[ext]'
          }
        }
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
