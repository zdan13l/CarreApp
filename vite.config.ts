import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest', // custom service worker (src/sw.ts) to receive push notifications
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'favicon.svg', 'apple-touch-icon.png'],
      // The 3D map is heavy (~1.9 MB): load it on demand instead of precaching it on every phone.
      injectManifest: { globPatterns: ['**/*.{js,css,html,woff2,svg,png}'], globIgnores: ['**/MapView-*', '**/*vietnamese*', '**/mammoth*', '**/*excel*', '**/passportPdf-*', '**/server.browser-*', '**/archivo-*-wdth-normal-*.js'] }, // the last three only build the PDF of the passport, on demand
      manifest: {
        name: 'CarreApp',
        short_name: 'CarreApp',
        description: 'Gestión en vivo de la Carrera de inducción',
        lang: 'es',
        theme_color: '#070b18',
        background_color: '#070b18',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
