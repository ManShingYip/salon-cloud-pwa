import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',   // 讓 iPad 在相同 WiFi 下可連入測試
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
