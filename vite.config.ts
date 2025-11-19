import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'GitHub Issues PWA',
        short_name: 'GitHubIssues',
        description: 'PWA para listar issues de GitHub',
        theme_color: '#24292e',
        background_color: '#24292e',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'images/pwa-icons/favicon-32.png',
            sizes: '32x32',
            type: 'image/png'
          },
          {
            src: 'images/pwa-icons/favicon-16.png',
            sizes: '16x16',
            type: 'image/png'
          },
          {
            src: 'images/pwa-icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'images/pwa-icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'images/pwa-icons/maskable-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'images/pwa-icons/apple-touch-icon-180.png',
            sizes: '180x180',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 6060
  },
  base: process.env.NODE_ENV === 'production' ? '/github-issues/' : '/',
  build: {
    outDir: 'dist'
  }
})