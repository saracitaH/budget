import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // iOS n'accepte pas la transparence : fond plein pour l'icône d'écran d'accueil
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#0f5e55' } },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: '#0f5e55' } },
    transparent: { sizes: [64, 192, 512], padding: 0 },
  },
  images: ['public/icon.svg'],
})
