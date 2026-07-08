# Frontend (React + TypeScript + Vite)

Vive dentro do `coverage-hub` — é o mesmo projeto, não um repo separado.
Nova UI dos dashboards de BI, migrando aos poucos do Flask+Jinja+JS
vanilla atual. Sem CDN: todas as dependências (React, ECharts, Bootstrap,
etc.) são baixadas via npm e empacotadas no build.

## Como rodar

```bash
cd coverage-hub/frontend
npm install       # instala as dependências (uma vez, ou quando mudarem — precisa rodar antes do primeiro `npm run dev`/`npm run build`, node_modules não vai pro git)
npm run dev       # servidor de dev com hot-reload em http://localhost:5173
```

O dev server proxeia `/mobile-access/api/*` e `/b2b-mobile/api/*` para o
Flask (`python app.py`, na porta 5000) — suba os dois em paralelo durante
o desenvolvimento.

## Como buildar para produção

```bash
npm run build
```

Isso gera, dentro do `coverage-hub` (um nível acima de `frontend/`):
- `static/dist/` — o bundle React (JS/CSS com hash), servido pelo Flask
  como estático.
- `static/vendor/` — cópia das libs que as páginas Jinja legadas ainda
  carregam via `<script>` direto (Bootstrap, Choices.js, D3, ECharts),
  vindas dos mesmos pacotes do `package.json` — sem CDN.

Esses dois diretórios são gerados (não versionados — veja `.gitignore`
do `coverage-hub`). Rodar `npm run build` faz parte do processo de
deploy; não precisa de Docker, só de Node instalado onde o build rodar.

## Arquitetura

```
src/
  api/         client tipado por módulo (ex.: mobileAccess.ts), consome as
               mesmas rotas JSON que o Flask já expõe hoje
  store/       estado global de filtros (Zustand) — é o que viabiliza o
               cross-filtering entre gráficos
  charts/      <Chart /> genérico: wrapper único de ciclo de vida do
               ECharts (init/resize/dispose/click). Gráficos novos só
               precisam montar um `option`, não reimplementar o resto
  components/  peças de UI reutilizáveis (KPIs, tabela, filtros...)
  dashboards/  composição de components para uma visão completa
```

### Cross-filtering

Cada componente de gráfico lê filtros do `useFilterStore` (Zustand) e usa
o React Query com esses filtros na `queryKey` — mudar um filtro reflete
automaticamente em todos os gráficos que dependem dele. Clicar num
elemento de gráfico (ex.: uma barra) chama `toggle(dimensão, valor)` no
store, que funciona exatamente como selecionar aquele valor no filtro
manual — é o mesmo mecanismo, só disparado pelo clique no gráfico.

### Próximos módulos

O piloto atual é a aba **Cidades** do Acesso Móvel
(`/mobile-access/cidades-react/`, ainda não linkada no menu). Depois de
validado, o plano é: apontar a tab "Cidades" pra essa versão, remover a
implementação antiga (`static/js/mobile_access.js` + `_tab_actual.html`),
e repetir o padrão pros próximos módulos (Resumo, B2B Mobile, etc.).
