# Budget

Petite appli de suivi de budget pour iPhone (PWA). Toutes les données restent sur le téléphone, dans IndexedDB : pas de compte, pas de serveur.

- Appli : https://saracitah.github.io/budget/ (Safari › Partager › Sur l'écran d'accueil)
- Stack : Vite, Svelte 5, TypeScript, Dexie, vite-plugin-pwa
- Déploiement : GitHub Actions → GitHub Pages à chaque push sur `main`

```bash
npm install
npm run dev      # développement
npm test         # tests unitaires
npm run build    # version de production
```
