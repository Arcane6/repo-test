import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build final entra em static/dist (irmão de frontend/, dentro do próprio
// coverage-hub), servido pelo Flask como qualquer outro arquivo estático
// (sem CDN, sem Node em produção).
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // O prefixo /static/dist/ só faz sentido no build de produção (é onde o
  // Flask serve os assets). No dev server isso fazia o `npm run dev` abrir
  // em /static/dist/ em vez da raiz — base '/' aqui resolve.
  base: command === 'build' ? '/static/dist/' : '/',
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
  },
  server: {
    // Durante o dev (npm run dev), proxeia as chamadas de API para o Flask
    // rodando em paralelo, evitando CORS e mantendo as mesmas URLs de prod.
    // IMPORTANTE: cada módulo com prefixo próprio precisa entrar aqui. O
    // Core usa /core/api/* — sem esta linha, em dev as chamadas do Core
    // caíam no index.html do próprio Vite (HTML 200) e o front estourava
    // "Unexpected token '<', <!doctype". Proxeamos só /core/api (a rota de
    // dados), nunca /core sozinho — esse é a página da SPA, servida pelo
    // Vite no cliente.
    proxy: {
      '/mobile-access/api': 'http://127.0.0.1:5000',
      '/trafego/api': 'http://127.0.0.1:5000',
      '/transport/api': 'http://127.0.0.1:5000',
      '/controle-fisico-financeiro/api': 'http://127.0.0.1:5000',
      '/api': 'http://127.0.0.1:5000',
    },
  },
}))
