import process from 'node:process';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import { defineConfig, loadEnv } from 'vite';

const readPort = (env, key, fallbackPort) => {
  const value = Number.parseInt(env[key] || '', 10);
  return Number.isFinite(value) ? value : fallbackPort;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devPort = readPort(env, 'VITE_DEV_PORT', 5002);
  const previewPort = readPort(env, 'VITE_PREVIEW_PORT', devPort);
  const authPopupHeaders = {
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  };

  return {
    plugins: [
      react(),
      federation({
        name: 'adminApp',
        filename: 'remoteEntry.js',
        exposes: {
          './AdminModule': './src/AdminModule.jsx',
        },
        shared: ['react', 'react-dom', 'react-router', 'react-router-dom'],
      }),
    ],
    server: {
      headers: authPopupHeaders,
      port: devPort,
      strictPort: true,
    },
    preview: {
      headers: authPopupHeaders,
      port: previewPort,
      strictPort: true,
      cors: true,
    },
    build: {
      rollupOptions: {
        input: {
          index: 'index.html',
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) {
              return 'firebase-vendor';
            }

            if (id.includes('node_modules/react') || id.includes('node_modules/react-router')) {
              return 'react-vendor';
            }

            return undefined;
          },
        },
      },
      target: 'esnext',
    },
  };
});
