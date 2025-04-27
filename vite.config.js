// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          colyseus: ['colyseus.js']
        }
      }
    }
  }
});