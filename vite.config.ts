import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 網址是 https://yolanda1027-sudo.github.io/stEditor/，打包時要加上子路徑
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/stEditor/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Silly Studio',
        short_name: 'Silly Studio',
        description: 'SillyTavern 角色卡與 Lorebook 編輯器',
        lang: 'zh-Hant-TW',
        theme_color: '#fff5f7',
        background_color: '#fff6f8',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
}));
