import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build final entra em static/dist (irmão de frontend/, dentro do próprio
// coverage-hub), servido pelo Flask como qualquer outro arquivo estático
// (sem CDN, sem Node em produção).
export default defineConfig({
  plugins: [react()],
  base: '/static/dist/',
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
  },
  server: {
    // Durante o dev (npm run dev), proxeia as chamadas de API para o Flask
    // rodando em paralelo, evitando CORS e mantendo as mesmas URLs de prod.
    proxy: {
      '/mobile-access/api': 'http://127.0.0.1:5000',
    },
  },
})
