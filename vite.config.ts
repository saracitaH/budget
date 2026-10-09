import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// L'appli sera servie sur https://<compte>.github.io/budget/
// Ne jamais changer cette adresse une fois installée : les données y sont liées.
const base = '/budget/'

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Budget',
        short_name: 'Budget',
        description: 'Suivi de budget personnel, 100 % local',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f5e55',
        background_color: '#0f5e55',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: { host: true },
})
