import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('../../', import.meta.url)), '');
  return { plugins: [react()], server: { port: 5173, strictPort: true, proxy: { '/api': `http://${process.env.HOST || env.HOST || '127.0.0.1'}:${process.env.PORT || env.PORT || 4000}` } } };
});
