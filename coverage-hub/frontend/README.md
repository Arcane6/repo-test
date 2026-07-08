# Frontend (React + TypeScript + Vite)

Vive dentro do `coverage-hub` — é o mesmo projeto, não um repo separado.
Migração completa: **toda a UI é React**. O Flask não renderiza mais
nenhum HTML — só serve APIs JSON (`/mobile-access/api/*`, `/api/modules`)
e o bundle estático desta pasta (`static/dist/`, servido pra qualquer
rota via `send_from_directory`, deixando o roteamento de verdade por
conta do react-router no cliente).

Sem CDN: todas as dependências (React, ECharts, Bootstrap, react-select,
ExcelJS...) são baixadas via npm e empacotadas no build.

## Como rodar

```bash
cd coverage-hub/frontend
npm install       # instala as dependências (uma vez, ou quando mudarem — precisa rodar antes do primeiro `npm run dev`/`npm run build`, node_modules não vai pro git)
npm run dev       # servidor de dev com hot-reload em http://localhost:5173
```

O dev server proxeia `/mobile-access/api/*` para o Flask (`python app.py`,
na porta 5000) — suba os dois em paralelo durante o desenvolvimento.

## Como buildar para produção

```bash
npm run build
```

Isso gera `../static/dist/` (bundle React com JS/CSS com hash), servido
pelo Flask como estático. Esse diretório é gerado (não versionado — veja
`.gitignore` do `coverage-hub`). Rodar `npm run build` faz parte do
processo de deploy; não precisa de Docker, só de Node instalado onde o
build rodar.

## Arquitetura

```
src/
  api/         client tipado por módulo (mobileAccess.ts, summary.ts,
               modules.ts), consome as rotas JSON do Flask
  store/       estado global de filtros (Zustand) — viabiliza o
               cross-filtering entre gráficos
  theme/       tema claro/escuro (Zustand) + paleta aplicada automaticamente
               a qualquer gráfico ECharts (sem precisar repetir por gráfico)
  charts/      <Chart /> genérico: wrapper único de ciclo de vida do
               ECharts (init/resize/dispose/click/tema). Gráficos novos só
               precisam montar um `option`, não reimplementar o resto.
               optionBuilders.ts é o catálogo de templates prontos —
               antes de escrever um `option` do zero, veja se algum serve:
                 barsByTechOption       barras verticais por tecnologia
                 horizontalBarsOption   ranking (top N) em barras horizontais
                 donutOption            donut, legenda embaixo
                 pieOption              pizza cheia, paleta cíclica
                 regionalSunburstOption donut c/ total no centro + 2 séries por categoria
                 vendorDonutSideOption  donut c/ total no centro, legenda lateral
                 timeSeriesOption       linhas acumuladas no tempo, com Δ no tooltip
               Todos aceitam um `focusedX` opcional pro cross-filter visual.
  components/  peças de UI reutilizáveis (KPIs, tabela, filtros, Venn,
               ChartPanel — card padrão de gráfico com export de
               imagem/dados —, ChartToolbar, small multiples)
  layout/      Navbar (menu + módulos habilitados + tema), Footer, Layout
  pages/       Home (cards de módulo) e o layout de tabs do Acesso Móvel
  dashboards/  composição de components para uma visão completa
               (Cidades, Resumo com suas 3 raias)
  utils/       exportação pra Excel (ExcelJS) com formatação de verdade
```

### Roteamento

React Router controla toda a navegação:
- `/` — Home (cards de módulo, vindos de `GET /api/modules`)
- `/mobile-access` — redireciona pra `/mobile-access/resumo`
- `/mobile-access/resumo` — aba Resumo (3 raias)
- `/mobile-access/cidades` — aba Cidades

### Cross-filtering

Cada componente de gráfico lê filtros do `useFilterStore` (Zustand) e usa
o React Query com esses filtros na `queryKey` — mudar um filtro reflete
automaticamente em todos os gráficos que dependem dele. Clicar num
elemento de gráfico (ex.: uma barra) chama `toggle(dimensão, valor)` no
store, que funciona exatamente como selecionar aquele valor no filtro
manual — é o mesmo mecanismo, só disparado pelo clique no gráfico.

### Exportação (imagem e dados brutos)

Todo gráfico construído com `<ChartPanel/>` ganha, de graça: um botão
"baixar imagem" (PNG em alta resolução via `getDataURL` do ECharts, fundo
branco fixo — pronto pra PPTX) e um botão "exportar dados" (a base bruta
por trás do gráfico, não o resumo visual, em `.xlsx` formatado via
ExcelJS — cabeçalho em negrito, cor da marca, autofiltro). A aba Cidades
também tem um botão de "exportar base completa" que junta várias fontes
num único Excel de múltiplas abas.

### Tema claro/escuro

`useThemeStore` aplica `data-theme`/`data-bs-theme` no `<html>` e persiste
em `localStorage`. O componente `<Chart/>` genérico já aplica a paleta do
tema atual a qualquer `option` automaticamente (ver `theme/chartTheme.ts`)
— nenhum gráfico precisa se preocupar com isso individualmente.

### Próximos módulos

Hoje só o Acesso Móvel (Resumo + Cidades) está ativo — é o único módulo
habilitado em `config/modules.py`. Os demais aparecem na Home como
"Em breve" (Core, Transporte, Orçamento, Resumo Executivo, Base Única);
o padrão de arquitetura acima (API tipada + FilterBar por campos +
ChartPanel/optionBuilders) é o que se repete ao ligar um módulo novo.
