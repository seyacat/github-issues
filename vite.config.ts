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
        icons: [
          {
            src: 'images/icon.ico',
            sizes: '32x32',
            type: 'image/x-icon'
          },
          {
            src: 'images/logo.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
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