import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          // 1) 온라인 타일 캐시 (약관 준수 필수)
          {
            urlPattern: /https:\/\/(a|b|c)\.tile\.openstreetmap\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          // 2) 앱 API (필요 시 경로 수정)
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3
            }
          },
          // 3) 로컬 pmtiles는 네트워크 없이도 접근(정적자원)
        ]
      },
      manifest: {
        name: 'Offline Realtime Map',
        short_name: 'Map',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: []
      },
      devOptions: { enabled: true }
    })
  ],
  server: { host: '0.0.0.0', port: 5173 }
})
