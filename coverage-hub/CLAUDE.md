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
- **Frontend**: React + TypeScript + Vite, em `frontend/` (dentro do
  projeto Flask, não um repo irmão). Build gera `static/dist/`, servido
  pelo Flask. Sem CDN, sem Docker — tudo local/instalado via npm.
- **Banco**: Oracle via `oracledb` (thin mode), pool de conexões em
  `database/oracle.py`. Credenciais via `.env` (`config/settings.py`).
- Rodar frontend: `cd frontend && npm run build` (gera `static/dist/`).
  Não existe servidor Oracle real neste ambiente de sandbox — testes
  ponta a ponta usam um `execute_query` mockado (stub) + Playwright
  contra o Flask local. Sempre valide `python3 -m py_compile` nos
  arquivos backend alterados e `npm run build` no frontend antes de
  considerar uma tarefa concluída.

## Estrutura de módulos

```
modules/
  core/            — endpoint /api/modules (lista de módulos p/ Home)
  mobile_access/   — único módulo funcional hoje
    actual/        — aba "Cidades" (rede hoje, MUNICIPIOS_FECHAMENTO)
    summary/       — aba "Resumo" (raias R1/R2/R3)
    shared/        — filtros, constantes, refs (fonte + data mais recente)
  budget/, executive/, transport/  — módulos placeholder, __init__.py
    vazio, listados em config/modules.py com enabled=False (aparecem
    como "Em breve" na Home). Não é código morto — é intencional.
```

Frontend espelha isso em `frontend/src/dashboards/` (`CidadesDashboard`,
`ResumoDashboard` com `resumo/Raia1.tsx`, `Raia2.tsx`, `Raia3.tsx`).

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
  `echarts.init` fora dele.
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

## Fontes de dados Oracle

| Tabela/View | Uso | Observações |
|---|---|---|
| `NTW_OP.MUNICIPIOS_FECHAMENTO` | Presença 2G/3G/4G/5G por município (aba Cidades), Cidades por Regional | Sempre filtrar `TRUNC(DT_CARGA) = MAX(DT_CARGA)` — carga histórica, não só o último dia |
| `NTW_OP.TB_FT_BASE_UNICA_SITES` | Sites físicos por tecnologia (Raia 1) | Filtrar `MES_REF = MAX(MES_REF)`. Pra bater com o Power BI antigo: `TIPO_SITE <> 'ROAMING VIVO'`, `MOBILE_SITE = 'SIM'`, `TECNOLOGIA <> '-'`. Coluna `TECNOLOGIA` vem como string tipo `"2G/3G/4G"` — usa `LIKE '%2G%'` pra testar presença |
| `NTW_MABE.BASE_TB_END_ID_NEW` | Fornecedor (vendor) dominante por site | Cascata de colunas `VENDOR_NR_*`/`VENDOR_LTE_*`/`VENDOR_UMTS_*`/`VENDOR_GSM_*` via `COALESCE`, maior banda primeiro dentro de cada tec |
| `NTW_OP.TB_ROLLOUT_ACESSO` | Plano de rollout (Raia 2), OCs | Sem coluna de site físico único (ver acima). `PLANO` = ano, `STATUS_OC='ACTIVATED'`, `CLASSIFICACAO_CASA` distingue Casa Nova (`NEW SITE`/`CO SITE CASA NOVA`) de Casa Existente |
| `TB_NEXUS_FINANCEIRO` | CAPEX/OPEX/LEASE por tipo | Usada só no rateio "Orçamento por Tecnologia" — sem schema/join direto, rateada por nº de OCs |
| `TB_NEXUS_CN_CE` | CAC (custo de aquisição) por tech/tipo de casa | Rateio "Endereço por Tecnologia" (CN x CE) |
| `VW_CAPEX_MASTER_FULL@NEXUS_LINK` | **Mapeada, ainda não integrada** — ver abaixo | Acesso via DB link `NEXUS_LINK` |

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

- **Filtro de município não parece filtrar** "Total de Sites por
  Tecnologia" e "Novas Cidades por Regional" segundo o usuário — auditoria
  de código (ver histórico de conversa) confirmou que a cláusula SQL é
  gerada corretamente nos dois casos; suspeita não confirmada é
  descasamento de nome de município entre `TB_FT_BASE_UNICA_SITES` e
  `MUNICIPIOS_FECHAMENTO` (tabelas diferentes, strings podem não bater
  exatamente). Não há acesso a Oracle real neste ambiente pra confirmar
  — precisa de teste do usuário em produção ou acesso a uma amostra dos
  dados reais.

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
