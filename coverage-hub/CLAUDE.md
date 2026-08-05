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
- **`package-lock.json` NÃO é versionado** (decisão do usuário, jul/26 —
  já constava no `.gitignore` desde antes; o arquivo só continuava
  aparecendo porque estava rastreado, e `.gitignore` não afeta arquivo
  já rastreado). Consequências práticas, pra ninguém se assustar depois:
  - As versões das libs do front são resolvidas **na hora do
    `npm install`**, dentro dos ranges do `package.json` (`^10.1.0`
    etc.) — dois deploys em datas diferentes podem trazer patches
    diferentes. Por isso o `npm run build` **depois** do deploy não é
    formalidade: é o que pega uma regressão vinda de dependência.
  - **`npm ci` não funciona sem lockfile** (ele exige o arquivo). Hoje
    nada usa `npm ci` no projeto — se um dia entrar CI/CD de verdade,
    essa decisão precisa ser reavaliada junto.
  - Se o motivo de tirar tivesse sido só ruído de diff, a alternativa
    era manter versionado + `.gitattributes` com
    `package-lock.json linguist-generated=true -diff` (colapsa nos PRs
    sem perder reprodutibilidade). Fica registrado como a saída caso a
    decisão seja revista.

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
  transport/       — módulo de negócio "Transporte" (backhaul/fibra, ver
                     seção própria abaixo). Prefixo /transport.
  mobile_access/   — módulo "Acesso Móvel"
    actual/        — aba "Cidades" (rede hoje, MUNICIPIOS_FECHAMENTO)
    summary/       — aba "Resumo" (raias R1/R2/R3)
    sites/         — aba "Sites" (inventário de sites físicos,
                     TB_FT_BASE_UNICA_SITES — ver seção própria abaixo)
    assistant/     — aba "Assistente" (chat de IA efêmero com streaming
                     SSE sobre o agente google-adk/Vertex AI em `agent/`
                     — ver seção própria)
    shared/        — filtros, constantes, refs (fonte + data mais recente)
```

`orcamento` (chave em `config/modules.py`, `enabled=False`) é o único
módulo placeholder que resta hoje — aparece só como "Em breve" na Home,
sem diretório próprio em `modules/` ainda. Não é código morto — é
intencional.

Frontend espelha isso em `frontend/src/dashboards/` (`CidadesDashboard`,
`ResumoDashboard` com `resumo/Raia1.tsx`, `Raia2.tsx`, `Raia3.tsx`,
`SitesDashboard`, `AssistantDashboard`, `TrafegoResumoExecutivo`,
`TrafegoYtd`, `TransporteResumoExecutivo`, `TransporteComposicao`,
`TransporteInfraestrutura`, `TransporteReconciliacao`).

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
  primeiro dentro de cada tec. O join é feito **dentro do universo de
  sites já filtrado** desta aba (`BASE` da `SITES_BASE_CTE`), não como
  query independente — garante que o total do donut de fornecedor bate
  com o total das outras visões da mesma tela (confirmado: 45.230 nos
  dois, testado com stub). Sem `FillDown` (a lógica frágil do Power
  Query original não foi replicada) — site sem match vira "NÃO INFORMADO".
  **`R1_VENDORS` (Resumo) segue o MESMO princípio** — corrigido depois
  de o usuário achar 29.228 (Venn) × 29.195 (fornecedor): a query
  antiga montava o fornecedor primeiro (`BASE_TB_END_ID_NEW`) e só
  então fazia `JOIN` (inner) com o universo de sites — um site do
  universo sem fornecedor identificado em NENHUMA cascata (5G/4G/3G/2G
  todas NULL) sumia do resultado inteiro em vez de virar "NÃO INFORMADO".
  Corrigido invertendo a direção: `SITE_UNIVERSE` (de
  `TB_FT_BASE_UNICA_SITES`) **LEFT JOIN** pro fornecedor, nunca o
  contrário — mesma regra vale pra qualquer query nova de fornecedor
  por site: sempre dirigir pelo universo de sites, nunca pela tabela
  de fornecedor.
  **Achado adicional confirmado via query no DBeaver**: algumas colunas
  `VENDOR_*` guardam string vazia/só espaço (`' '`) em vez de `NULL` —
  isso "vencia" a cascata `COALESCE` e escondia o fornecedor real de uma
  banda menor, além de criar uma fatia de rótulo em branco separada de
  "NÃO INFORMADO" no donut. Toda coluna `VENDOR_*` usada em cascata
  (`R1_VENDORS` e `SITES_VENDORS`) agora passa por
  `NULLIF(TRIM(col), '')` antes do `COALESCE` — trata vazio/espaço como
  "sem valor" em pé de igualdade com `NULL`. Não reintroduzir um
  `COALESCE` "cru" (sem `NULLIF(TRIM(...))`) numa cascata de fornecedor
  nova.

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

"Sites" hoje tem as 7 visões completas: max-tech, por-tecnologia,
composição de sites (árvore), fornecedor dominante, tipo de site, mapa
(Brasil/Múndi, tiles Leaflet) e pivot.

- **Composição de Sites** (`SITES_HIERARCHY` em `sites/queries.py` +
  `get_sites_hierarchy` em `sites/service.py` + rota
  `/api/sites/hierarchy`): mesma árvore/hierarquia da Raia 1 do Resumo
  (`R1_SITES_HIERARCHY`/`get_r1_sites_hierarchy`, `summary/`) e mesmo
  builder de frontend (`siteHierarchyTreeOption`), mas no recorte **desta
  aba** — `MES_REF = MAX(MES_REF)` (inventário mais recente), não o
  fechamento congelado de dezembro do ano anterior. Por isso o total
  dessa árvore normalmente **não bate** com o da Raia 1 — é esperado
  (rede cresce entre o fechamento e hoje), não é bug. As 5 categorias-
  folha vêm do SQL, as intermediárias são somadas em Python no service
  (nunca em SQL), garantindo que a árvore sempre fecha por construção.

## Aba Assistente (`modules/mobile_access/assistant/`) — chat de IA efêmero

Chat estilo ChatGPT/Claude dentro de Acesso Móvel, sobre o agente de IA
`agent/` (pacote na raiz do projeto, não dentro de `modules/`) — feito
originalmente por um colega, usando **google-adk** (Agent Development
Kit) contra **Vertex AI** (não a API Gemini direta). As credenciais
(`GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`,
`GOOGLE_CLOUD_LOCATION`) são lidas direto pelo SDK a partir do `.env`,
mesmo padrão do `GOOGLE_APPLICATION_CREDENTIALS` do BigQuery — não
passam por `config/settings.py`.

- **Efêmero de propósito** (pedido explícito do usuário): `session_id`
  é gerado no `AssistantChat.tsx` via `crypto.randomUUID()` num
  `useState` inicial — **sem `localStorage`** — e casado com um
  `google.adk.sessions.InMemorySessionService` no backend
  (`assistant/service.py`). Sem tabela nova, sem persistência: recarregar
  a página ou reiniciar o processo Flask zera o histórico dos dois
  lados. Trade-off conhecido e aceito (baixo tráfego/uso interno): um
  deploy com múltiplos workers gunicorn não compartilha essa memória
  entre processos — sem sticky sessions, uma pergunta pode cair num
  worker que não tem a sessão do turno anterior.
- **Streaming via SSE (v2)**: `POST /mobile-access/api/assistant/chat`
  responde `text/event-stream` — um `data: {"delta": "..."}` por pedaço
  de texto gerado, `{"erro": "..."}` em falha, e `{"fim": true}`
  fechando o turno. `service.responder_stream()` é um gerador
  **síncrono** que roda o `Runner` (async, com
  `RunConfig(streaming_mode=StreamingMode.SSE)`) num event loop próprio
  por request — o resto do projeto continua 100% síncrono, sem view
  assíncrona nem worker especial no gunicorn.
  - **Evento parcial × final**: com SSE o Runner emite os parciais
    (`evento.partial`) com os deltas E, no fim, um evento final com o
    texto **agregado** do trecho. Emitir os dois duplica a resposta
    inteira — por isso `_deltas_async` só manda, no final, o que ainda
    não saiu como delta (e o texto todo quando não houve streaming
    nenhum, que é o que acontece logo depois de uma chamada de
    ferramenta). Não simplificar isso pra "yield de tudo".
  - **Degrada sozinho**: se por qualquer motivo não houver streaming de
    verdade (proxy bufferizando, resposta fechada de uma vez), vira um
    único delta com o texto inteiro e a UI funciona igual — o front só
    concatena deltas.
  - `X-Accel-Buffering: no` no header porque o nginx bufferiza resposta
    de proxy por padrão e seguraria o stream até o fim, matando o efeito.
  - ⚠️ **A rota sempre responde HTTP 200**, mesmo em erro — o corpo já se
    autodescreve pela chave presente, e num stream o status já foi
    resolvido antes do primeiro delta, então status de erro não chega
    de forma útil no front. Não reintroduzir 4xx aqui sem ajustar o
    consumo no frontend.
  - O `streamPergunta()` (`api/assistant.ts`) **não** usa `fetchJson`
    (que faria `response.json()` do corpo inteiro): lê o corpo
    incrementalmente com `getReader()`, senão não existe streaming.
- **Base de municípios do agente migrada de Excel pro Oracle**
  (`agent/excel_municipios.py` — nome do arquivo mantido por histórico,
  não lê mais Excel): a versão original do colega lia duas planilhas
  (`Municípios TIM Brasil_Fechamento.xlsx` e a de plano nominal 5G 2027)
  de um caminho OneDrive do Windows, inviável no servidor Linux de
  produção. Confirmado pelo usuário que as mesmas informações vêm de
  **`NTW_OP.MUNICIPIOS_FECHAMENTO`** (fechamento — a planilha era
  carregada a partir dela) e **`NTW_OP.REL_CIDADES_PLANEJADO_26`**
  (plano de lançamento 5G — ver tabela de fontes Oracle abaixo). A
  ferramenta do agente que roda SQL sobre os municípios
  (`executar_sql_municipios`) continua funcionando sobre um `DataFrame`
  cacheado em memória (não bate no Oracle a cada pergunta), só a origem
  do carregamento mudou.
  - **Presença por tecnologia recalculada nas 4 techs** (2G/3G/4G/5G),
    reaproveitando a MESMA regra já validada em `actual/queries.py`
    (`MES_DIV_XG <= TRUNC(SYSDATE)`, nunca a flag `PRESENCA_XG` crua, que
    vira `true` no rollout, antes da divulgação pública real) — a
    versão original do colega só aplicava esse ajuste em 5G (via o
    overlay do plano), deixando 2G/3G/4G expostos ao mesmo problema que
    já tínhamos corrigido em Cidades/Resumo.
  - `DEFAULT_PLAN_YEAR` (`shared/constants.py`) é reusado como o "ano do
    plano" em vez de literal solto — mesma fonte de verdade que o resto
    do módulo já usa.
- **Sandbox de SQL do agente endurecido**: `executar_sql_municipios` roda
  a query gerada pela LLM contra uma tabela DuckDB (`municipios`) criada
  a partir do DataFrame — nunca contra a conexão Oracle real. Além do
  blocklist de palavras já existente (INSERT/UPDATE/DELETE/DROP/ALTER/
  CREATE/TRUNCATE/MERGE/GRANT/REVOKE/REPLACE), a conexão agora abre com
  `duckdb.connect(":memory:", config={"enable_external_access": False})`
  — sem isso, funções table-valued do próprio DuckDB (`read_csv_auto`,
  `httpfs` etc.) conseguiam ler arquivo/rede arbitrários do servidor
  (`read_csv_auto('/etc/passwd')` funcionava antes da correção,
  verificado com um teste isolado), driblando o blocklist por não serem
  um comando SQL de escrita.
- **Frontend** — `components/assistant/` (`AssistantChat` monta o layout,
  `ChatMessage`, `ChatComposer`, `ChatEmptyState`, `ChatMarkdown`) +
  `hooks/useAssistantChat.ts` (estado da conversa e streaming, separado
  da UI). Resposta renderizada com `react-markdown` + `remark-gfm`
  (tabelas e blocos de SQL que o agente devolve); textarea que cresce
  com `react-textarea-autosize`.
  **Três regras de layout que sustentam a tela — não quebrar** (as três
  são o conserto do "chat estourando a tela / UI espalhada" da v1):
  1. **Card de altura fixa, só a lista rola.** Toda a cadeia flex
     (`.tim-assistant` > `.tim-assistant-messages`) precisa de
     `min-height: 0`: em flex column o padrão é `min-height: auto`, que
     impede o item de encolher abaixo do conteúdo — aí o
     `overflow-y: auto` **nunca ativa** e a lista vaza pra fora do card,
     empurrando o composer pra fora da tela. Esse era o bug.
  2. **Coluna de leitura de ~50rem centralizada** (`.tim-assistant-thread`
     e `.tim-assistant-composer-inner`). Sem isso, em monitor wide a
     linha de texto passa de 1000px e a leitura sofre.
  3. **Assimetria proposital**: pergunta = bolha compacta à direita;
     resposta = bloco de documento **sem bolha**, com avatar à esquerda
     (mesmo idioma de ChatGPT/Claude). Tabela de 20 linhas dentro de um
     balão cinza arredondado é o que deixava a tela "esquisita".
     Tabela sempre dentro de `.tim-assistant-tablewrap`
     (`overflow-x: auto`), pra não empurrar a página.
- **Parar/abortar**: enquanto gera, o botão de enviar vira "parar"
  (`AbortController`). Abort é ação do usuário, não erro — mantém o
  texto que já chegou em vez de trocar por mensagem de falha.
- **Auto-scroll só se o usuário está no fim da lista** (`grudadoNoFimRef`,
  margem de 80px): se ele rolou pra cima pra reler algo, o texto
  chegando não pode arrastar a tela de volta.
- **Autenticação (pegadinha que já custou uma tarde)**: as três variáveis
  do `.env` (`GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`,
  `GOOGLE_CLOUD_LOCATION`) só dizem "fale com o Vertex AI, nesse
  projeto/região" — **não autenticam nada**. Autenticação é ADC
  (Application Default Credentials), via `GOOGLE_APPLICATION_CREDENTIALS`
  apontando pro JSON (service account ou `gcloud auth
  application-default login`), guardado **fora do repo** (ex.:
  `/etc/secrets/…`, `chmod 600`). Sintomas e causas já mapeados:
  - `DefaultCredentialsError: Your default credentials were not found`
    → `GOOGLE_APPLICATION_CREDENTIALS` vazia/errada. Lembrar que
    variável de ambiente só é lida **na subida do processo** — editar o
    `.env` com o Flask no ar não tem efeito até reiniciar (F5 no
    navegador não reinicia nada).
  - `UserWarning: authenticated using end user credentials … without a
    quota project` → o JSON é de login de usuário (`gcloud auth …`), não
    de service account. Funciona, mas pode dar "quota exceeded"/"API not
    enabled"; o certo pra servidor é service account com o papel
    **Vertex AI User** (`roles/aiplatform.user`).
  - `TransportError: … oauth2.googleapis.com … Read timed out` → **rede,
    não credencial**. O servidor sai por proxy corporativo
    (`HTTP_PROXY`/`HTTPS_PROXY`) e o proxy precisa liberar
    **`oauth2.googleapis.com`** além de `aiplatform.googleapis.com` —
    toda chamada autenticada ao GCP troca a credencial por token nesse
    domínio. Sem saída direta pra internet, não há contorno pelo lado da
    aplicação; é liberação de allowlist no proxy.
- **Dependências novas** (`requirements.txt`): `google-adk`, `duckdb`,
  `requests` + `lxml` (scraping de Teleco/notícias, ferramentas do
  agente que buscam contexto de mercado/concorrência — bloqueado neste
  sandbox de dev por política de rede, mesma classe de bloqueio de
  `tile.openstreetmap.org`; funciona na rede real de produção) e
  `tabulate` (usado por `DataFrame.to_markdown()` na formatação de
  resultado do agente).

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
    somados → série mensal nacional pela linha Consolidado + split por
    camada), `PLANEJADO_POR_UF` (`GROUP BY ESTADO`, só Consolidado → usado
    só pelo YTD, ver abaixo) e `PLANEJADO_TOP_MUNICIPIOS` (`SUM(DEZEMBRO)`
    — só o mês de corte, não os 12 meses — `ORDER BY ... WHERE ROWNUM <=
    15` → top 15). Assume que as colunas de mês são `NUMBER` (fazemos
    `SUM` direto); se vierem `VARCHAR`, envolver em `TO_NUMBER`.
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
  - **⚠️ REGRA FECHADA (pedido explícito do usuário): tráfego é métrica
    MENSAL — NUNCA somar múltiplos meses num KPI/ranking/split.** Todo
    número do **Resumo Executivo** (as 3 raias) usa a volumetria de UM
    único "mês de corte", nunca uma soma/acumulado:
    - **R1 Fechamento 2025** → corte = **dezembro/2025** (`mes=12` em
      `_rz_municipio_rows`). `trafego_pb`, `por_tecnologia` e
      `ranking_municipios` são TODOS só de dezembro — não do ano inteiro.
    - **R2 Plano 26** → corte = **dezembro/2026**, sempre (o plano é
      conhecido pro ano inteiro). `trafego_planejado_pb` lê
      `plan_mensal[11]` (índice de dezembro), não `sum(plan_mensal)`.
      `por_camada` idem (`_mes_cols(r)[11]`, não `sum(_mes_cols(r))`).
      `ranking_municipios` vem de `PLANEJADO_TOP_MUNICIPIOS`, que já
      seleciona só `SUM(DEZEMBRO)` no Oracle.
    - **R3 Fechamento 26** → corte = `mes_max` (o mês mais recente com
      realizado — ainda descoberto via `_rz_mes_totais`/`max()`, isso não
      mudou). `trafego_mes_pb` e `planejado_mes_pb` são o valor **daquele
      mês exato** (`_rz_municipio_rows(..., mes=mes_max)`, filtro
      `EXTRACT(MONTH...) = :mes`, não mais `<= :mes_max`), nunca a soma
      Jan..mes_max. **Aderência** = realizado ÷ planejado do MESMO mês.
      **Crescimento YoY** = mesmo mês em 2026 vs o mesmo mês em 2025
      (`rz25_mes.get(mes_max)`), não YTD-vs-YTD acumulado.
    - **Removido**: "Projeção Fim de Ano" (`projecao_ano_pb`) e
      "Atingimento do Plano" (`atingimento_plano_pct`) — eram um run-rate
      anualizado (`realizado_ytd / mes_max × 12`), ou seja, a própria
      "soma do ano" que o usuário pediu pra eliminar. Não reintroduzir sem
      pedido explícito.
    - **Exceção deliberada — a "Curva Mensal" continua com os 12 meses**:
      cada ponto da série (`serie_mensal`/`_plan_meses_consolidado`) JÁ é a
      volumetria do próprio mês (não é cumulativo), então já respeita a
      regra — só o corte dos KPIs/rankings/donuts é que mudou.
    - **A aba separada "Tráfego YTD" (`get_ytd`/`TrafegoYtd.tsx`) NÃO foi
      alterada** — continua uma visão de acumulado Jan..mês corrente
      (`_rz_municipio_rows_acumulado`, `PLANEJADO_POR_UF`), propositalmente
      diferente do Resumo Executivo. Se o usuário pedir a mesma regra lá,
      é decisão nova — não assumir.
  - **Mix 5G** = % do tráfego (do mês de corte) que já é 5G
    (`_mix_5g_pct`) — leitura de modernização.
- **Visual (Resumo Executivo)**: 3 raias com o MESMO destaque de cor do
  Resumo do Acesso Móvel — **R1 Fechamento 2025 = `#003399` (azul)**,
  **R2 Plano 26 = `#F5C518` (amarelo)**, **R3 Fechamento 26 = `#7DC242`
  (verde)** — via as classes `.summary-raia`/`.raia-badge`. A curva mensal
  do Plano 26 traz **duas linhas** (planejado tracejado + realizado sólido
  acompanhando **até o mês corrente**, depois `null` pra a linha parar —
  `trafficPlanVsRealOption`, `connectNulls:false`) e ocupa a linha **inteira**
  (`col-12`) — o card "Tráfego Planejado 2026" ao lado dela foi removido
  (era uma soma anual, redundante com o corte de dezembro já visível na
  curva).
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
  - **RS (RanSharing) NÃO é mídia** — decisão FECHADA do usuário ("não
    existe essa merda"): o override antigo (mídia='RS' quando
    `CLASSIFICACAO='RANSHARING'`) foi **removido**. Ele congelava 372 sites
    como RS nas duas raias (delta 0 sempre) e escondia migrações reais
    (ex.: SAT→FO). Ransharing = **posse**, visível na "Camada de Rede"
    (aba Infraestrutura, `CLASSIFICACAO`). Exceção: na **reconciliação**, o
    lado Base Única ainda reporta 'RS' (`MEIO_TX_ATUAL` traz esse valor) —
    aparece como divergência real e como coluna extra da matriz
    (`presentMedias` inclui mídias fora do `TRANSPORT_ORDER`). NUNCA
    reintroduzir o override.
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
o mapa canônico. Mídia de transporte (FO/MW/SAT/LL/SLS) tem sua paleta
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
  Vale pra "Orçamento por Tecnologia" **e** "Endereço por Tecnologia"
  (rateio geográfico de verdade nos dois — o CAC total do segundo hoje
  vem de `VW_CAPEX_MASTER_FULL`, mas o rateio por OC continua igual, ver
  seção própria da view).
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
| `NTW_OP.MUNICIPIOS_FECHAMENTO` | Presença 2G/3G/4G/5G por município (aba Cidades), Cidades por Regional | Sempre filtrar `TRUNC(DT_CARGA) = MAX(DT_CARGA)` — carga histórica, não só o último dia. **Velocímetros (Cidades) e Linha do Tempo — alvo EOY26 do 5G**: `MES_DIV_5G` só tem data **realizada** (não existe linha com data futura para cidade ainda não ativada), então calcular o `eoy_curr` só por `MES_DIV_5G < próximo ano` colapsa no mesmo valor do YTD (ex.: mostrava 1.112 quando o alvo real é 1.089 + 134 do plano = 1.223). Corrigido: `eoy_curr_5g = eoy_prev_5g + planejado_5g`, onde `planejado_5g` conta `IBGE IN (SELECT IBGE FROM REL_CIDADES_PLANEJADO_26)` com guard `MES_DIV_5G IS NULL OR MES_DIV_5G >= início do ano` (evita contar 2× quem já era 5G antes do ano-plano). Só o **5G** tem esse ajuste — é o único card do velocímetro alimentado por um plano de cidades novas dedicado; os outros (2G/3G/4G/TIM) seguem só por data. A **Linha do Tempo** (`TIMESERIES_TEMPLATE`) espelha isso: a curva 5G ganha um ponto em **dez/26** somando as cidades do plano ainda não realizadas (mesmo guard, `JOIN REL_CIDADES_PLANEJADO_26`) — sem isso a curva "morria" no mês corrente, sem refletir o alvo do ano. |
| `NTW_OP.TB_FT_BASE_UNICA_SITES` | Sites físicos por tecnologia (Raia 1, aba Sites) | **Recorte de `MES_REF` depende da tela**: a **aba Sites** usa `MES_REF = MAX(MES_REF)` (inventário atual, sempre o mais recente); a **raia Fechamento 25 do Resumo** usa o **fechamento de dezembro do ano anterior ao plano** (`TRUNC(MES_REF,'MM') = TRUNC(:baseline_date,'MM')`, com `baseline_date = 31/dez/ano-1`) — é um fechamento histórico, não o load mais novo. Pra bater com o Power BI antigo: `TIPO_SITE <> 'ROAMING VIVO'`, `MOBILE_SITE = 'SIM'`, `TECNOLOGIA <> '-'`. Coluna `TECNOLOGIA` vem como string tipo `"2G/3G/4G"` — usa `LIKE '%2G%'` pra testar presença. Também tem `END_ID` (site único), `IBGE` (join exato com `MUNICIPIOS_FECHAMENTO`, preferir a UF+MUNICIPIO por string), `STATUS_END_ID` (ex.: `'ATIVADO'`), `FLAG_TX_PROFILE_ENG` (perfil de transmissão configurado), `LATITUDE`/`LONGITUDE` (coordenada do site, confirmadas — usadas em `SITES_GEO_POINTS`) e, segundo o usuário, coluna(s) de fornecedor por tecnologia (nome exato ainda não confirmado) |
| `NTW_MABE.BASE_TB_END_ID_NEW` | Fornecedor (vendor) dominante por site | Cascata de colunas `VENDOR_NR_*`/`VENDOR_LTE_*`/`VENDOR_UMTS_*`/`VENDOR_GSM_*` via `COALESCE`, maior banda primeiro dentro de cada tec |
| `NTW_OP.TB_ROLLOUT_ACESSO` | Plano de rollout (Raia 2), OCs | Sem coluna de site físico único (ver acima). `PLANO` = ano, `STATUS_OC='ACTIVATED'`, `CLASSIFICACAO_CASA` distingue Casa Nova (`NEW SITE`/`CO SITE CASA NOVA`) de Casa Existente. **Grão = OC, não endereço**: a mesma Casa Nova gera 2+ OCs (4G e 5G separadas) — contagens de "sites/endereços" devem deduplicar por `(COD_IBGE, ID_MASTER_PIVOT)` (`COUNT(DISTINCT ...)` em `R2_VENDORS_NEW_SITES`; era `COUNT(*)` e inflava 2171 vs ~1000 reais, pego cruzando com a meta do `TB_NEXUS_CN_CE`). **`PRIORIDADE` é sobrecarregada**: pra maioria das linhas é o nome do projeto, mas linhas de B2B Mobile carregam o valor fixo `'B2B MOBILE'` no lugar de um nome — qualquer ranking por projeto tirado daqui precisa de `PRIORIDADE <> 'B2B MOBILE'`, senão mistura esse marcador de segmento como se fosse projeto. Hoje **nenhum visual usa `PRIORIDADE` como projeto** (o antigo "Top 10 Projetos" foi substituído pela tabela "CAC por Projeto", que usa `DLV_LEVEL_2` do NEXUS) |
| `NTW_OP.REL_CIDADES_PLANEJADO_26` | Novas Cidades por Regional (Raia 2 — "Novas Cidades por Regional") | Lista **fechada** das cidades novas do plano 26: 1 linha por `IBGE` (`REGIONAL, UF, ANF, MUNICIPIO, IBGE`), sem `MES_REF`/`DT_CARGA` — `GROUP BY REGIONAL, COUNT(*)` direto, sem recorte de data. Município filtra via ponte IBGE (`_build_municipio_ibge_clause`), não por nome direto — evita mismatch de acentuação com o autocomplete (que busca em `MUNICIPIOS_FECHAMENTO`). Antes esse gráfico usava `MUNICIPIOS_FECHAMENTO` com `MES_DIV_5G` (fechamento/realizado) — trocado porque misturava a raia de Plano com dado já realizado. |
| `TB_NEXUS_FINANCEIRO` | CAPEX/OPEX/LEASE por tipo | Usada só no rateio "Orçamento por Tecnologia" — sem schema/join direto, rateada por nº de OCs |
| `TB_NEXUS_CN_CE` | Meta de Casa Nova | `CAC` com `TIPO_CASA='CN'` é a **contagem-meta de endereços novos** (4G 755 + 5G 245 = 1000) — fonte do toggle "Meta NEXUS" no donut Fornecedores EoY 26 (`/api/summary/r2/casa-nova-nexus`). É **nacional** (sem UF/regional) — não responde aos filtros, e o subtítulo do card avisa. **Não é mais** a fonte de "Endereço por Tecnologia" (ver `VW_CAPEX_MASTER_FULL` abaixo) — esse uso foi substituído. |
| `VW_CAPEX_MASTER_FULL@NEXUS_LINK` | CAC total por tecnologia/tipo de casa/cenário — insumo do rateio geográfico de "Endereço por Tecnologia" (Raia 2, junto com `TB_ROLLOUT_ACESSO`) | Acesso via DB link `NEXUS_LINK`, sem schema prefix. Ver seção própria abaixo. |
| `REL_TRAFEGO_CIDADES_WIDE` | Tráfego **planejado** (módulo Tráfego) | 1 linha por (município, `TIPO_TRAF`), 12 meses em COLUNAS (`JANEIRO`..`DEZEMBRO`), `ANO`. `TIPO_TRAF='Consolidado'` é o total (NÃO somar as camadas). Valores em **PB**. `MUNICIPIO_ID`=IBGE 6 díg. Versão `REL_TRAFEGO_CIDADES_LONG` tem os meses em linha |
| `REL_DS013_TRAFEGO_REALIZADO` | Tráfego **realizado** + base de usuários (módulo Tráfego) | 1 linha por (município, `OPERADORA`), snapshot mensal (`DT_REFERENCIA`). Traz TIM e OI → market share. `S_MEGABYTE_TOTAL` em MB (÷1e9 = PB); colunas por tec aditivas |
| ~~`NTW_MABE.ALTAIA_PM_MES_4G/5G`~~ | ~~Volumetria RAN (módulo Core)~~ | **Descontinuada** — o módulo Core foi removido e substituído pelo módulo Tráfego quando a fonte mudou |

### `VW_CAPEX_MASTER_FULL@NEXUS_LINK` — integrada (CAC de "Endereço por Tecnologia")

View de CAPEX/orçamento consolidado do NEXUS, acessada via database link
(não é uma tabela local — não precisa de schema prefix tipo `NTW_OP.`).
Alimenta o **CAC total por (tecnologia, tipo de casa, cenário)** que o
card **"Endereço por Tecnologia"** (Raia 2, `R2_ENDERECO_POR_TECNOLOGIA`
em `summary/queries.py`) distribui geograficamente — o rateio em si
(numerador/denominador por OC) continua vindo de `TB_ROLLOUT_ACESSO`,
igual sempre foi (ver "Rateio financeiro" em Convenções de backend).

**Duas versões de query já ficaram pra trás aqui** — histórico, não
reabrir sem motivo novo:
1. A exploração original (`DLV_LEVEL_1`/`DLV_LEVEL_2`/`DLV_LEVEL_3`/
   `SOURCE_AJUSTADO`, rateio TIM×B2B Mobile por projeto) — abandonada.
2. Uma versão intermediária, sem rateio geográfico nenhum (achava CN/CE
   e tech por `INSTR` em cima do texto de `DELIVERABLE`, resultado
   nacional) — também abandonada: o usuário confirmou que este card
   **precisa** do mesmo rateio geográfico que sempre teve.

A versão atual deriva `TECH`/`TIPO_CASA` de colunas estruturadas
(`DLV_LEVEL_1`, `DLV_LEVEL_3`, `TAG_2`, `SOURCE_AJUSTADO`), não mais de
texto livre:

```sql
WITH CAPEX_BASE AS (
    SELECT
        SCENARIO,
        KPI,
        CASE
            WHEN DLV_LEVEL_3 = 'CASA NOVA' THEN 'CN'
            WHEN DLV_LEVEL_3 = 'CASA EXISTENTE' THEN 'CE'
        END AS TIPO_CASA,
        CASE
            WHEN DLV_LEVEL_1 IN ('4G LAYERS', '4G/5G LAYERS') THEN '4G'
            WHEN TAG_2 IN (
                'ROLLOUT - RQUAL', 'ROLLOUT - EVENTOS SAZONAIS',
                'ROLLOUT - OBLIGATION 2.3GHZ', 'PLATAFORMA IPSEC',
                'ROLLOUT ACESSO - RQUAL', 'OBRIGAÇÃO 2.3GHZ',
                'EVENTOS SAZONAIS'
            ) THEN '4G'
            WHEN SOURCE_AJUSTADO = 'B2B MOBILE IOT' THEN '4G'
            ELSE '5G'
        END AS TECH
    FROM VW_CAPEX_MASTER_FULL@NEXUS_LINK
    WHERE PRIORIDADE = 'IMPRESCINDÍVEL'
)
SELECT SCENARIO, TECH, TIPO_CASA, SUM(NVL(KPI, 0)) AS CAC
FROM CAPEX_BASE
WHERE TIPO_CASA IS NOT NULL
GROUP BY SCENARIO, TECH, TIPO_CASA
ORDER BY SCENARIO, TECH, TIPO_CASA
```

**Como o rateio geográfico com múltiplos cenários funciona junto**
(`R2_ENDERECO_POR_TECNOLOGIA` completo): `TB_ROLLOUT_ACESSO` não tem
dimensão de cenário — é sempre "o plano do `:ano` selecionado". Então o
mesmo peso geográfico (`NUM_OCS / TOTAL_OCS_GRUPO`, por `TECH`/
`TIPO_CASA`) é aplicado a **cada** cenário: o `INNER JOIN` entre o
rollout (uma linha por OC/geografia) e `CAPEX_CAC` (uma linha por
cenário) faz esse "fan-out" naturalmente — cada linha de rollout vira N
linhas (uma por cenário), cada uma multiplicada pelo `CAC_TOTAL` daquele
cenário específico. Resultado agrupado por `SCENARIO, TECH,
CLASSIFICACAO` no final.

**Decisões de arquitetura** (não reabrir sem motivo):

- **Responde a UF/município/regional/projeto/ano**, igual "Orçamento por
  Tecnologia" — `get_r2_endereco_por_tecnologia(filters)` recebe
  `filters` e usa `_apply_geo_all()` (mesmo padrão de sempre). Trocar o
  filtro geográfico **refaz** a query — o combo de cenário é a única
  coisa que não dispara request novo.
- **`SCENARIO` vira combo no front, não filtro de servidor**: cada
  resposta já traz todos os cenários (dataset pequeno) agrupados em
  `cenarios: [...]`; o front escolhe qual mostrar sem request novo.
  `cenario_default` é `DEFAULT_CAPEX_SCENARIO` (`shared/constants.py`,
  hoje `"2026 FCST 6+6 V0"`, pedido explícito do usuário) se existir na
  resposta, senão o primeiro cenário retornado — nome de cenário muda
  por ciclo de planejamento, não assumir que esse valor sempre existirá.
- **Transposto**: `categories` = tecnologia (4G/5G), série = tipo de casa
  (CN/CE) — cores fixas em `CASA_COLORS` (`shared/constants.py`, mesmo
  hex de `SMALL_MULTIPLE_COLORS` no front) pra bater visualmente com
  qualquer outro gráfico de Casa Nova x Casa Existente do portal.

#### Segundo visual da mesma view: tabela "CAC por Projeto" (Raia 2)

`R2_CAC_POR_PROJETO` + `get_r2_cac_por_projeto(filters)` + rota
`/api/summary/r2/cac-por-projeto` + `components/CacPorProjetoTable.tsx`.
Tabela de largura inteira **abaixo dos 3 gráficos da Raia 2**, com
hierarquia de **3 níveis** — `DLV_LEVEL_3` (Casa Nova/Existente) >
`SOURCE_AJUSTADO` (TIM / B2B Mobile) > `DLV_LEVEL_2` (projeto) — e as
camadas de `DLV_LEVEL_1` pivotadas em colunas. **Substituiu o antigo
"Top 10 Projetos"** (que contava OCs de `TB_ROLLOUT_ACESSO` por
`PRIORIDADE`, na Raia 3) — aquele card, a query `R2_TOP_PROJECTS`, os
services `get_r2_top_projects`/`get_r3_top_projects` e as rotas
`/r2/top-projects` + `/r3/top-projects` foram **removidos**.

- **⚠️ "Outras camadas" foi removida do cálculo (pedido explícito do
  usuário, jul/26)** — histórico, não reintroduzir sem pedido novo.
  Antes, `TOTAL_CAC` vinha de `SUM(KPI)` de TODAS as camadas de
  `DLV_LEVEL_1`, e como esse bruto não batia com a soma das 3 camadas
  pivotadas (existiam valores fora dos 3 baldes, concentrados nos
  projetos de B2B Mobile — AGRO/INDÚSTRIA/LOGÍSTICA), o service derivava
  a diferença como uma 4ª coluna ("Outras camadas") só pra tabela fechar.
  O usuário decidiu que isso não deveria nem entrar na conta: a query
  (`R2_CAC_POR_PROJETO`) não traz mais `SUM(KPI)` bruto, só
  `CAC_5G`/`CAC_4G`/`CAC_4G_IN_5G`, e `total_cac` no service
  (`_linha_cac`) é só a soma dessas 3 — qualquer KPI de B2B Mobile fora
  desses baldes simplesmente não entra em nenhum número da tabela. Isso
  também faz o total bater exatamente com o pivot de referência do
  usuário no Excel (que também só soma as 3 camadas: 5.207).
- **Célula arredondada ANTES de somar**: subtotal e total geral somam os
  valores já arredondados das linhas exibidas, nunca o bruto — mesmo
  princípio do resto do projeto (total tem que fechar com o que está na
  tela). Com isso as 3 colunas de camada reproduzem exatamente o pivot do
  usuário (CN 253/806/222, CE 3.104/755/67, total 3.357/1.561/289).
- **NACIONAL, sem rateio geográfico** — decisão fechada do usuário
  (jul/26), depois de um ciclo curto em que o rateio por OC foi
  implementado e revertido. Motivo: como o rollout não tem
  `SOURCE_AJUSTADO` nem projeto que casem com o NEXUS, o peso geográfico
  seria **idêntico pra todos os projetos** dentro de um mesmo
  (tech, tipo de casa) — mudaria só a magnitude, nunca a composição. Ou
  seja: número diferente sem informação nova. Não reintroduzir rateio
  aqui (diferente de "Endereço por Tecnologia", onde o rateio faz sentido
  porque a granularidade de saída é a própria tech).
- **Ordenação**: o SQL ordena projeto alfabeticamente, mas o service
  reordena por `total_cac` desc — pra leitura executiva o que importa é
  onde está o volume (é o que o pivot de referência também faz).
- **Sem cross-filter por projeto**: o `projeto` do `useResumoFocusStore`
  perdeu o único gatilho que tinha (o clique no antigo "Top 10
  Projetos"). O `DLV_LEVEL_2` desta tabela **não serve** como substituto:
  os nomes nunca batem com `TB_ROLLOUT_ACESSO.PRIORIDADE` (já
  documentado acima), então clicar aqui filtraria por um nome que não
  casa com nada e esvaziaria os outros gráficos. A plumbing do filtro
  (`projeto_filter` nas queries, `parse_filters`) continua intacta,
  só sem quem a acione.

**⚠️ `ORA-12704: character set mismatch` (já aconteceu em produção)**:
`SOURCE_AJUSTADO` e `TAG_2` vêm do NEXUS por DB link com character set
diferente do banco local (national/NVARCHAR2). Usar essas colunas cruas
num `NVL`/comparação com literal `VARCHAR2` estoura ORA-12704 — foi
exatamente o que derrubou `/r2/cac-por-projeto` na primeira subida. As
duas queries da view agora envolvem essas colunas em **`TO_CHAR(...)`**,
que normaliza pro charset local e é no-op quando a coluna já é VARCHAR2.
As outras colunas da view (`DLV_LEVEL_1/2/3`, `PRIORIDADE`,
`LAYER_SUBAREA`, `KPI`, `VALOR_TOTAL`) são VARCHAR2/NUMBER comuns e
dispensam o wrapper — a query original do usuário rodava no DBeaver sem
ele. Ao usar QUALQUER coluna nova dessa view, se der ORA-12704, o
primeiro remédio é `TO_CHAR`.

**Onde estava o "outras camadas" — mistério resolvido (histórico)**: o
KPI fora dos 3 baldes de `DLV_LEVEL_1` estava **inteiramente em B2B
Mobile**. Confirmado com o pivot de referência do usuário: os projetos
AGRO, INDÚSTRIA e LOGÍSTICA (os únicos com KPI fora dos 3 baldes) são
exatamente os projetos de `SOURCE_AJUSTADO = 'B2B MOBILE'`, e o subtotal
de TIM não tinha nada fora dos 3 baldes nos dois tipos de casa. Não era
dado sujo — era a camada de B2B que não cabe nos 3 baldes de RAN. Essa
investigação foi o que deu confiança pra remover a coluna do cálculo
(acima) em vez de só escondê-la.

**A hierarquia fecha em 4 níveis por construção**: linha (célula
arredondada) → subtotal do segmento (soma das linhas) → subtotal do
grupo (soma dos segmentos) → total geral (soma dos grupos). Nunca
recalcular um nível a partir do bruto do banco: quebraria a garantia de
que o total bate com o que está na tela.

## Bateria de ajustes de UI/dados — jul/26 (Resumo/Cidades/Sites)

Lote grande de pedidos vindos de terceiros (usuários finais), a maioria
label/título/subtítulo/fonte (mecânico, sem decisão de arquitetura) — só
os itens com alguma decisão real ficam documentados aqui.

- **Município aparecendo vazio ao abrir o filtro** (Resumo/Cidades/Sites,
  reportado como bug): `AsyncSelect` (react-select) só chama `loadOptions`
  quando o usuário digita — sem `defaultOptions`, abrir o combo sem
  digitar nada mostra "nenhuma opção" mesmo o backend já suportando busca
  vazia (`MUNICIPIOS_SEARCH_QUERY` com `LIKE '%'` quando `q=''`). Fix:
  `defaultOptions` (dispara `loadOptions('')` no mount) +
  `cacheOptions={uf.join(',')}` (invalida o cache quando a UF muda, senão
  a lista "default" carregada sem UF ficava presa depois de filtrar por
  UF). Em `FilterBar.tsx`, componente compartilhado pelas 3 abas.
- **Selecionar UF fazia "tudo sumir"** (aba Sites): o filtro guarda só o
  nome do município (`municipio: string[]`), sem saber a UF de origem —
  se o usuário já tinha um município de outro estado selecionado, trocar
  a UF criava uma combinação impossível (UF X **e** município de UF Y),
  e como os dois filtros são `AND` no SQL, tudo zerava em silêncio. Fix:
  trocar a UF limpa a seleção de município (`FilterBar.tsx`). Não
  verificado contra Oracle real (sem esse ambiente no sandbox) — é a
  causa mais plausível encontrada por leitura de código; se o sintoma
  persistir em produção, reabrir investigação.
- **"Mobile Sites por Tecnologia" zerava ao clicar numa barra**: o clique
  reenviava a combinação clicada como filtro real pro backend
  (`sitevenn`), que resolve contra `R1_SITES_VENN_REGION_CLAUSES` e
  restringe a base **antes** de recalcular as 15 combinações — restringir
  a própria base do gráfico que existe justamente pra comparar as 15
  combinações lado a lado é o motivo de tudo mais zerar. Fix
  (`SitesComboChart.tsx`): clique agora é só destaque visual local
  (`selected`), nunca mais vai pro backend — mesmo padrão de "Cidades
  Cobertas por Tecnologia" (barra dimerizada, não some).
- **"Frequências Utilizadas por Tecnologia" prendia o filtro** (clique
  não dava pra desfazer): clique escrevia direto no `useFilterStore`
  (`tecnologia`), cross-filtrando a aba inteira — removido a pedido do
  usuário. O filtro de tecnologia continua disponível pelo seletor da
  própria `FilterBar`, só sem o atalho de clicar na barra.
- **Sites por Município somando 5623 em vez de 5570** (nº real de
  municípios do Brasil): `SITES_PIVOT` agrupava por `b.UF, b.MUNICIPIO`
  (texto cru de `TB_FT_BASE_UNICA_SITES`) em vez de por `IBGE` — a mesma
  cidade grava o nome com pequenas variações (acento/espaço/caixa) em
  linhas diferentes da base de sites, fragmentando um município em duas
  linhas. Fix: `GROUP BY b.IBGE` (chave estável), com UF/Município
  exibidos vindos do nome **canônico** de `MUNICIPIOS_FECHAMENTO` (via
  `GEO`, mesmo CTE já usado pro `REGIONAL`), fallback pro nome cru do
  site só se o IBGE não bater com nenhum município conhecido. Mesma
  classe de bug que motivou a ponte-por-IBGE em Tráfego/Transporte — não
  agrupar por nome de município em texto livre em nenhuma query nova.
- **Meta NEXUS (toggle "Meta NEXUS" em Fornecedores EoY 26) passou a
  responder a filtro geográfico**: antes era puramente nacional
  (`TB_NEXUS_CN_CE`, sem UF/regional). Agora rateada pelo mesmo padrão de
  "Orçamento por Tecnologia"/"Endereço por Tecnologia" — peso = OCs de
  Casa Nova do rollout dentro do filtro ÷ OCs de Casa Nova do rollout no
  Brasil inteiro (denominador sempre sem filtro), por tecnologia,
  aplicado à meta nacional de cada tech (`R2_CASA_NOVA_NEXUS_RATEIO`,
  `get_casa_nova_nexus(filters)`).
- **KMZ do mapa de sites virou KML**: usuário pediu KMZ; implementado
  `.kml` puro (`utils/kmlExport.ts`) em vez de zipar — todo software que
  abre KMZ abre KML (KMZ é só um KML zipado), e não valia adicionar uma
  lib de zip ao bundle só pra economizar o tamanho do arquivo. Se um dia
  o tamanho do arquivo virar problema de verdade, essa é a hora de
  reconsiderar.
- **"Fornecedor Dominante por Site" e "Tipo de Site" removidos da aba
  Sites** (pedido explícito) — junto foram as queries/service/rotas
  (`SITES_VENDORS`, `SITES_TIPO`, `get_sites_vendors`, `get_sites_tipo`,
  `/api/sites/vendors`, `/api/sites/tipo`) e o client
  (`sitesApi.vendors`/`.tipo`). "Fornecedor por Site" do **Resumo**
  (`R1_VENDORS`) é uma fonte/query diferente e não foi tocado.
- **Filtro "Ano" removido do Resumo**: a raia já é fixa por ano
  implicitamente (Fechamento 2025/Plano 2026/Fechamento 2026) — o
  seletor era redundante. Sem UI, `ano` no filtro fica sempre `null`; o
  backend já tinha fallback pra `DEFAULT_PLAN_YEAR` quando `ano` não vem
  (`_prepare_params`), então nada quebrou ao tirar o campo.
- **"Municípios TIM" (card do velocímetro TIM geral, aba Cidades) virou
  "Presença TIM"** — só rótulo, mesma métrica.
- **Fonte "Municípios Fechamento" virou "Municípios TIM Brasil
  Fechamento"** em todo o app (`SourceBadge.tsx`, `TABLE_LABELS`, fonte
  única) — recorria em Resumo, Cidades e Sites, trocado uma vez só.

## "CAC por Projeto" ganhou um resumo ao lado — jul/26

Segundo ajuste na mesma seção (depois da remoção de "outras camadas" —
ver seção da view `VW_CAPEX_MASTER_FULL` abaixo). Pedido do usuário:
tirar a coluna de valor (R$ mi) da tabela por projeto, encurtá-la e
jogá-la pra direita, e abrir um resumo novo à esquerda.

- **Layout da Raia 2** (`Raia2.tsx`): a linha antes só com
  `<CacPorProjetoTable />` em `col-12` virou duas colunas —
  `<CacResumoTecnologia />` em `col-lg-4` (esquerda) +
  `<CacPorProjetoTable />` em `col-lg-8` (direita, mais estreita que
  antes). Os dois **compartilham o mesmo cenário selecionado**: o estado
  (`cacEscolhido`/`cacCenarioAtual`) e a única `useQuery` de
  `r2CacPorProjeto` subiram pra `Raia2`, que passa `cenario`/`cenarios`/
  `onChangeCenario` pros dois componentes (agora só de apresentação, sem
  fetch próprio) — trocar o combo (que mora só no `CacPorProjetoTable`)
  atualiza os dois juntos, sem request novo.
- **`CacPorProjetoTable` perdeu a coluna "Valor (R$ mi)"** — `valor_mm`
  saiu de `CacProjetoLinha`/`_linha_cac`/`_somar_cac`/export. O valor
  financeiro não sumiu do produto, só saiu **desta** tabela (que agora só
  mostra CAC/Layers) e voltou a aparecer no resumo novo.
- **`CacResumoTecnologia.tsx`** (novo componente + `_resumo_5g_4g` em
  `service.py`): resumo nacional CAPEX (R$ mi) + Layers (contagem de
  endereços) por tecnologia — 5G x 4G — com % de cada tech sobre o total
  da própria linha, e uma quebra CAPEX/Layers total → Casa Nova/Casa
  Existente. Mesmos dados de `R2_CAC_POR_PROJETO`, só agregados mais
  grosso (sem segmento/projeto) — **não é uma query nova**, reaproveita
  as linhas cruas já trazidas pra tabela por projeto.
  - **"4G in 5G Layers" entra dentro de "4G" aqui** (pedido explícito) —
    diferente da tabela ao lado, que ainda mostra as 3 camadas separadas.
    Tanto o Layers (`cac_4g + cac_4g_in_5g`) quanto o CAPEX
    (`VALOR_4G_MM` já vem somado assim direto da SQL, via
    `CAMADA IN ('L4G','L4G5G')`) fazem essa fusão.
  - **Query ganhou `VALOR_5G_MM`/`VALOR_4G_MM`** (substituindo o antigo
    `VALOR_TOTAL_MM` por projeto, que não existe mais) — mesmo princípio
    de `CAC_5G`/`CAC_4G`/`CAC_4G_IN_5G`, só que pro valor financeiro em
    vez da contagem de endereço.
  - Título "MBB Evolution + B2B IoT" é texto fixo (rótulo do card, igual
    a peça de referência do usuário) — não é um filtro novo nem uma
    dimensão da view, é só como esse resumo é chamado.
- **`DEFAULT_CAPEX_SCENARIO` mudou de `"2026 FCST 6+6 V0"` pra
  `"2026 CAC (26-28) V02"`** (`shared/constants.py`) — pedido explícito
  do usuário, e a constante é **global**: também muda o cenário-padrão de
  "Endereço por Tecnologia" (Raia 2), que usa a mesma constante. Nome de
  cenário muda por ciclo de planejamento — não assumir que esse valor
  sempre existirá na view.

## "Endereço por Tecnologia" — unificado com "CAC por Projeto" (jul/26)

Dois ajustes depois de o usuário conferir os números do resumo "MBB
Evolution + B2B IoT" contra uma fonte externa (achou o CAPEX "bem
diferente" do esperado — 1.845,3 total, 1.674,7 em 5G + 170,6 em 4G).

- **`CAPEX_BASE` (dentro de `R2_ENDERECO_POR_TECNOLOGIA`) trocou de
  classificação de TECH/TIPO_CASA pra ser IDÊNTICA à de
  `R2_CAC_POR_PROJETO`** — pedido explícito do usuário ("a mecânica...
  deve ser a mesma da tabela MBB Evolution + B2B IoT"). A classificação
  antiga (histórica, não reintroduzir) usava `TAG_2`/`SOURCE_AJUSTADO`
  numa lista extensa de valores especiais e um `ELSE '5G'` que jogava
  QUALQUER KPI não classificado pra dentro de 5G — inclusive o que
  `R2_CAC_POR_PROJETO` já tinha identificado como "outras camadas" (KPI
  de `DLV_LEVEL_1` fora dos 3 baldes, ver seção da view acima) e excluído
  do cálculo lá. As duas queries divergiam por isso: uma incluía esse
  resto (dentro de 5G), a outra não incluía em lugar nenhum. Agora as
  duas usam a mesma `CASE` simples (`DLV_LEVEL_1 = '5G LAYERS'` → 5G,
  `'4G LAYERS'` → 4G, `'4G IN 5G LAYERS'`/`'4G/5G LAYERS'` → 4G, resto
  fica de fora), com os mesmos filtros (`PRIORIDADE='IMPRESCINDÍVEL'`,
  `LAYER_SUBAREA='MOBILE ACCESS'`, `DLV_LEVEL_3 IN ('CASA NOVA','CASA
  EXISTENTE')`). O rateio geográfico por OC (`ROLLOUT_REFERENCIA`/
  `TOTAL_OCS_GRUPO_ALL`) continua exclusivo deste visual — só a
  classificação de tech/tipo de casa foi unificada.
  - **⚠️ Números ainda não confirmados contra o Oracle real** — este
    sandbox não tem conectividade com o banco (ver "Rodar frontend", no
    topo do arquivo). O usuário reportou o CAPEX do resumo
    "MBB Evolution + B2B IoT" divergindo de uma referência externa
    (esperado: 1.845,3 = 1.674,7 5G + 170,6 4G); a query e a
    classificação foram revisadas e documentadas aqui, mas **validar os
    dois visuais (Endereço por Tecnologia e MBB Evolution) contra o
    Oracle real no primeiro deploy** antes de considerar resolvido.
- **Rótulo de total acima da barra empilhada ficava travado ao
  esconder uma série pela legenda** (bug real, achado pelo usuário
  clicando em CN/CE): `buildStackedSeries` (`optionBuilders.ts`)
  desenha uma série fantasma (`"__total__"`) só pra escrever o total em
  cima da barra — antes o valor vinha de uma closure JS calculada uma
  única vez (soma de TODAS as séries reais), então trocar a seleção na
  legenda escondia a barra mas não recalculava esse texto. Fix em duas
  pontas:
  1. A série fantasma agora carrega o total dentro do próprio dado
     (`data: [{value: 0, total: t}, ...]`) em vez de indexar uma
     closure externa por `dataIndex` — o `label.formatter` só lê
     `p.data.total`.
  2. `Chart.tsx` ganhou um novo efeito (`legendselectchanged`) que
     detecta a série `"__total__"`, recalcula os totais somando só as
     séries ainda selecionadas, e atualiza a série fantasma via
     `chart.setOption` — mesmo princípio já usado pro total no centro
     dos donuts (efeito irmão, logo acima no mesmo arquivo), agora
     também pra barra empilhada. Vale pra qualquer gráfico que use
     `showTotalLabel: true` (Orçamento por Tecnologia e Endereço por
     Tecnologia hoje) — não é específico de um card.

## Bateria de pedidos do "chefe" — jul/26 (filtros globais + ajustes finos)

Lote grande, entregue como screenshot de checklist. Dois itens foram
explicitamente excluídos pelo usuário (não implementar sem pedido novo):
"Novas Cidades por Regional: colocar o gráfico de rosca no bloco projeção
2026" e, em Orçamento por Tecnologia, "criar filtro com cenários da
Master". Todo o resto do checklist foi implementado.

- **Filtros globais novos: Regional, ANF, População Urbana** (as 3 abas —
  Cidades, Sites, Resumo). `Regional` já existia como filtro de dado em
  quase toda query (`regionais`/`regional_filter*`), só não estava
  exposto na `FilterBar` como seletor manual — agora está. `ANF` e
  `POPULACAO_URBANA` são colunas confirmadas em
  `NTW_OP.MUNICIPIOS_FECHAMENTO` (usadas pelo agente de IA em
  `agent/dicionario_municipios.py`, `COLUNAS_MUNICIPIOS` — foi de lá que
  vieram os nomes reais, não foram adivinhadas). **Capital ficou de
  fora** — não há evidência de nenhuma coluna desse tipo em nenhuma
  query/dicionário do projeto, e o usuário confirmou "não sei/não existe
  ainda" quando perguntado; não reintroduzir sem confirmar a fonte real.
  - **População Urbana é filtro de FAIXA fixa, não intervalo livre**
    (decisão do usuário): 4 buckets (`POP_URBANA_BUCKETS` em
    `shared/constants.py` — até 20 mil / 20-100 mil / 100-500 mil / 500
    mil+), fonte única entre back (monta a cláusula SQL) e front (popula
    o combo via `/api/pop-urbana-buckets`, que devolve os mesmos
    rótulos). `shared/filters.py` ganhou `build_pop_urbana_clause()`
    (única função realmente compartilhada entre as 3 abas — todo o
    resto de filtro geo continua com cópia local por aba, convenção já
    estabelecida) — gera `AND (faixa1 OR faixa2 OR ...)` com bind
    min/max por bucket selecionado, nunca interpolando o valor cru.
  - **`_apply_geo_all`** (summary/service.py) e o equivalente `_apply_geo`
    (sites/service.py) ganharam `anf_field`/`anf_key`/`pop_field`/
    `pop_key` seguindo o MESMO padrão já usado pra `regional_field`/
    `regional_key` — cada query só recebe o filtro nos placeholders que
    ela realmente declara (`{anf_filter_g}`, `{pop_urbana_filter_site}`
    etc., sufixo depende do alias de tabela da query). anf_field/
    pop_field default pro mesmo alias do regional_field (troca
    "REGIONAL" por "ANF"/"POPULACAO_URBANA" no nome) — não precisa
    repetir o alias a cada chamada.
  - **`REL_CIDADES_PLANEJADO_26` não tem `POPULACAO_URBANA`** (só
    `REGIONAL, UF, ANF, MUNICIPIO, IBGE` — confirmado no CLAUDE.md já
    documentado antes). `R2_NEW_CITIES_BY_ANF` ganhou uma ponte por IBGE
    até `MUNICIPIOS_FECHAMENTO` só pra esse filtro (mesmo princípio de
    ponte-por-IBGE já usado em Tráfego/Transporte) — `ANF` em si já
    existe direto na tabela, sem precisar de ponte.
  - **`SITES_GEO_POINTS` (mapa de sites) NÃO ganhou os filtros novos** —
    ela já não respondia a `regional` antes (gap pré-existente, não
    introduzido agora); não fizemos essa extensão pra não expandir o
    escopo de uma query que nunca teve JOIN com `MUNICIPIOS_FECHAMENTO`.
    Se algum dia isso for pedido, seguir o mesmo padrão de
    `SITES_BASE_CTE` (join por IBGE).
  - Resumo: `regional` do filtro global se combina com o cross-filter já
    existente (`useResumoFocusStore.regional`, clique num donut) — o
    cross-filter tem prioridade quando ativo, senão cai pro filtro
    global (`regionais: focusedRegional ? [focusedRegional] : regional`
    em `ResumoDashboard.tsx`). `tecnologia`/`anf`/`popUrbana` do filtro
    global vão direto (Resumo continua sem filtro global de tecnologia
    — ver próximo item).
- **"Mobile Sites por Fornecedor" (ex-"Sites por Fornecedor", Raia 1)
  ganhou filtro de tecnologia — só deste card**, não um filtro global do
  Resumo (que continua sem tecnologia como filtro real — CLAUDE.md já
  documentava isso, "tecnologia é só destaque"). Estado local
  (`useState` em `Raia1.tsx`), combo compacto no `headerExtra` do
  `ChartPanel` (mesmo padrão do seletor de cenário em "Endereço por
  Tecnologia"). Backend: `R1_VENDORS` ganhou `{tecnologia_filter_site}`
  dentro da CTE `SITE_UNIVERSE` (LIKE-based, "tem pelo menos uma das
  tecs", igual o resto do módulo) — `_build_tecnologia_like_clause()`
  novo em `summary/service.py`, aplicado via `.replace()` antes do
  `_apply_geo_all` (não cabia no mecanismo IN-clause dos outros
  filtros).
- **Orçamento por Tecnologia: arredondado pra inteiro na origem**
  (`get_r2_orcamento_por_tecnologia`, `round(...)` sem casas decimais em
  vez de `round(...,2)`) — arredondar no service em vez de só na
  formatação do front propaga pro rótulo do gráfico E pro Excel
  exportado de graça, sem duplicar lógica de arredondamento em dois
  lugares. Fonte renomeada de "Nexus Financeiro" pra "Master (Nexus)"
  (`TABLE_LABELS` em `SourceBadge.tsx`) — só essa tabela usa esse rótulo,
  troca segura.
- **Endereço por Tecnologia (Raia 2)**: 4 mudanças no mesmo card.
  1. **Reordenado**: Novas Cidades → Endereço → Orçamento (era Novas
     Cidades → Orçamento → Endereço) — só trocar a ordem dos blocos JSX
     em `Raia2.tsx`, sem tocar em estado/lógica.
  2. **Badge de fonte só "Master (Nexus)"**: `sourceTable` mudou de
     `["TB_ROLLOUT_ACESSO", "VW_CAPEX_MASTER_FULL"]` pra só
     `"VW_CAPEX_MASTER_FULL"`. O rateio geográfico por OC do
     `TB_ROLLOUT_ACESSO` continua existindo por trás (não mudou a
     mecânica, só o que aparece como badge visível).
  3. **Rodapé trocado**: era "referência: Data do arquivo de rollout" →
     agora "referência: cenário Master (Nexus) selecionado acima" — a
     `VW_CAPEX_MASTER_FULL` não tem data de carga própria
     (`STATIC_REFS["VW_CAPEX_MASTER_FULL"] = None`), então a referência
     que faz sentido mostrar é o cenário do combo, não uma data.
  4. **Cores próprias (amarelo/vermelho), NÃO o `CASA_COLORS` global**:
     `CASA_COLORS` (verde/azul, `shared/constants.py`) é documentado como
     o par "oficial" de Casa Nova/Casa Existente pra qualquer visual novo
     do portal — mudar esse valor global quebraria essa convenção pra
     sempre. Como só este card pediu cor diferente, criamos
     `_ENDERECO_CORES` local em `summary/service.py`
     (`{"CN": TECH_COLORS["4G"], "CE": TECH_COLORS["3G"]}` — reaproveita
     os hex de amarelo/vermelho já usados no resto do app em vez de
     inventar cor nova) e trocamos só a query deste card
     (`get_r2_endereco_por_tecnologia`). `CASA_COLORS` continua
     definida em `constants.py`, só não é mais importada em
     `summary/service.py` (sem consumidor no momento — se outro CN/CE
     precisar dela de novo, reimportar).
  5. **"Trocar cores do gráfico" NÃO se aplica ao resumo "MBB Evolution +
     B2B IoT"/tabela "CAC por Projeto"** — só ao gráfico "Endereço por
     Tecnologia" mesmo (não havia pedido pra mudar as outras).
- **Toda a raia "Fechamento 2025" (R1) mostra a referência de data
  MOCADA em `12/2025`, sempre** — pedido de acompanhamento do usuário
  depois da entrega acima. Motivo: o badge de fonte (`/api/refs`) mostra
  o `MAX(DT_CARGA)`/`MAX(MES_REF)` **real** da tabela, que pode já ter
  avançado além de dez/2025 (carga contínua — a tabela recebe loads
  novos com o tempo, mesmo a análise desta raia sempre olhando o
  snapshot de 31/dez/2025 via `baseline_date`). Mostrar a data real do
  último load, quando ela diverge do que está de fato sendo exibido,
  confunde o leitor sobre qual recorte está na tela.
  - **`SourceBadge` ganhou a prop `staticRef?: string`** — quando
    presente, ignora completamente o valor vindo de `/api/refs` (a
    query nem é feita: `enabled: !staticRef`) e mostra esse texto fixo.
    `ChartPanel` repassa via `sourceStaticRef`. Aplicado nos 4 cards da
    R1: "Cidades Cobertas por Tecnologia", "Mobile Sites por
    Tecnologia" (`SitesComboChart` — hardcoded direto no componente,
    que só é usado nesta raia), "Mobile Sites por Fornecedor" e "Total
    de sites ativos".
  - **Escopo é só a raia R1 do Resumo** — as MESMAS tabelas
    (`TB_FT_BASE_UNICA_SITES`, `BASE_TB_END_ID_NEW`) aparecem também na
    aba **Sites** (`SitesDashboard.tsx`, `SitesMap.tsx`,
    `SitesPivotTable.tsx`) mostrando o inventário **atual** (MES_REF
    mais recente, não o fechamento de dezembro) — essas continuam com a
    data real do `/api/refs`, sem `staticRef`. Não espalhar o mock pra
    essas outras telas: são semanticamente diferentes (inventário de
    hoje vs. fechamento congelado de dez/25).
  - Literal `"12/2025"` fixo no código (não derivado de
    `DEFAULT_PLAN_YEAR`) — mesmo valor que o usuário pediu por
    extenso duas vezes. Se o ciclo de planejamento avançar (baseline
    virar dez/26 etc.), atualizar a constante `FECHAMENTO_25_REF` em
    `Raia1.tsx` e o literal em `SitesComboChart.tsx` junto.

## Bug: filtro de ANF/População Urbana no Resumo "seleciona mas não filtra" (ago/26)

Usuário reportou que trocar SÓ o filtro de ANF ou de População Urbana no
Resumo não mudava nada na tela — sem erro, sem combo vazio, só não
refletia. Regional/UF/Município no mesmo Resumo funcionavam normalmente.

**Causa raiz: bug de `queryKey` do React Query, não do backend.** Todo
`useQuery` em `Raia1.tsx`/`Raia2.tsx`/`Raia3.tsx`/`SitesComboChart.tsx`
desestruturava `filters` pra montar o `queryKey`
(`const { uf, municipio, ano, regionais } = filters`), mas a
desestruturação **não incluía `anfs`/`popUrbana`** — só foram
adicionados ao objeto `filters` (e iam corretos pro `queryFn`), nunca ao
array do `queryKey`. Resultado: ao trocar só ANF/População Urbana, o
`queryKey` ficava idêntico ao de antes, e o React Query servia o cache
existente sem nunca disparar o `queryFn` (logo, sem nunca mandar a
request nova pro backend). O backend estava 100% correto desde
jul/26 — confirmado reproduzindo com stub e vendo o histórico de
requests HTTP: SEM o fix, só 1 request acontecia (a inicial); COM o
fix, uma segunda request com `?anf=11` disparava ao trocar o combo.

**Fix**: adicionar `anfs, popUrbana` na desestruturação de `filters` e
no array de `queryKey` de TODO `useQuery` do Resumo que usa esses
campos — exceto `summary-r2-cac-por-projeto` (CAC por Projeto/MBB
Evolution), que continua sem nenhum filtro geo por design (nacional).

**Lição pra qualquer `useQuery` novo neste módulo**: o `queryKey` tem
que espelhar TODO campo do objeto de filtro que o `queryFn` realmente
usa — nunca destructure um subconjunto "que parecia suficiente" na hora
de escrever o card. Cidades e Sites (`VennDiagram.tsx`, `GaugeCards.tsx`,
`TimelineChart.tsx`, `FrequencyChart.tsx`, `MunicipiosTable.tsx`,
`SitesDashboard.tsx`, `SitesPivotTable.tsx`) já incluíam `anf`/
`popUrbana` corretamente desde o início — só o Resumo tinha o bug,
porque esses componentes foram escritos num commit anterior ao dos
filtros novos e a desestruturação existente não foi revisitada quando
`anfs`/`popUrbana` foram adicionados ao `SummaryFilters`.

## Módulo Transporte reativado (ago/26)

Estava com `enabled: False` em `config/modules.py`
(`config/modules.py`), mas o módulo inteiro (backend `modules/transport/`
— queries/service/routes — e frontend, rotas em `App.tsx`) já estava
implementado e documentado neste arquivo há tempo. **Reativação foi só
`enabled: True`** — nenhum código novo necessário. Validado com stub
(Home mostra o card "Disponível", as 4 abas — Resumo Executivo,
Composição & Migração, Infraestrutura & Fornecimento, Comparação de
Bases — carregam sem erro de console, mapa Leaflet estrutura ok).
⚠️ Números ainda não validados contra Oracle real (mesma ressalva de
sempre neste sandbox) — primeira prioridade no próximo deploy.

## "Meta NEXUS" (Fornecedores EoY 26) migrada pra base de "Endereço por Tecnologia" (ago/26)

Usuário reportou que a "Meta NEXUS" (toggle no donut "Fornecedores EoY
26", Raia 3) estava fixa numa base antiga e pediu pra ela usar a MESMA
base de "Endereço por Tecnologia", só filtrando pra Casa Nova (CN), e
acompanhar a troca de cenário daquele card.

- **Antes**: `R2_CASA_NOVA_NEXUS_RATEIO` lia `TB_NEXUS_CN_CE`
  (`TIPO_CASA='CN'`) — meta NACIONAL fixa (4G 755 + 5G 245 = 1000
  endereços), sem dimensão de cenário, rateada geograficamente pelo peso
  de OCs de Casa Nova do rollout. **Removida por completo** — query
  (`R2_CASA_NOVA_NEXUS_RATEIO`), service (`get_casa_nova_nexus`) e rota
  (`/api/summary/r2/casa-nova-nexus`) não existem mais. Nada mais
  consumia essa fonte, então não sobrou código morto.
- **Agora**: a "Meta NEXUS" é simplesmente a soma das células "CN" (4G +
  5G) de `get_r2_endereco_por_tecnologia` — MESMA query, MESMO cenário
  selecionado no combo de "Endereço por Tecnologia". Nenhuma query nova
  no backend: o card de Raia 3 só passou a receber, via prop, o mesmo
  dado que Raia 2 já busca.
- **Estado subido pro `ResumoDashboard.tsx`**: a query de
  `r2EnderecoPorTecnologia` e o estado `cenarioEscolhido`/`cenarioAtual`
  (antes moravam dentro de `Raia2.tsx`) subiram pro dashboard pai, que
  passa `endereco`/`enderecoCenario`/`cenarioAtual`/`onChangeCenario`
  como props pra `Raia2` (que virou parcialmente presentational nesse
  pedaço, mesmo princípio já usado pra "CAC por Projeto"/"MBB Evolution")
  **e** pra `Raia3` (só `enderecoCenario`, que é o que ela precisa pra
  montar o valor de "A Contratar" quando `cnFonte === "nexus"`). Trocar
  o cenário no combo de "Endereço por Tecnologia" agora atualiza a Meta
  NEXUS de Fornecedores EoY 26 junto, sem request novo (mesmo dataset já
  baixado, só o cálculo em Python no `Raia3.tsx` muda:
  `enderecoCenario.series.find(s => s.name === "CN").data.reduce(sum)`).
- **Badge de fonte trocado**: `TB_NEXUS_CN_CE` → `VW_CAPEX_MASTER_FULL`
  no card, subtítulo/tooltip do botão "Meta NEXUS" atualizados pra
  descrever a nova mecânica. O toggle "Rollout" (outra fonte do mesmo
  card, endereços únicos do próprio `TB_ROLLOUT_ACESSO`) não mudou.
- Validado com stub simulando 2 cenários com valores bem diferentes:
  trocar o combo em "Endereço por Tecnologia" mudou o número de "Meta
  NEXUS" em Fornecedores EoY 26 corretamente (1.000 → 130 no teste),
  confirmando a sincronização entre as duas raias.

## Combo de Regional só mostrava 5 opções (ago/26)

Usuário reportou (testando o filtro global novo) que o combo de Regional
só listava 5 valores, quando existem pelo menos 7-10 regionais reais.
Confirmado que não era scroll escondendo opções — o combo realmente só
tinha 5 pra escolher.

**Causa**: `REGIONAIS_QUERY`/`ANFS_QUERY` (`actual/queries.py`) seguiam o
mesmo padrão de `UFS_QUERY` — restritas a
`TRUNC(DT_CARGA) = MAX(DT_CARGA)` (só a carga mais recente). Isso é
correto pra UF (toda linha tem UF preenchida, sempre), mas `REGIONAL` e
`ANF` aparentemente **não vêm preenchidos em 100% das linhas em toda
carga** — então a carga mais recente, sozinha, não necessariamente
contém todos os valores que já existiram/existem.

**Fix**: `REGIONAIS_QUERY` e `ANFS_QUERY` não restringem mais por
`DT_CARGA` — olham a tabela inteira (`WHERE REGIONAL IS NOT NULL`, sem
o filtro de carga). Justificativa: essas duas queries só alimentam a
LISTA DE OPÇÕES do combo (não um número agregado que precisa ser
ponto-no-tempo), então pegar qualquer valor que já apareceu em qualquer
carga é estritamente mais seguro do que esconder opções reais — o pior
caso é mostrar uma opção "velha" que ninguém mais usa, não esconder uma
válida. **Não usar esse mesmo raciocínio pra UFS_QUERY nem pra nenhuma
query de dado agregado** (KPIs, gráficos) — ali o recorte de carga mais
recente continua sendo o correto por design.
⚠️ Não confirmado contra Oracle real (sandbox sem conectividade) — a
lógica foi validada só estruturalmente (SQL sem placeholder quebrado);
confirmar no próximo deploy que o combo passa a listar as 7-10
regionais esperadas.

## Fechamento 2025 do Tráfego ancorado no CTP (`TB_TRAFEGO_TECNOLOGIAS_PB`) — ago/26

Usuário trouxe uma tabela nova, `NTW_OP.TB_TRAFEGO_TECNOLOGIAS_PB`
("a query do CTP"): **1 linha nacional** por `MES_REFERENCIA` (YYYYMM),
já em PB, com o total oficial de tráfego por tecnologia
(`VOL_2G_PB`..`VOL_5G_PB`, `TOTAL_PB`). Pediu pra Raia 1 (Fechamento
2025) passar a usar esse total como fonte de verdade — mas como essa
tabela **não tem município/UF**, o `REL_DS013_TRAFEGO_REALIZADO`
continua entrando, só que agora só pra decidir **como distribuir**
geograficamente o total oficial do CTP, não mais como a própria fonte do
total.

- **Padrão = mesmo rateio geográfico já usado em `mobile_access`**
  (Orçamento por Tecnologia, Endereço por Tecnologia, a extinta Meta
  NEXUS/`TB_NEXUS_CN_CE`): peso = subconjunto filtrado ÷ mesmo total SEM
  filtro geográfico (denominador nunca filtra). Aqui é a primeira vez
  que esse padrão aparece no módulo Tráfego — implementado em **Python**
  (`_rz_por_tecnologia_estratificado`, `service.py`), não SQL/CTE, porque
  o módulo inteiro já é "tudo calculado em Python a partir das linhas"
  (ver docstring do módulo) — escolha deliberada de manter a
  consistência com o estilo JÁ estabelecido NESTE módulo, em vez de
  copiar cegamente a abordagem SQL do `mobile_access`.
- **Peso calculado POR TECNOLOGIA, não um peso único**: a mistura de
  tecnologia de uma região filtrada pode ser bem diferente da média
  nacional (uma UF com mais 5G que a média, por exemplo), então usar um
  peso único borraria essa diferença. `_ctp_tecnologias_fechamento_2025`
  devolve o total oficial por tech; `_rz_por_tecnologia_estratificado`
  calcula um peso separado pra cada uma de {2G, 3G, 4G, 5G} usando
  `REL_DS013` (filtrado ÷ Brasil inteiro) e aplica esse peso ao valor
  daquela tech no CTP.
  - **Sem filtro geográfico ativo, o peso é exatamente 1.0 pra toda
    tech** (filtrado = nacional) — o resultado bate 100% com o CTP puro,
    que é como os números devem bater com a fonte oficial quando a tela
    está sem filtro nenhum.
- **`MES_REFERENCIA` filtrado explicitamente** (`ANO_FECHAMENTO_ANTERIOR
  * 100 + 12` = 202512), nunca `MAX(MES_REFERENCIA)` — evita que uma
  carga futura de outro mês (ex.: quando existir uma linha de fechamento
  de 2026) troque silenciosamente qual linha esta query usa. Usa a MESMA
  constante que o resto da Raia 1 já usa como baseline, então não pode
  descasar.
- **Fallback se o CTP não tiver linha pro mês** (`ctp is None`):
  `_rz_por_tecnologia_estratificado` cai pro cálculo cru de sempre (soma
  direta do `REL_DS013` filtrado, sem CTP) — nunca quebra a tela por
  falta de dado nessa tabela nova.
- **Escopo é SÓ a Raia 1 (Fechamento 2025)** — Plano 26 e Fechamento 26
  continuam inteiramente `REL_DS013`/planejado, sem tocar no CTP (pedido
  explícito do usuário: "SOMENTE PARA O QUE FOR FECHAMENTO 2025").
- **`ranking_municipios` da Raia 1 continua cru** (`REL_DS013`, sem
  estratificação) — é uma comparação relativa entre municípios, e o CTP
  não tem dimensão de município pra ancorar uma cidade individual nele;
  estratificar um ranking não faria sentido (o rateio serve pra
  distribuir um TOTAL agregado, não pra corrigir posições relativas
  entre linhas de uma mesma fonte).
- **Frontend**: `ChartPanel` de "Tráfego por Tecnologia" (Raia 1) ganhou
  `sourceTable={["TB_TRAFEGO_TECNOLOGIAS_PB", "REL_DS013_TRAFEGO_REALIZADO"]}`
  (as duas fontes, já que o resultado é uma combinação das duas) + um
  `footnote` explicando a metodologia. Os outros números da Raia 1
  (KPI de tráfego total, top município/top 15) não mudaram de fonte —
  só o donut de tecnologia usa a estratificação. `SourceBadge.TABLE_LABELS`
  ganhou uma entrada pra `TB_TRAFEGO_TECNOLOGIAS_PB`.
- ⚠️ **Não validado contra Oracle real** (sandbox sem conectividade,
  como sempre) — a lógica foi validada com um stub Python (dados falsos
  de CTP + município, casos sem filtro e com filtro de UF, matemática
  conferida manualmente). Validar no primeiro deploy: (1) que a tabela
  `NTW_OP.TB_TRAFEGO_TECNOLOGIAS_PB` realmente devolve 1 linha pra
  `MES_REFERENCIA=202512`, (2) que o total sem filtro bate exatamente
  com o TOTAL_PB da tabela, (3) que o total COM filtro geográfico é
  plausível (não deveria nunca ultrapassar o total nacional).

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
