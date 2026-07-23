import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
        },
        manifest: {
          name: 'MoneyMate AI',
          short_name: 'MoneyMate',
          description: 'AI Financial Coach & GST Tracker',
          theme_color: '#0a0a0a',
          background_color: '#0a0a0a',
          display: 'standalone',
          icons: [
            {
              src: 'https://api.iconify.design/lucide/sparkles.svg?color=%23a855f7&width=192&height=192',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: 'https://api.iconify.design/lucide/sparkles.svg?color=%23a855f7&width=512&height=512',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 4000,
    },
  };
});
