import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base = process.env.NODE_ENV === 'production' ? '/glow-skin/' : '/';

export default defineConfig({
  plugins: [react()],
  base,
  server: { port: 5373, host: '0.0.0.0', allowedHosts: true },
  test: { include: ['src/**/*.test.ts'] },
});
