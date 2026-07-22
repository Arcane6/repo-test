# TIM Technical Planning — Coverage Hub

Portal interno de planejamento técnico da TIM Brasil (cobertura móvel, rollout,
orçamento). Fonte de verdade do projeto — leia isto antes de mexer em
qualquer coisa. Mantenha este arquivo atualizado quando a arquitetura, as
regras de negócio ou as fontes de dado mudarem.

## Quem eu sou nesse projeto

Atue como um staff designer + staff UX/UI + staff data scientist + staff
backend developer ao mesmo tempo — com a visão de um diretor de empresa
multinacional de telecom. Isso significa:

- **Questione números que não fecham.** Se um total, um rateio ou uma
  contagem parecer inconsistente (dobrar, zerar, não bater com outro
  card), pare e investigue antes de aceitar como "deve ser assim".
- **Não empilhe gráfico em cima de gráfico.** Antes de adicionar um
  visual novo, pergunte se ele já existe em outro formato, se a
  informação cabe em algo que já está na tela, ou se está duplicando
  outro card.
- **Regra de negócio > estética.** Um gráfico bonito com número errado
  (double count, denominador errado, filtro que não aplica) é pior do
  que nenhum gráfico.
- **UI em português, sempre.** Todo texto visível ao usuário (títulos,
  subtítulos, labels, mensagens) é em português. Comentários de código
  também são em português, seguindo o padrão já estabelecido no repo.

## Stack e como rodar

- **Backend**: Flask (Python), API JSON pura — nenhuma renderização
  server-side. `app.py` registra os blueprints e serve o build do Vite
  como SPA (rota catch-all `/`).
  - **Roteamento de API — duas regras que já custaram caro (bug do
    "Unexpected token '<', <!doctype ... is not valid JSON")**: esse erro
    NÃO é backend fora do ar nem falta de restart. Ele acontece quando o
    `fetchJson` do front recebe um **HTML com status 200** e tenta
    `response.json()`. Duas fontes possíveis, ambas já corrigidas — não
    reintroduzir:
    1. **Catch-all da SPA (`spa()` em `app.py`)**: um path `/.../api/...`
       que não casa com nenhum blueprint (endpoint removido/renomeado,
       build do front velho) tem que devolver **404 JSON**, nunca o
       `index.html`. Servir HTML-200 numa rota de API mascara o erro real
       e ainda passa pelo `if (!response.ok)` do front (é 200). A regra
       `if "/api/" in f"/{path}": return jsonify(...), 404` garante isso.
    2. **Proxy do Vite (`vite.config.ts`)**: em `npm run dev` o front roda
       no Vite (:5173) e as chamadas de API são proxiadas pro Flask
       (:5000). **Cada módulo com prefixo próprio precisa estar no
       `proxy`** — hoje `/mobile-access/api`, `/core/api` e `/api`. Sem a
       linha do módulo, a chamada cai no `index.html` do próprio Vite
       (HTML-200) e dá o mesmo erro. Ao criar um módulo novo com prefixo
       próprio, **adicione o prefixo `/<modulo>/api` no proxy** (nunca o
       prefixo sozinho tipo `/core` — esse é a página da SPA).
- **Frontend**: React + TypeScript + Vite, em `frontend/` (dentro do
  projeto Flask, não um repo irmão). Build gera `static/dist/`, servido
  pelo Flask. Sem CDN, sem Docker — tudo local/instalado via npm.
- **Banco**: Oracle via `oracledb` (thin mode), pool de conexões em
  `database/oracle.py`. Credenciais via `.env` (`config/settings.py`).
- **BigQuery** (`database/bigquery.py`): conector pronto pra uso
  futuro, **nenhuma feature usa ainda** — criado a pedido do usuário
  pra ter à mão se precisar ler algo do GCP. Mesma forma de uso do
  Oracle (`execute_query(sql, params)` devolve `list[dict]`), mas
  client **lazy** (só conecta na primeira chamada) em vez de eager no
  import do módulo — diferente do Oracle, que é dependência obrigatória
  do app inteiro, o BigQuery não pode quebrar a inicialização do Flask
  enquanto nada o usa de verdade. Autenticação via Application Default
  Credentials do próprio Google Cloud (`GOOGLE_APPLICATION_CREDENTIALS`
  no `.env` apontando pro JSON da service account, ou identidade nativa
  se rodar dentro do GCP) — não inventamos esquema de auth próprio.
  Placeholders na query usam a sintaxe do BigQuery (`@nome`), não `:nome`
  do Oracle. Se um dia alguma feature realmente precisar de BigQuery,
  o service correspondente importa `database.bigquery.execute_query`
  do mesmo jeito que os outros importam `database.oracle.execute_query`.
- Rodar frontend: `cd frontend && npm run build` (gera `static/dist/`).
  Não existe servidor Oracle real neste ambiente de sandbox — testes
  ponta a ponta usam um `execute_query` mockado (stub) + Playwright
  contra o Flask local. Sempre valide `python3 -m py_compile` nos
  arquivos backend alterados e `npm run build` no frontend antes de
  considerar uma tarefa concluída.

## Estrutura de módulos

```
modules/
  core/            — endpoint /api/modules (lista de módulos p/ Home) —
                     NOME CONFUSO DE PROPÓSITO: é infra do portal (nada
                     a ver com o módulo de negócio "Core" da Home/RAN).
  traffic/         — módulo de negócio "Tráfego" (planejado × realizado,
                     ver seção própria abaixo) — substituiu o antigo
                     `network_core` (volumetria ALTAIA), descontinuado
                     quando a fonte de tráfego mudou. Prefixo /trafego.
  mobile_access/   — módulo "Acesso Móvel"
    actual/        — aba "Cidades" (rede hoje, MUNICIPIOS_FECHAMENTO)
    summary/       — aba "Resumo" (raias R1/R2/R3)
    sites/         — aba "Sites" (inventário de sites físicos,
                     TB_FT_BASE_UNICA_SITES — ver seção própria abaixo)
    shared/        — filtros, constantes, refs (fonte + data mais recente)
  budget/, executive/, transport/  — módulos placeholder, __init__.py
    vazio, listados em config/modules.py com enabled=False (aparecem
    como "Em breve" na Home). Não é código morto — é intencional.
```

Frontend espelha isso em `frontend/src/dashboards/` (`CidadesDashboard`,
`ResumoDashboard` com `resumo/Raia1.tsx`, `Raia2.tsx`, `Raia3.tsx`,
`SitesDashboard`, `TrafegoResumoExecutivo`, `TrafegoYtd`).

## Aba Sites (`modules/mobile_access/sites/`)

Inventário de sites físicos — deliberadamente **só Fechamento 25**
(`TB_FT_BASE_UNICA_SITES`, que tem `END_ID` único). Não mistura Casa
Nova do Plano 26 (`TB_ROLLOUT_ACESSO` não tem coluna de site único — é
exatamente por isso que "Sites Físicos EoY 26" foi removido antes; não
reabrir essa porta aqui sem uma coluna de dedup confiável).

- **Join com `MUNICIPIOS_FECHAMENTO` por `IBGE`**, não por `UF+MUNICIPIO`
  em string — `TB_FT_BASE_UNICA_SITES` tem `IBGE` (confirmado pelo
  usuário via M-query do Power BI antigo). Mais robusto que o
  string-match usado em outras queries mais antigas do módulo.
- **Sites por Tecnologia Máxima**: cascata 5G>4G>3G>2G, cada site conta
  uma vez (mesma lógica do extinto `R1_SITES_BY_TECH`).
- **Sites por Tecnologia**: contagem independente por tech — um site
  2G+4G conta nas duas barras (não é dedup).
- **Pivot (Regional/UF/Município)**: backend entrega uma linha por
  Município já com as duas métricas acima; o frontend
  (`SitesPivotTable.tsx`) é uma tabela plana com seletor de métrica, não
  um pivot arrasta-solta de verdade — decisão consciente pra não
  over-engenheirar um widget novo sem validar a necessidade primeiro.
- **Tipo de Site**: cruza `MOBILE_SITE` × `FLAG_TX_PROFILE_ENG`
  (renomeado `TX_PROFILE` na UI). Universo **diferente** das outras
  visões desta aba — só exige `STATUS_END_ID='ATIVADO'` e exclui
  roaming, mas **não** filtra `MOBILE_SITE='SIM'` (é uma das dimensões
  mostradas). Por isso o total dessa visão não bate com o total das
  outras — é esperado, não é bug.
- **Fornecedor Dominante por Site**: fonte real é
  `NTW_MABE.BASE_TB_END_ID_NEW` (confirmado pelo usuário via query ODBC
  do Power BI antigo — a leitura anterior de "VW03 || RF DESIGN PROFILE
  (VENDOR_2)" e de "depende de `TB_FT_BASE_UNICA_SITES`" estavam
  erradas). **Mesma cascata de colunas `VENDOR_*` já usada em
  `R1_VENDORS`** (`summary/queries.py`) — 19 colunas confirmadas
  1:1 com a query real do usuário (GSM_900/1800, UMTS_850/2100,
  LTE_700/850/1800/2100/2300/2600/2600RS/2600P,
  NR_700DSS/1800DSS/2100DSS/2600DSS/2300/3500/26000), maior banda
  primeiro dentro de cada tec. Diferente de `R1_VENDORS`, aqui o join é
  feito **dentro do universo de sites já filtrado** desta aba (`BASE`
  da `SITES_BASE_CTE`), não como query independente — garante que o
  total do donut de fornecedor bate com o total das outras visões da
  mesma tela (confirmado: 45.230 nos dois, testado com stub). Sem
  `FillDown` (a lógica frágil do Power Query original não foi
  replicada) — site sem match vira "A DEFINIR".

- **Sites no Mapa**: `SITES_GEO_POINTS` (`sites/queries.py`) +
  `get_sites_geo_points` (`sites/service.py`) + rota
  `/api/sites/geo-points` devolvem um ponto por site (END_ID, UF,
  MUNICIPIO, `LATITUDE`/`LONGITUDE`, tecnologia máxima, cor) — descarta
  site sem coordenada. O backend não muda entre a v1 (ECharts) e a v2
  (Leaflet, atual) — só o consumo no frontend mudou.

### Mapa v2 — Leaflet com tiles de verdade (Ruas/Satélite/Escuro)

A v1 usava o `geo`/`scatter` do ECharts com um contorno GeoJSON estático
(silhueta só, sem rua/cidade/relevo real). O usuário pediu "outras
camadas" pra uma experiência de diretor — trocamos pra tiles de mapa de
verdade via **Leaflet puro** (BSD-2-Clause) + **leaflet.markercluster**
(MIT), wrapper imperativo em `components/SitesMap.tsx` (mesmo padrão de
`charts/Chart.tsx` pro ECharts: `L.map()` no mount, `.remove()` no
unmount, sem lib de binding React no meio).

**Evitado de propósito: `react-leaflet`.** Todas as versões (3/4/5) são
licenciadas **Hippocratic-2.1** — uma licença "ethical source" com
cláusulas de uso que não é OSS permissiva de verdade (tipo MIT/BSD/ISC).
Não é apropriado importar isso numa ferramenta corporativa sem revisão
jurídica, e não tinha necessidade real: Leaflet puro cobre tudo que
precisávamos com uma API pequena, e já tínhamos o padrão de wrapper
imperativo estabelecido pro ECharts.

**Camadas base** (`baseLayers()` em `SitesMap.tsx`), todas gratuitas, sem
chave de API, cada uma com atribuição correta nos termos de uso:
- **Ruas** — OpenStreetMap padrão.
- **Satélite** — Esri World Imagery.
- **Escuro** — CARTO Dark Matter (combina bem com o tema escuro do portal).

Trocadas via `L.control.layers()` nativo do Leaflet (radio button,
sem componente extra). **Sites por tecnologia** viram overlays
independentes (`L.markerClusterGroup`, um por tech) na mesma control —
o usuário liga/desliga tecnologia como checkbox, e o cluster já
recalcula a contagem sozinho. Cada site é um `L.circleMarker` colorido
por `TECH_COLORS`, com popup (município/UF/tech/END_ID).

Botões "Brasil"/"Múndi" continuam existindo, mas agora são só atalhos de
enquadramento (`fitBounds`/`setView`) — o mapa sempre permite pan/zoom
livre, diferente da v1 onde trocar de visão trocava o mapa inteiro.

**Assets/deps removidos da v1** (não usar mais, se aparecerem numa busca
antiga): `frontend/public/geo/*.geo.json`, `charts/maps.ts`,
`GeoComponent`/`ScatterChart` em `charts/Chart.tsx`.

**Limitação conhecida deste sandbox de dev**: `tile.openstreetmap.org`,
`server.arcgisonline.com` e `*.basemaps.cartocdn.com` são bloqueados
pela política de rede deste ambiente (mesma classe de bloqueio que já
pegou `echarts.apache.org` antes) — não dá pra ver o tile renderizado de
verdade rodando aqui, só a estrutura (controles, clusters, popups,
troca de camada) sem erro de JS. Isso não afeta o ambiente real de
produção do usuário, que não tem essa mesma restrição de rede.

"Sites" hoje tem as 6 visões completas: max-tech, por-tecnologia,
fornecedor dominante, tipo de site, mapa (Brasil/Múndi, tiles Leaflet) e
pivot.

## Módulo Tráfego (`modules/traffic/`) — planejado × realizado + market share

Substituiu o antigo módulo Core (volumetria ALTAIA, `network_core`,
**removido**) — a fonte de tráfego mudou. Prefixo `/trafego`, duas abas:
**Resumo Executivo** (3 raias: Fechamento 2025 · Plano 26 · Fechamento 26)
e **Tráfego YTD** (planejado × realizado acumulado + aderência ao plano).

- **Fontes** (Oracle; os `TRAFEGO_PLANEJADO.csv`/`TRAFEGO_REALIZADO.csv`
  na raiz do projeto são **amostra de schema** pra dev/teste sem Oracle,
  não a fonte de produção):
  - **`REL_TRAFEGO_CIDADES_WIDE`** (planejado): 1 linha por
    (município, `TIPO_TRAF`), com os 12 meses em **colunas**
    (`JANEIRO`..`DEZEMBRO`), `ANO`. Existe a `REL_TRAFEGO_CIDADES_LONG`
    (mesmo dado com mês em linha). `MUNICIPIO_ID` é o IBGE de 6 dígitos.
    Também é **agregado no Oracle** (não puxa as ~28k linhas cruas):
    `PLANEJADO_POR_CAMADA` (`GROUP BY TIPO_TRAF`, 5 linhas com os 12 meses
    somados → série/total/YTD nacional pela linha Consolidado + split por
    camada), `PLANEJADO_POR_UF` (`GROUP BY ESTADO`, só Consolidado → YTD por
    UF) e `PLANEJADO_TOP_MUNICIPIOS` (`ORDER BY ... WHERE ROWNUM <= 15` → só
    o top 15). Assume que as colunas de mês são `NUMBER` (fazemos `SUM`
    direto); se vierem `VARCHAR`, envolver em `TO_NUMBER`.
  - **`REL_DS013_TRAFEGO_REALIZADO`** (realizado): 1 linha por
    (município, `OPERADORA`), snapshot mensal (`DT_REFERENCIA`). Traz
    **TIM e OI**. Base de usuários rica (não usada ainda). A tabela crua é
    grande (**~140k linhas** no ano cheio: município × operadora × mês), então
    o realizado é **agregado no Oracle** (`GROUP BY`), não puxado cru:
    `REALIZADO_POR_MUNICIPIO` (uma linha por município, soma de meses e
    operadoras → ~5,5k linhas; alimenta total, mix por tecnologia, ranking e
    quebra por UF) e `REALIZADO_POR_MES` (uma linha por mês → 12; alimenta a
    curva e descobre o mês corrente). Nunca voltar a puxar a tabela crua e
    agregar no Python.
- **Regras de negócio confirmadas nos dados** (não reintroduzir erro):
  - **`TIPO_TRAF='Consolidado'` é o TOTAL oficial** do planejado — NÃO é
    a soma das outras camadas. A hierarquia é `Consolidado = "2G/3G" +
    "4G/5G"` e `"4G/5G" = "4G" + "5G"`. O split **aditivo** que fecha
    100% é `{2G/3G, 4G, 5G}` (`CAMADAS_ADITIVAS`); "4G/5G" e "Consolidado"
    ficam de fora de qualquer pizza pra não dobrar.
  - **Planejado já vem em PB.** **Realizado vem em MB** →
    converter pra PB dividindo por `1e9` (`MB_POR_PB`, decimal: 1 PB =
    1e9 MB). As colunas por tecnologia do realizado **são aditivas**
    (`S_MEGABYTE_2G+3G+4G+5G_NSA+5G_SA = TOTAL`, confirmado).
  - **A OI pertence à TIM — NÃO existe market share.** O usuário foi
    explícito: OI não é concorrente, é da TIM. Então "tráfego realizado" =
    **soma de TODAS as operadoras** da fonte (TIM + OI = grupo TIM); todas
    as funções `_rz_*` agregam sobre as linhas inteiras, sem filtrar
    operadora. Não reintroduzir cálculo/visual de market share TIM×OI.
  - **YTD = acumulado Jan..mês corrente**, onde o mês corrente é o maior
    `MES` do realizado do ano (`_mes_corrente`). **Aderência = realizado
    ÷ planejado** no mesmo intervalo. **Crescimento YoY** = realizado YTD
    deste ano vs mesmo período (Jan..mês corrente) do ano anterior
    (`_pct_growth`). **Projeção fim de ano** = run-rate linear
    (`realizado_ytd / mês_corrente × 12`), comparada ao plano cheio
    (`atingimento_plano_pct`). **Mix 5G** = % do tráfego que já é 5G
    (`_mix_5g_pct`) — leitura de modernização.
- **Visual (Resumo Executivo)**: 3 raias com o MESMO destaque de cor do
  Resumo do Acesso Móvel — **R1 Fechamento 2025 = `#003399` (azul)**,
  **R2 Plano 26 = `#F5C518` (amarelo)**, **R3 Fechamento 26 = `#7DC242`
  (verde)** — via as classes `.summary-raia`/`.raia-badge`. A curva mensal
  do Plano 26 traz **duas linhas** (planejado tracejado + realizado sólido
  acompanhando **até o mês corrente**, depois `null` pra a linha parar —
  `trafficPlanVsRealOption`, `connectNulls:false`).
- **Dois endpoints** (`routes.py`, prefixo `/trafego`):
  `/api/resumo-executivo` (as 3 raias numa chamada) e `/api/ytd`. Todo
  cálculo é feito em Python a partir das linhas (testável com stub sem
  Oracle — ver os testes que rodam contra os CSVs de amostra).
- **Filtro só geográfico** (UF via `ESTADO`; Município via **ponte por
  IBGE**). O tempo é fixo por raia, não é filtro de usuário. Store
  **próprio** (`store/trafficFilters.ts`, `components/TrafficFilterBar.tsx`)
  — não vaza pro Acesso Móvel. Reaproveita os endpoints de UF/busca de
  município do Acesso Móvel (lookup geográfico genérico).
  - **Município NÃO é filtrado por `MUNICIPIO_NOME`** direto:
    `_build_municipio_clause` resolve o nome pro IBGE via
    `MUNICIPIOS_FECHAMENTO` (de onde o autocomplete busca) e filtra
    `MUNICIPIO_ID` (IBGE de 6 díg = `SUBSTR(TO_CHAR(IBGE),1,6)`). Motivo: o
    **realizado** guarda o nome em CAIXA ALTA e **sem acento** ('SAO PAULO'),
    e o autocomplete devolve com acento ('São Paulo') — o match por nome
    funcionava no planejado (Raia 2) mas quebrava no realizado (Raias 1 e
    3). O `MUNICIPIO_ID` é idêntico nas duas tabelas, então a ponte
    resolve. Mesma família de solução de sites/summary.
- **Pendências conhecidas** (primeiro corte, iterar depois):
  - **Regional**: as tabelas de tráfego têm `ESTADO`/`ANF`, mas não
    `REGIONAL`. Pra abrir por regional falta confirmar a chave de join
    (`MUNICIPIO_ID` de 6 dígitos ↔ `TB_AUX_INFO_MUNICIPIOS.IBGE` de 7 —
    provável `/10`). Por ora só UF/Município.
  - Nos CSVs de amostra o realizado só traz **2026-03** (então YTD/
    aderência ficam distorcidos localmente — Jan/Fev realizados vazios) e
    não há **2025**; em produção o Oracle tem o histórico completo.

## Módulo Transporte (`modules/transport/`) — perfil de infraestrutura de TX

Perfil do backhaul/transporte e a **migração pra fibra**. Fonte:
`NTW_OP.REL_TX_PROFILE` (1 linha por site, snapshot único, ~33k linhas). Prefixo
`/transport`, duas abas (mesmo padrão do Tráfego): **Resumo Executivo**
(3 raias) e **Composição & Migração 25×26**.

- **Agregação no Oracle, não no servidor** (mesmo princípio do Tráfego):
  toda contagem sai de `GROUP BY` no banco — a taxonomia `<MÍDIA>
  <CAPACIDADE>` é decodificada em SQL com `REGEXP_SUBSTR`, e o Python só
  reformata os poucos grupos que voltam. Nunca trafegamos as ~33k linhas
  cruas. As queries são montadas por `_media_expr`/`_cap_expr` +
  builders (`media_transition_sql`, `cap_transition_sql`,
  `plano_profile_sql`, `make_buy_sql`, `fiber_por_regional_sql`,
  `fiber_por_tecnologia_sql`) em `queries.py`. A matriz de transição
  25→26 (`GROUP BY mídia25, mídia26`) serve vários números de uma vez
  (composição, variação e migração).
- **Tipo de transporte = `<MÍDIA> <CAPACIDADE>`** em `TIPO_TX_25` /
  `TIPO_TX_26` / `TIPO_TX_PLAN` (ex.: "FO 10G", "MW <1G", "SAT LEO").
  - **Mídia** = 1º token (FO/MW/SAT/LL/SLS/N/I); vazio → "Não definido".
  - **RS (RanSharing)** NÃO está no TIPO_TX — vem de
    `CLASSIFICACAO='RANSHARING'`, e o service **sobrescreve** a mídia pra
    RS (o usuário pediu RS como um dos tipos). Se um dia quiser RS sem
    apagar a mídia física, remover o override em `_media`.
  - **Capacidade** = 2º token (10G/1G/<1G) ou "Outros".
  - **Fiberização** = FO ÷ sites com mídia definida; **% 10G** = 10G ÷
    sites com capacidade conhecida.
- **Raias**: Fechamento 2025 (`TIPO_TX_25`) · Plano 26 (`TIPO_TX_PLAN` —
  só os ~461 sites com transformação planejada; o resto fica como está) ·
  Fechamento 26 (`TIPO_TX_26`) + variação de mídia 25→26.
- **Aba 2**: barras 25×26 por mídia, top migrações (MW→FO etc.), MAKE×BUY
  (`METODO_CONSTRUTIVO_FO`), fiberização por regional e **por tecnologia
  de rádio** (usa as cores canônicas — ver abaixo).
- **Aba 3 (Infraestrutura & Fornecimento)**: usa colunas próprias da
  `REL_TX_PROFILE` que não apareciam nas outras abas — **mapa** dos sites
  colorido por mídia (`LATITUDE`/`LONGITUDE`, ponto-a-ponto via `TransportMap`,
  mesmo wrapper Leaflet do módulo Sites), **solução técnica** (`SOLUCAO`:
  FTTS CAP comprada × FTTS MAKE própria × MW), **status** (`STS_END_ID`),
  **camada de rede** (`CLASSIFICACAO`), **top provedores de fibra**
  (`PROVEDOR` — quem fornece o backhaul comprado) e **rollout por ano**
  (`ANO_ROLLOUT`). Endpoints `/api/infraestrutura` (tudo `GROUP BY` no
  Oracle) e `/api/geo-points` (pontos do mapa).
- **Aba 4 (Comparação de Bases / reconciliação)**: **único** ponto do módulo
  que TOCA a Base Única. Join por `END_ID` (confirmado pelo usuário que é o
  mesmo ID nas duas) comparando a **mídia** no `REL_TX_PROFILE` (`TIPO_TX_26`,
  Fech.26) × a mídia "atual" da Base Única (`MEIO_TX_ATUAL`, no `MES_REF` mais
  recente). Mostra concordância, matriz de confusão (diagonal = bate) e as
  maiores divergências de cadastro, **+ worklist** (tabela site a site com
  END_ID/UF/município/IBGE/tipo em cada base, exportável pra Excel — a lista
  de correção). **"Não definido" (TX vazio) e "-" (Base vazio) são o MESMO
  valor: nulo.** Então vazio==vazio conta como **concordância**; divergência
  é só quando **ambas as bases têm mídia definida e diferente** (vermelho); e
  "vazio de um lado, mídia do outro" vira **falta cadastro** (cinza, KPI
  próprio — não é conflito). Invariante: `em_ambas = concordantes +
  divergentes + falta_cadastro`. Endpoints `/api/reconciliacao` +
  `/api/reconciliacao/divergencias` (`reconciliacao_sql`, `total_tx_sql`,
  `reconciliacao_divergencias_sql` em `queries.py`; `_base_media_expr`
  normaliza '-'→NULL; filtros qualificados com `t.` via
  `_filters(..., prefix="t.")`). ⚠️ **Números ainda não
  validados contra o Oracle real** (não temos a Base Única no sandbox) — a
  lógica/shape foi conferida com uma Base Única sintética; validar os totais
  no primeiro deploy. A Base Única tem 3 colunas de TX que espelham a
  `REL_TX_PROFILE` (`MEIO_TX_ATUAL`=mídia, `MEIO_TX_CAPACIDADE`=`TIPO_TX`,
  `SOLUCAO_FO`=`METODO_CONSTRUTIVO_FO`) e **não** tem coluna de fornecedor de
  rádio (por isso aquele join caiu). As outras 3 abas seguem lendo só de
  `REL_TX_PROFILE`.
- Filtro: UF + **Regional** (dimensão limpa aqui) + Município (ponte IBGE,
  igual Tráfego). Store próprio (`store/transportFilters.ts`).

### Cores por tecnologia/mídia — fonte ÚNICA (`frontend/src/theme.ts`)

Regra fechada a pedido do usuário: **toda quebra por tecnologia de rádio
(2G/3G/4G/5G) usa `techColor()`/`TECH_COLORS`** (2G `#1E88E5`, 3G
`#E53935`, 4G `#F5C518`, 5G `#7DC242`) — nunca cores locais. O módulo
Tráfego usava cores próprias (2G cinza etc.) e **foi corrigido** pra usar
o mapa canônico. Mídia de transporte (FO/MW/RS/SAT/LL/SLS) tem sua paleta
semântica própria em `TRANSPORT_COLORS` (fibra=verde, MW=âmbar,
SAT=roxo...), também fonte única.

## Convenções de backend

- **Templates SQL com placeholders**: cada query é uma string Python com
  `{uf_filter}`, `{municipio_filter}`, `{regional_filter}`,
  `{projeto_filter}` etc. `_apply_geo_all()` (em `summary/service.py`)
  introspecciona quais placeholders o template realmente tem
  (`string.Formatter().parse()`) e só injeta/bind os filtros
  correspondentes — evita `ORA-01036` (bind sobrando sem placeholder).
  **Sempre que adicionar uma query nova com filtro geo, siga esse
  padrão** em vez de montar WHERE na mão.
- **Filtros "clique na fatia"** (Venn de Presença em Cidades, combinações
  de tecnologia em Sites): a região clicada é resolvida contra um
  **whitelist dict** de cláusulas SQL fixas (`VENN_REGION_CLAUSES`,
  `R1_SITES_VENN_REGION_CLAUSES`) — nunca interpolar o valor do query
  param direto na query (risco de injeção). Só usar a cláusula se a
  chave existir no dict.
- **`parse_filters()`** (`shared/filters.py`) é o parser único de query
  params pras duas abas — cada rota usa só as chaves que fazem sentido.
- **Rateio financeiro (NEXUS)**: o denominador de qualquer proporção
  (rateio de CAPEX/OPEX, CAC) tem que vir de uma CTE **sem filtro
  geográfico** (`..._ALL`). Só o numerador/linhas exibidas usam o
  filtro. Filtrar o denominador infla artificialmente a fatia do
  filtro sobre um orçamento total fixo — bug sutil, já caímos nele.
- **Dedup de sites**: um site físico pode ter várias tecnologias ativas
  ao mesmo tempo. Contar "por tecnologia" com `SUM(CASE WHEN LIKE
  '%2G%'...)` independente por tec conta o mesmo site várias vezes.
  Duas soluções possíveis:
  - **Cascata**: cada site cai numa única tecnologia, a mais nova que ele
    tem (5G > 4G > 3G > 2G). Existiu no repo como `R1_SITES_BY_TECH`, mas
    foi removida — a única tela que a usava ("Sites Físicos EoY 26") foi
    descontinuada por combinar com uma contagem de OCs sem dedup
    confiável (ver "Problema conhecido" abaixo). Se precisar desse padrão
    de novo, reimplemente do zero.
  - **Combinação exata** (`R1_SITES_VENN`, em uso hoje): cada site cai numa das 15
    combinações não vazias de {2G,3G,4G,5G} — não perde a informação de
    sobreposição, mas precisa de 15 categorias pra mostrar.
  - **Problema conhecido sem solução ainda**: `TB_ROLLOUT_ACESSO` (base
    do Plano 26) **não tem uma coluna que identifique um site físico
    único** — `R2_SITES_BY_TECH` conta OCs (ordens de compra) por
    tecnologia, então um site novo com 4G+5G na mesma leva conta duas
    vezes num "total de sites novos". Não dá pra corrigir sem essa
    coluna (confirmado com o time de negócio). Não tente "adivinhar"
    uma coluna substituta sem confirmar antes.

## Convenções de frontend

- **`<Chart/>`** (`charts/Chart.tsx`) é o único componente que fala
  direto com ECharts (init/resize/dispose/click/tema). Nunca chame
  `echarts.init` fora dele. Comportamento embutido: em donut com número
  central (série `pie` + `title.text`, i.e. `regionalDonutOption`/
  `vendorDonutSideOption`), ligar/desligar fatia na **legenda recalcula o
  total do centro** (listener de `legendselectchanged` no próprio wrapper —
  nenhum builder precisa fazer nada pra ganhar isso).
- **`optionBuilders.ts`** é o catálogo de "moldes" de gráfico
  (`barsByTechOption`, `horizontalBarsOption`, `donutOption`,
  `stackedBarsOption`, `regionalSunburstOption`, `vendorDonutSideOption`,
  `regionalDonutOption`, `timeSeriesOption`, `gaugeOption`). Antes de
  escrever um `option` do zero, veja se um desses já serve.
- **`<ChartPanel/>`** é o card padrão (título + badge de fonte + toolbar
  de export + `<Chart/>` + skeleton de loading). Painéis que precisam de
  algo a mais que `<ChartPanel/>` não suporta (ex.: legenda customizada
  abaixo do gráfico) montam o card na mão seguindo o mesmo layout —
  ver `SitesComboChart.tsx` como referência.
- **Nenhum gráfico nasce com grade de linha** — isso é forçado
  centralizado em `theme/chartTheme.ts` (`applyChartTheme`), não em cada
  builder. Não reative `splitLine` sem um motivo específico.
- **`<SourceBadge table="..." />`** mostra de onde vem o número (tabela +
  data/mês de referência mais recente, via `/api/refs`). Todo gráfico
  novo deveria ter um.
- **Stores zustand**:
  - `useFilterStore` — filtros globais (uf/município/tecnologia/ano +
    `vennRegion` da aba Cidades). Compartilhado entre as duas abas.
  - `useResumoFocusStore` — cross-filter visual do Resumo (tecnologia é
    só destaque; regional e projeto **filtram de verdade**, refazendo a
    query, desde que a query aceite `regionais`/`projetos`).
  - Filtro "clique numa fatia" que é local a um único gráfico (ex.:
    `SitesComboChart`) usa `useState` local, não um store global — só
    vira store global se precisar propagar pra outros painéis.

## Design System (fonte da verdade visual)

**Filosofia**: dashboard executivo premium — hierarquia clara, movimento
com propósito (nunca decorativo), dado como protagonista. Bootstrap fica
como grid/base estrutural; a identidade visual vem da **camada de tokens**
em `frontend/src/styles/index.css` (topo do arquivo). Regra de ouro:
**componente não usa valor mágico** de cor/espaço/raio/sombra/duração —
consome token; se o token não existe, cria-se o token primeiro.

- **Tipografia**: `Inter Variable` self-hosted via
  `@fontsource-variable/inter` (o projeto proíbe CDN). Headings com
  `letter-spacing: -0.015em`. Números que se alinham (KPIs, tabelas,
  badges) usam `font-variant-numeric: tabular-nums` — sem "dança" de
  largura quando o valor muda. O canvas do ECharts **não herda CSS**: a
  fonte é aplicada via `CHART_FONT` no `theme/chartTheme.ts`.
- **Tokens estruturais** (globais, não variam por tema):
  - Spacing: `--space-1..7` (4/8/12/16/24/32/48px — múltiplos de 4).
  - Raios: `--radius-sm|md|lg|xl` (6/10/14/20 — chips/botões/cards/hero).
  - Sombras: `--shadow-sm|md|lg` (em camadas, sutis; no dark ficam mais
    escuras e a separação passa a ser feita por borda, não por sombra).
  - Motion: `--motion-fast|base|slow` (150/250/420ms) +
    `--ease-out` (expo-out, hover/entradas) e `--ease-in-out` (trocas de
    tema/estado). `prefers-reduced-motion` zera tudo — sempre respeitar.
- **Tokens de tema** (`--tim-*`, variam por `[data-theme]`): dark é
  **azul-tintado** (`#0b0f17`/`#131a26`), não cinza neutro — coerência com
  a marca. Cores de marca: `--brand-primary #003399`,
  `--brand-primary-deep #001a66`, `--brand-accent #42C286`.
  As cores do `chartTheme.ts` **replicam** esses valores em hex (canvas
  não lê CSS var) — mudou lá, muda cá.
- **Acessibilidade**: `:focus-visible` global com `--tim-focus-ring`
  (anel azul, visível nos dois temas). Meta AA mínimo.
- **Elevação**: todos os cards usam `.card.shadow-sm` (Bootstrap), que é
  sobrescrito centralmente pra `--shadow-md` — mudar elevação do portal
  inteiro = 1 linha.
- **Bibliotecas adotadas e recusadas** (decidido em diagnóstico):
  `@fontsource-variable/inter` ✅ (tipografia própria sem CDN);
  Tailwind/shadcn ❌ (reescrever tudo sobre outra base de estilo = risco
  de regressão sem ganho visual equivalente); trocar ECharts por
  Tremor/Recharts ❌ (perderia gauge, Venn e labels validados);
  trocar bootstrap-icons ❌ (já é um set único e consistente).
- **Motion (utilitários prontos, use estes antes de inventar)**:
  - `<CountUpNumber text="270,6" />` — anima o número "subindo" até o
    valor (efeito contador). Só numérico (nome/`—` renderiza direto);
    interpola do valor anterior no re-filtro; respeita reduced-motion.
    Já embutido no `KpiDeltaCard` — todo KPI conta sozinho. Único uso da
    lib `motion` (fica nos chunks lazy de dashboard, não na Home).
  - Classe **`.tim-reveal`** / **`.tim-page-enter`** (fade+rise) no root de
    página/dashboard — entra na navegação. **`.tim-reveal-item`** +
    `style={{ "--reveal-i": i }}` faz a grade entrar em cascata (Home).
  - Hover/press/entrada são **CSS puro** (transform/opacity, 60fps) —
    não pendurar `motion` em hover; o CSS já cobre.
- **Performance = UX**: rotas são **code-splitted** (`React.lazy` em
  `App.tsx`) — a Home carrega ~267 KB de JS; ECharts (~580 KB), Leaflet
  (~195 KB) e react-select (~89 KB) só baixam na rota que os usa. O
  fallback do `Suspense` usa o MESMO `<Skeleton/>` (shimmer) dos loadings
  de dado — transição de rota e loading parecem um sistema só. **Não
  importar ECharts/Leaflet em nada que a Home ou o shell (`Layout`,
  `Navbar`) alcancem estaticamente** — quebra o split.
- **Comandos**: `npm run dev` (Vite + proxy pro Flask) · `npm run build`
  (tsc + vite, gera `static/dist/`) · `npm run lint` (oxlint).
- **Guia de componentes (use ESTES antes de criar)**:
  - `<PageHeader>` — topo de todo módulo (breadcrumb + ícone + título +
    subtítulo + slot de ações). Não repita esse markup na mão.
  - `<KpiDeltaCard>` — card de número/entidade com ícone, `accentColor`
    (vira a barra lateral de destaque via `--kpi-accent`), valor com
    count-up automático, e badges de delta (verde/vermelho semântico).
  - `<ChartPanel>` — card padrão de gráfico (título + `<SourceBadge>` +
    toolbar de export imagem/Excel + `<Chart>` + skeleton na 1ª carga).
    Todo gráfico entra por aqui; nunca `echarts.init` fora do `<Chart>`.
  - `<SourceBadge table="..." />` — chip "de onde vem o número" (tabela +
    referência mais recente). Todo gráfico/tabela deveria ter.
  - `<Skeleton>` — placeholder shimmer; é o vocabulário único de loading
    (dado, rota, primeira carga).
  - Gráficos: montar `option` pelos builders de `charts/optionBuilders.ts`
    (catálogo) e deixar o `chartTheme` aplicar cor/fonte/grade. Não
    reescrever eixo/tooltip do zero.
  - Sub-abas de módulo: `nav nav-tabs` do Bootstrap com `<NavLink>` — o
    CSS já transforma no estilo underline do design system.
- **Convenções visuais fechadas** (não reabrir sem motivo):
  - Cards usam `.card.shadow-sm` → elevação `--shadow-md`, hover eleva.
  - KPI card: barra lateral = `accentColor`; número com `tabular-nums` +
    count-up. Tabela: cabeçalho em small-caps técnica.
  - Eixo de valor dos gráficos **sem número** (só rótulo na barra) e
    **sem gridline** — forçado central no `chartTheme`. Reativar só com
    `axisLabel:{show:true}`/`splitLine:{show:true}` explícito no builder.
- **Contribuição**: antes de estilizar na mão, procure token/classe/
  componente existente; novo padrão visual entra primeiro como token/
  classe aqui documentada, depois no componente. PRs de UI sempre com
  screenshot antes/depois (Playwright headless contra o Flask stubbado).

## Fontes de dados Oracle

| Tabela/View | Uso | Observações |
|---|---|---|
| `NTW_OP.MUNICIPIOS_FECHAMENTO` | Presença 2G/3G/4G/5G por município (aba Cidades), Cidades por Regional | Sempre filtrar `TRUNC(DT_CARGA) = MAX(DT_CARGA)` — carga histórica, não só o último dia |
| `NTW_OP.TB_FT_BASE_UNICA_SITES` | Sites físicos por tecnologia (Raia 1, aba Sites) | **Recorte de `MES_REF` depende da tela**: a **aba Sites** usa `MES_REF = MAX(MES_REF)` (inventário atual, sempre o mais recente); a **raia Fechamento 25 do Resumo** usa o **fechamento de dezembro do ano anterior ao plano** (`TRUNC(MES_REF,'MM') = TRUNC(:baseline_date,'MM')`, com `baseline_date = 31/dez/ano-1`) — é um fechamento histórico, não o load mais novo. Pra bater com o Power BI antigo: `TIPO_SITE <> 'ROAMING VIVO'`, `MOBILE_SITE = 'SIM'`, `TECNOLOGIA <> '-'`. Coluna `TECNOLOGIA` vem como string tipo `"2G/3G/4G"` — usa `LIKE '%2G%'` pra testar presença. Também tem `END_ID` (site único), `IBGE` (join exato com `MUNICIPIOS_FECHAMENTO`, preferir a UF+MUNICIPIO por string), `STATUS_END_ID` (ex.: `'ATIVADO'`), `FLAG_TX_PROFILE_ENG` (perfil de transmissão configurado), `LATITUDE`/`LONGITUDE` (coordenada do site, confirmadas — usadas em `SITES_GEO_POINTS`) e, segundo o usuário, coluna(s) de fornecedor por tecnologia (nome exato ainda não confirmado) |
| `NTW_MABE.BASE_TB_END_ID_NEW` | Fornecedor (vendor) dominante por site | Cascata de colunas `VENDOR_NR_*`/`VENDOR_LTE_*`/`VENDOR_UMTS_*`/`VENDOR_GSM_*` via `COALESCE`, maior banda primeiro dentro de cada tec |
| `NTW_OP.TB_ROLLOUT_ACESSO` | Plano de rollout (Raia 2), OCs | Sem coluna de site físico único (ver acima). `PLANO` = ano, `STATUS_OC='ACTIVATED'`, `CLASSIFICACAO_CASA` distingue Casa Nova (`NEW SITE`/`CO SITE CASA NOVA`) de Casa Existente. **Grão = OC, não endereço**: a mesma Casa Nova gera 2+ OCs (4G e 5G separadas) — contagens de "sites/endereços" devem deduplicar por `(COD_IBGE, ID_MASTER_PIVOT)` (`COUNT(DISTINCT ...)` em `R2_VENDORS_NEW_SITES`; era `COUNT(*)` e inflava 2171 vs ~1000 reais, pego cruzando com a meta do `TB_NEXUS_CN_CE`) |
| `NTW_OP.REL_CIDADES_PLANEJADO_26` | Novas Cidades por Regional (Raia 2 — "Novas Cidades por Regional") | Lista **fechada** das cidades novas do plano 26: 1 linha por `IBGE` (`REGIONAL, UF, ANF, MUNICIPIO, IBGE`), sem `MES_REF`/`DT_CARGA` — `GROUP BY REGIONAL, COUNT(*)` direto, sem recorte de data. Município filtra via ponte IBGE (`_build_municipio_ibge_clause`), não por nome direto — evita mismatch de acentuação com o autocomplete (que busca em `MUNICIPIOS_FECHAMENTO`). Antes esse gráfico usava `MUNICIPIOS_FECHAMENTO` com `MES_DIV_5G` (fechamento/realizado) — trocado porque misturava a raia de Plano com dado já realizado. |
| `TB_NEXUS_FINANCEIRO` | CAPEX/OPEX/LEASE por tipo | Usada só no rateio "Orçamento por Tecnologia" — sem schema/join direto, rateada por nº de OCs |
| `TB_NEXUS_CN_CE` | CAC por tech/tipo de casa; também é a **meta de Casa Nova** | Rateio "Endereço por Tecnologia" (CN x CE). Na leitura de meta, `CAC` com `TIPO_CASA='CN'` é a **contagem-meta de endereços novos** (4G 755 + 5G 245 = 1000) — fonte do toggle "Meta NEXUS" no donut Fornecedores EoY 26 (`/api/summary/r2/casa-nova-nexus`). É **nacional** (sem UF/regional) — não responde aos filtros, e o subtítulo do card avisa. |
| `VW_CAPEX_MASTER_FULL@NEXUS_LINK` | **Mapeada, ainda não integrada** — ver abaixo | Acesso via DB link `NEXUS_LINK` |
| `REL_TRAFEGO_CIDADES_WIDE` | Tráfego **planejado** (módulo Tráfego) | 1 linha por (município, `TIPO_TRAF`), 12 meses em COLUNAS (`JANEIRO`..`DEZEMBRO`), `ANO`. `TIPO_TRAF='Consolidado'` é o total (NÃO somar as camadas). Valores em **PB**. `MUNICIPIO_ID`=IBGE 6 díg. Versão `REL_TRAFEGO_CIDADES_LONG` tem os meses em linha |
| `REL_DS013_TRAFEGO_REALIZADO` | Tráfego **realizado** + base de usuários (módulo Tráfego) | 1 linha por (município, `OPERADORA`), snapshot mensal (`DT_REFERENCIA`). Traz TIM e OI → market share. `S_MEGABYTE_TOTAL` em MB (÷1e9 = PB); colunas por tec aditivas |
| ~~`NTW_MABE.ALTAIA_PM_MES_4G/5G`~~ | ~~Volumetria RAN (módulo Core)~~ | **Descontinuada** — o módulo Core foi removido e substituído pelo módulo Tráfego quando a fonte mudou |

### `VW_CAPEX_MASTER_FULL@NEXUS_LINK` (mapeada, uso futuro)

View de CAPEX/orçamento consolidado do NEXUS, acessada via database link
(não é uma tabela local — não precisa de schema prefix tipo `NTW_OP.`).
É essencialmente **`TB_NEXUS_CN_CE` aberta por `SOURCE_AJUSTADO`
(TIM/B2B Mobile), sem `IBGE`** — mesma família de dado do rateio
"Endereço por Tecnologia" (`R2_ENDERECO_POR_TECNOLOGIA`), com uma
dimensão de segmento a mais e uma camada tecnológica a mais.

Query de referência, já com as decisões de negócio confirmadas pelo
usuário aplicadas:

```sql
SELECT
    DLV_LEVEL_1 AS LAYERS,
    SOURCE_AJUSTADO,
    DLV_LEVEL_2 AS PROJETO,
    DLV_LEVEL_3 AS TIPO_CASA,
    SUM(KPI)
FROM VW_CAPEX_MASTER_FULL@NEXUS_LINK
WHERE SCENARIO = '2026 CAC (26-28) V02'
  AND PRIORIDADE = 'IMPRESCINDÍVEL'
  AND LAYER_SUBAREA = 'MOBILE ACCESS'
  AND DLV_LEVEL_1 IN ('5G LAYERS', '4G LAYERS', '4G/5G LAYERS')
  AND DLV_LEVEL_2 <> 'ACORDO VIVO'
  AND DLV_LEVEL_3 <> 'RAN SHARING'
  AND DLV_LEVEL_3 <> 'DROP'
  AND SOURCE_AJUSTADO IN ('TIM', 'B2B MOBILE')
GROUP BY DLV_LEVEL_1, SOURCE_AJUSTADO, DLV_LEVEL_2, DLV_LEVEL_3
ORDER BY SOURCE_AJUSTADO DESC, DLV_LEVEL_1 DESC
```

**Decisões de negócio já confirmadas pelo usuário** (não re-perguntar):

- `DLV_LEVEL_1` (`LAYERS`) fica com **3 baldes distintos, sem fundir**:
  `5G LAYERS`, `4G LAYERS`, `4G/5G LAYERS`. O combinado (`4G/5G LAYERS`)
  **não** deve ser somado dentro de `5G` nem de `4G` — é uma categoria
  própria.
- `5G B2C LAYERS` foi **removido do escopo** (tirado do `IN (...)`) — não
  faz parte do rateio deste módulo.
- `SOURCE_AJUSTADO`: **B2B Mobile não deve ser excluído** — o rateio
  inclui TIM e B2B Mobile juntos (`IN ('TIM', 'B2B MOBILE')` mantido).
- `DLV_LEVEL_2` (`PROJETO`): **os nomes nunca batem** com
  `TB_ROLLOUT_ACESSO.PRIORIDADE` (confirmado pelo usuário) — a ideia de
  ratear por projeto real fica descartada. `DLV_LEVEL_2` deve ser tratado
  como não-join-ável; ao consumir esta base, **agregar (somar) por cima
  dela** em vez de manter como dimensão de saída (ou seja, o `GROUP BY`
  efetivo pra qualquer query nova deveria ser só
  `DLV_LEVEL_1, SOURCE_AJUSTADO, DLV_LEVEL_3`, descartando `DLV_LEVEL_2`
  depois do filtro `<> 'ACORDO VIVO'`).

**Escopo TIM×B2B em `TB_ROLLOUT_ACESSO` — resolvido pelo usuário**: os
registros de B2B Mobile **estão** em `TB_ROLLOUT_ACESSO`, identificados
por `PRIORIDADE = 'B2B MOBILE'`. Ou seja, a coluna `PRIORIDADE` é
**sobrecarregada** — pra maioria das linhas ela é o nome do projeto
(o que alimenta "Top 10 Projetos"), mas pra linhas de B2B Mobile ela
carrega o valor fixo `'B2B MOBILE'` no lugar de um nome de projeto. Isso
resolve o bloqueador do rateio: o numerador (OCs) pode ser separado por
`SOURCE_AJUSTADO` via `CASE WHEN R.PRIORIDADE = 'B2B MOBILE' THEN
'B2B MOBILE' ELSE 'TIM' END`, casando com os dois valores de
`SOURCE_AJUSTADO` na view.

**Inconsistência corrigida**: `R2_TOP_PROJECTS` (usada por "Top 10
Projetos" em Raia 2 e Raia 3, via `get_r3_top_projects` que só chama
`get_r2_top_projects`) misturava `PRIORIDADE = 'B2B MOBILE'` (marcador
de segmento, não nome de projeto) no ranking de projetos. Corrigido com
`AND r.PRIORIDADE <> 'B2B MOBILE'` no WHERE — "Top 10 Projetos" agora só
mostra nomes de projeto de verdade.

**Ainda em aberto / bloqueadores restantes antes de integrar**:
1. Valores distintos reais de `DLV_LEVEL_1` e `DLV_LEVEL_3` (um `SELECT
   DISTINCT` resolve) — pra confirmar que os 3 valores de `LAYERS`
   batem exatamente com essas strings e que `TIPO_CASA` mapeia pra
   CN/CE sem surpresa.
2. Se "Top 10 Projetos" deve excluir `PRIORIDADE = 'B2B MOBILE'` (ver
   inconsistência acima).
3. Unidade de `KPI` (R$ / R$ milhões / outra).
4. Se `SCENARIO = '2026 CAC (26-28) V02'` deve ficar fixo no código ou
   virar filtro (nome de cenário parece mudar por ciclo de
   planejamento).

Quando for integrar, comece confirmando esses pontos em vez de assumir
— o rateio financeiro é a área do projeto onde já erramos antes (rateio
com denominador filtrado por engano), então mais vale perguntar de novo.

## Questões em aberto (não resolvidas ainda)

- ~~Filtro de município não parece filtrar~~ **RESOLVIDO**: a causa raiz
  era exatamente o descasamento de nome suspeitado antes — várias queries
  filtravam `MUNICIPIO` (texto) direto contra a própria coluna de
  `TB_FT_BASE_UNICA_SITES`/`NTW_MABE.BASE_TB_END_ID_NEW`, em vez de
  resolver o nome via `MUNICIPIOS_FECHAMENTO` (que é de onde vem a busca
  do autocomplete do filtro). Corrigido em toda a aba Sites e em
  "Total de Sites por Tecnologia"/"Fornecedor por Site" (Resumo Raia 1)
  resolvendo o(s) nome(s) de município pro `IBGE` via
  `MUNICIPIOS_FECHAMENTO` antes de filtrar (`_build_municipio_ibge_clause`
  em `sites/service.py` e `summary/service.py`); pra
  `BASE_TB_END_ID_NEW`, que não tem `IBGE` próprio, a ponte é feita por
  `END_ID` via `TB_FT_BASE_UNICA_SITES`
  (`_build_municipio_end_id_clause`). UF não precisou do mesmo tratamento
  (sigla de 2 letras não tem a mesma variação de acentuação/grafia).

## Git / PRs

- O usuário mergeia PRs rapidamente, às vezes no meio de uma sessão.
  **Sempre `git fetch origin main` e comparar com `HEAD` antes de
  commitar** — se o PR anterior já foi mergeado (`git merge-base HEAD
  origin/main` == `HEAD` atual), faça `git merge --ff-only origin/main`
  pra avançar o branch sem duplicar histórico, só então commite o
  trabalho novo em cima.
- PRs são sempre criados como **draft**.
- Rodar `npm run build` + `python3 -m py_compile` nos arquivos tocados
  **depois** do fast-forward também, não só antes — o merge pode trazer
  mudanças que quebram algo.
