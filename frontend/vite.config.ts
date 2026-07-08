import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build final entra em coverage-hub/static/dist, servido pelo Flask
// como qualquer outro arquivo estático (sem CDN, sem Node em produção).
export default defineConfig({
  plugins: [react()],
  base: '/static/dist/',
  build: {
    outDir: '../coverage-hub/static/dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: 'src/main.tsx',
    },
  },
  server: {
    // Durante o dev (npm run dev), proxeia as chamadas de API para o Flask
    // rodando em paralelo, evitando CORS e mantendo as mesmas URLs de prod.
    proxy: {
      '/mobile-access/api': 'http://127.0.0.1:5000',
      '/b2b-mobile/api': 'http://127.0.0.1:5000',
    },
  },
})
