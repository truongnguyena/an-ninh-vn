import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    // Development proxy
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // Production build settings
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          // Split vendor code for better caching
          manualChunks: {
            vendor: ['react', 'react-dom'],
            utils:  ['axios', 'qrcode.react'],
          },
        },
      },
    },
  };
});
