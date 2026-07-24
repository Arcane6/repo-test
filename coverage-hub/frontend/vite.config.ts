import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Build final entra em static/dist (irmão de frontend/, dentro do próprio
// coverage-hub), servido pelo Flask como qualquer outro arquivo estático
// (sem CDN, sem Node em produção).
//
// VITE_BASE_PATH: quando o dev server roda atrás de um reverse proxy num
// subpath (ex.: nginx expondo em /integration/, com o Grafana na raiz "/"),
// o Vite precisa saber esse prefixo pra gerar/servir os assets no caminho
// certo — sem isso, o HTML/JS aponta pra "/" e cai no app errado atrás do
// proxy. `App.tsx` lê o mesmo valor via `import.meta.env.BASE_URL` (uma
// fonte só, sem duplicar a string em dois lugares).
//
// Lida via um `frontend/.env` (ou `.env.local`, `.env.production`) de
// verdade — NÃO basta setar `process.env.VITE_BASE_PATH` no config, o
// Vite não carrega `.env` sozinho dentro do próprio arquivo de config
// (só expõe pro código do cliente via `import.meta.env`); `loadEnv` é o
// jeito certo de ler o `.env` do projeto aqui.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    // O prefixo /static/dist/ só faz sentido no build de produção padrão (é
    // onde o Flask serve os assets). No dev server, sem VITE_BASE_PATH, fica
    // '/' — com VITE_BASE_PATH definido no .env (deploy atrás de proxy), usa
    // o valor passado (ex.: '/integration/').
    base: env.VITE_BASE_PATH || (command === 'build' ? '/static/dist/' : '/'),
    build: {
      outDir: '../static/dist',
      emptyOutDir: true,
    },
    server: {
      // Necessário pro nginx (rodando em outra máquina/IP) conseguir alcançar
      // o dev server — sem isso o Vite só escuta em localhost.
      host: true,
      // Vite 6+ bloqueia por padrão hosts desconhecidos no header Host
      // ("Blocked request. This host is not allowed") — o nginx repassa o
      // Host original do domínio interno, então precisa estar na allowlist.
      allowedHosts: ['arcigrafana.internal.timbrasil.com.br'],
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
        '/api': 'http://127.0.0.1:5000',
      },
    },
  }
})
