"""
Queries SQL do módulo Summary do Mobile Access.

3 raias empilhadas:
    - Raia 1: Fechamento 25 (baseline do ano anterior)
    - Raia 2: Plano 26 (só deltas planejados)
    - Raia 3: Fechamento 26 = Raia 1 + Raia 2 (calculada no service)

Filtros globais compartilhados (aplicados via placeholders):
    - :baseline_date (31/dez do ano-1)
    - :plan_start / :plan_end (jan-dez do ano)
    - UF/Município via {uf_filter} e {municipio_filter}
"""

from modules.mobile_access.shared.site_universe import (
    MOBILE_SITES_WHERE,
    MACRO_WHERE,
    SMALL_CELL_MOVEL_SLS_WHERE,
    RAN_SHARING_WHERE,
    SEM_RF_WHERE,
    ROAMING_VIVO_WHERE,
)


# ===========================================================================
# RAIA 1 — FECHAMENTO 25 (baseline até 31/dez do ano-1)
# ===========================================================================

# ---------- Sites por tecnologia — diagrama de Venn de 4 conjuntos ----------
# Universo = "Mobile Sites" (ver shared/site_universe.py, hierarquia
# confirmada pelo usuário: Total Sites Ativos → TIM+TX/DC/PI → Mobile
# Sites → TIM (Macro + Small Cell/Móvel/SLS) + Ran Sharing). Esta é a raia
# FECHAMENTO 25, então o recorte de mês é o FECHAMENTO de dezembro do ano
# anterior ao plano (MES_REF = dez/2025 quando o plano é 2026), NÃO o
# MES_REF mais recente — esse (MAX) é o comportamento correto só da aba
# Sites, que mostra o inventário atual. Aqui usamos
# TRUNC(MES_REF,'MM') = TRUNC(:baseline_date) pra pegar exatamente o
# snapshot de dezembro do fechamento. TECNOLOGIA <> '-' continua à parte
# (dimensão do PRÓPRIO Venn — sem rádio informado não cai em nenhuma das
# 15 fatias). Cada site cai em exatamente UMA das 15 combinações não
# vazias de {2G,3G,4G,5G} — como as regiões do Venn são disjuntas por
# construção, a soma das 15 é o total de sites, sem contar o mesmo site
# mais de uma vez (diferente de somar por tecnologia independentemente,
# que conta o mesmo site em cada tec que ele tiver).
R1_SITES_VENN = """
WITH BASE AS (
    SELECT
        END_ID, UF, MUNICIPIO,
        CASE WHEN TECNOLOGIA LIKE '%2G%' THEN 1 ELSE 0 END AS HAS_2G,
        CASE WHEN TECNOLOGIA LIKE '%3G%' THEN 1 ELSE 0 END AS HAS_3G,
        CASE WHEN TECNOLOGIA LIKE '%4G%' THEN 1 ELSE 0 END AS HAS_4G,
        CASE WHEN TECNOLOGIA LIKE '%5G%' THEN 1 ELSE 0 END AS HAS_5G
    FROM NTW_OP.TB_FT_BASE_UNICA_SITES
    WHERE TRUNC(MES_REF, 'MM') = TRUNC(:baseline_date, 'MM')
    AND """ + MOBILE_SITES_WHERE + """
    AND TECNOLOGIA <> '-'
    {uf_filter_site}
    {municipio_filter_site}
    {site_venn_filter}
),
GEO AS (
    SELECT UF, MUNICIPIO, REGIONAL
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
)
SELECT
    SUM(CASE WHEN HAS_2G=1 AND HAS_3G=0 AND HAS_4G=0 AND HAS_5G=0 THEN 1 ELSE 0 END) AS only_2g,
    SUM(CASE WHEN HAS_2G=0 AND HAS_3G=1 AND HAS_4G=0 AND HAS_5G=0 THEN 1 ELSE 0 END) AS only_3g,
    SUM(CASE WHEN HAS_2G=0 AND HAS_3G=0 AND HAS_4G=1 AND HAS_5G=0 THEN 1 ELSE 0 END) AS only_4g,
    SUM(CASE WHEN HAS_2G=0 AND HAS_3G=0 AND HAS_4G=0 AND HAS_5G=1 THEN 1 ELSE 0 END) AS only_5g,
    SUM(CASE WHEN HAS_2G=1 AND HAS_3G=1 AND HAS_4G=0 AND HAS_5G=0 THEN 1 ELSE 0 END) AS i_23,
    SUM(CASE WHEN HAS_2G=1 AND HAS_3G=0 AND HAS_4G=1 AND HAS_5G=0 THEN 1 ELSE 0 END) AS i_24,
    SUM(CASE WHEN HAS_2G=1 AND HAS_3G=0 AND HAS_4G=0 AND HAS_5G=1 THEN 1 ELSE 0 END) AS i_25,
    SUM(CASE WHEN HAS_2G=0 AND HAS_3G=1 AND HAS_4G=1 AND HAS_5G=0 THEN 1 ELSE 0 END) AS i_34,
    SUM(CASE WHEN HAS_2G=0 AND HAS_3G=1 AND HAS_4G=0 AND HAS_5G=1 THEN 1 ELSE 0 END) AS i_35,
    SUM(CASE WHEN HAS_2G=0 AND HAS_3G=0 AND HAS_4G=1 AND HAS_5G=1 THEN 1 ELSE 0 END) AS i_45,
    SUM(CASE WHEN HAS_2G=1 AND HAS_3G=1 AND HAS_4G=1 AND HAS_5G=0 THEN 1 ELSE 0 END) AS i_234,
    SUM(CASE WHEN HAS_2G=1 AND HAS_3G=1 AND HAS_4G=0 AND HAS_5G=1 THEN 1 ELSE 0 END) AS i_235,
    SUM(CASE WHEN HAS_2G=1 AND HAS_3G=0 AND HAS_4G=1 AND HAS_5G=1 THEN 1 ELSE 0 END) AS i_245,
    SUM(CASE WHEN HAS_2G=0 AND HAS_3G=1 AND HAS_4G=1 AND HAS_5G=1 THEN 1 ELSE 0 END) AS i_345,
    SUM(CASE WHEN HAS_2G=1 AND HAS_3G=1 AND HAS_4G=1 AND HAS_5G=1 THEN 1 ELSE 0 END) AS i_2345,
    COUNT(DISTINCT b.END_ID) AS total_sites
FROM BASE b
LEFT JOIN GEO g ON g.UF = b.UF AND UPPER(g.MUNICIPIO) = UPPER(b.MUNICIPIO)
WHERE 1=1
{regional_filter_site}
"""

# Combinação exata de tecnologias por fatia do Venn de 4 conjuntos — clicar
# numa fatia filtra o próprio gráfico pela combinação exata (diferente de
# "tem pelo menos uma dessas"), mesmo princípio do Venn de Presença da aba
# Cidades.
R1_SITES_VENN_REGION_CLAUSES = {
    "only_2g": "HAS_2G=1 AND HAS_3G=0 AND HAS_4G=0 AND HAS_5G=0",
    "only_3g": "HAS_2G=0 AND HAS_3G=1 AND HAS_4G=0 AND HAS_5G=0",
    "only_4g": "HAS_2G=0 AND HAS_3G=0 AND HAS_4G=1 AND HAS_5G=0",
    "only_5g": "HAS_2G=0 AND HAS_3G=0 AND HAS_4G=0 AND HAS_5G=1",
    "i_23": "HAS_2G=1 AND HAS_3G=1 AND HAS_4G=0 AND HAS_5G=0",
    "i_24": "HAS_2G=1 AND HAS_3G=0 AND HAS_4G=1 AND HAS_5G=0",
    "i_25": "HAS_2G=1 AND HAS_3G=0 AND HAS_4G=0 AND HAS_5G=1",
    "i_34": "HAS_2G=0 AND HAS_3G=1 AND HAS_4G=1 AND HAS_5G=0",
    "i_35": "HAS_2G=0 AND HAS_3G=1 AND HAS_4G=0 AND HAS_5G=1",
    "i_45": "HAS_2G=0 AND HAS_3G=0 AND HAS_4G=1 AND HAS_5G=1",
    "i_234": "HAS_2G=1 AND HAS_3G=1 AND HAS_4G=1 AND HAS_5G=0",
    "i_235": "HAS_2G=1 AND HAS_3G=1 AND HAS_4G=0 AND HAS_5G=1",
    "i_245": "HAS_2G=1 AND HAS_3G=0 AND HAS_4G=1 AND HAS_5G=1",
    "i_345": "HAS_2G=0 AND HAS_3G=1 AND HAS_4G=1 AND HAS_5G=1",
    "i_2345": "HAS_2G=1 AND HAS_3G=1 AND HAS_4G=1 AND HAS_5G=1",
}


# ---------- Árvore de composição de sites (Total de Sites Ativos) ----------
# Quebra o mesmo universo de TB_FT_BASE_UNICA_SITES nas 5 categorias-folha
# da hierarquia confirmada pelo usuário (ver shared/site_universe.py) — as
# categorias intermediárias (Mobile Sites, TIM, Total TIM RF+TX, Total
# Ativos) são somadas em Python no service, nunca recalculadas aqui, pra
# não ter como o total "não fechar" por uma soma feita duas vezes. Mesmo
# baseline_date/geo filter de R1_SITES_VENN — é a mesma raia Fechamento 25.
R1_SITES_HIERARCHY = """
WITH BASE AS (
    SELECT
        END_ID, UF, MUNICIPIO,
        CASE WHEN """ + MACRO_WHERE + """ THEN 1 ELSE 0 END AS IS_MACRO,
        CASE WHEN """ + SMALL_CELL_MOVEL_SLS_WHERE + """ THEN 1 ELSE 0 END AS IS_SMALL_CELL_MOVEL_SLS,
        CASE WHEN """ + RAN_SHARING_WHERE + """ THEN 1 ELSE 0 END AS IS_RAN_SHARING,
        CASE WHEN """ + SEM_RF_WHERE + """ THEN 1 ELSE 0 END AS IS_SEM_RF,
        CASE WHEN """ + ROAMING_VIVO_WHERE + """ THEN 1 ELSE 0 END AS IS_ROAMING_VIVO
    FROM NTW_OP.TB_FT_BASE_UNICA_SITES
    WHERE TRUNC(MES_REF, 'MM') = TRUNC(:baseline_date, 'MM')
    {uf_filter_site}
    {municipio_filter_site}
),
GEO AS (
    SELECT UF, MUNICIPIO, REGIONAL
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
)
SELECT
    SUM(IS_MACRO) AS macro,
    SUM(IS_SMALL_CELL_MOVEL_SLS) AS small_cell_movel_sls,
    SUM(IS_RAN_SHARING) AS ran_sharing,
    SUM(IS_SEM_RF) AS sem_rf,
    SUM(IS_ROAMING_VIVO) AS roaming_vivo
FROM BASE b
LEFT JOIN GEO g ON g.UF = b.UF AND UPPER(g.MUNICIPIO) = UPPER(b.MUNICIPIO)
WHERE 1=1
{regional_filter_site}
"""


# ---------- Cidades cobertas por tecnologia (fechamento 25) ----------
# Fonte: MUNICIPIOS_FECHAMENTO com MES_DIV_XG <= baseline_date

R1_CITIES_BY_TECH = """
SELECT
    SUM(CASE WHEN MES_DIV_2G IS NOT NULL AND MES_DIV_2G <= :baseline_date THEN 1 ELSE 0 END) AS cidades_2g,
    SUM(CASE WHEN MES_DIV_3G IS NOT NULL AND MES_DIV_3G <= :baseline_date THEN 1 ELSE 0 END) AS cidades_3g,
    SUM(CASE WHEN MES_DIV_4G IS NOT NULL AND MES_DIV_4G <= :baseline_date THEN 1 ELSE 0 END) AS cidades_4g,
    SUM(CASE WHEN MES_DIV_5G IS NOT NULL AND MES_DIV_5G <= :baseline_date THEN 1 ELSE 0 END) AS cidades_5g,
    COUNT(*) AS total_municipios
FROM NTW_OP.MUNICIPIOS_FECHAMENTO
WHERE TRUNC(DT_CARGA) = (
    SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
)
{uf_filter}
{municipio_filter}
{regional_filter}
"""


# ---------- Vendor por site (fechamento 25) ----------
# Cascata: 5G > 4G > 3G > 2G, e maior banda dentro da mesma tec
# Base: BASE_TB_END_ID_NEW no último REF disponível ≤ baseline_date
#
# Universo = "Mobile Sites" (mesmo de R1_SITES_VENN — ver
# shared/site_universe.py), pra bater com "Total de Sites por
# Tecnologia". IMPORTANTE: quem "dirige" a query é o universo de sites
# (SITE_UNIVERSE, de TB_FT_BASE_UNICA_SITES) via LEFT JOIN pro fornecedor
# — nunca o contrário. Uma versão anterior desta query montava o
# fornecedor primeiro (a partir de BASE_TB_END_ID_NEW) e só depois fazia
# INNER JOIN com o universo: qualquer site do universo sem fornecedor
# identificado em NENHUMA cascata (5G/4G/3G/2G todas NULL) sumia do
# resultado inteiro, em vez de cair em "NÃO INFORMADO" — o total do
# donut ficava menor que o de "Mobile Sites por Tecnologia" (29.195 vs
# 29.228, achado pelo usuário). Mesmo princípio já usado em
# SITES_VENDORS (sites/queries.py): LEFT JOIN a partir do universo,
# nunca um JOIN a partir da tabela de fornecedor.
R1_VENDORS = """
WITH SITE_UNIVERSE AS (
    SELECT END_ID, UF, MUNICIPIO
    FROM NTW_OP.TB_FT_BASE_UNICA_SITES
    WHERE TRUNC(MES_REF, 'MM') = TRUNC(:baseline_date, 'MM')
    AND """ + MOBILE_SITES_WHERE + """
    {uf_filter}
    {municipio_filter}
),
VENDOR_BASE AS (
    SELECT
        END_ID,
        -- Cascata 5G (maior banda primeiro): 3500 > 26000 > 2600 > 2300 > 2100 > 1800 > 700
        -- NULLIF(TRIM(...), '') normaliza string vazia/só espaço pra NULL em
        -- CADA coluna antes do COALESCE — sem isso, uma banda maior com ''
        -- "vencia" a cascata e escondia o fornecedor real de uma banda menor
        -- (achado pelo usuário: 4 sites caindo num rótulo em branco, à parte
        -- de "NÃO INFORMADO"/NULL de verdade).
        COALESCE(
            NULLIF(TRIM(VENDOR_NR_3500), ''), NULLIF(TRIM(VENDOR_NR_26000), ''), NULLIF(TRIM(VENDOR_NR_2600DSS), ''),
            NULLIF(TRIM(VENDOR_NR_2300), ''), NULLIF(TRIM(VENDOR_NR_2100DSS), ''), NULLIF(TRIM(VENDOR_NR_1800DSS), ''), NULLIF(TRIM(VENDOR_NR_700DSS), '')
        ) AS VENDOR_5G,
        -- Cascata 4G: 2600P > 2600 > 2300 > 2100 > 1800 > 850 > 700
        COALESCE(
            NULLIF(TRIM(VENDOR_LTE_2600P), ''), NULLIF(TRIM(VENDOR_LTE_2600), ''), NULLIF(TRIM(VENDOR_LTE_2600RS), ''),
            NULLIF(TRIM(VENDOR_LTE_2300), ''), NULLIF(TRIM(VENDOR_LTE_2100), ''), NULLIF(TRIM(VENDOR_LTE_1800), ''),
            NULLIF(TRIM(VENDOR_LTE_850), ''), NULLIF(TRIM(VENDOR_LTE_700), '')
        ) AS VENDOR_4G,
        -- Cascata 3G: 2100 > 850
        COALESCE(NULLIF(TRIM(VENDOR_UMTS_2100), ''), NULLIF(TRIM(VENDOR_UMTS_850), '')) AS VENDOR_3G,
        -- Cascata 2G: 1800 > 900
        COALESCE(NULLIF(TRIM(VENDOR_GSM_1800), ''), NULLIF(TRIM(VENDOR_GSM_900), '')) AS VENDOR_2G
    FROM NTW_MABE.BASE_TB_END_ID_NEW
    WHERE REF = (
        SELECT REF
        FROM (
            SELECT REF
            FROM NTW_MABE.BASE_TB_END_ID_NEW
            WHERE TO_DATE(REF, 'MM-YYYY') <= :baseline_date
            GROUP BY REF
            ORDER BY TO_DATE(REF, 'MM-YYYY') DESC
        )
        WHERE ROWNUM = 1
    )
),
GEO AS (
    SELECT UF, MUNICIPIO, REGIONAL
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
)
SELECT
    UPPER(COALESCE(vb.VENDOR_5G, vb.VENDOR_4G, vb.VENDOR_3G, vb.VENDOR_2G, 'NÃO INFORMADO')) AS vendor,
    COUNT(*) AS qtd
FROM SITE_UNIVERSE su
LEFT JOIN VENDOR_BASE vb ON vb.END_ID = su.END_ID
LEFT JOIN GEO g ON g.UF = su.UF AND UPPER(g.MUNICIPIO) = UPPER(su.MUNICIPIO)
WHERE 1=1
{regional_filter}
GROUP BY UPPER(COALESCE(vb.VENDOR_5G, vb.VENDOR_4G, vb.VENDOR_3G, vb.VENDOR_2G, 'NÃO INFORMADO'))
ORDER BY qtd DESC
"""


# ===========================================================================
# RAIA 2 — PLANO 26 (só o delta do ano)
# ===========================================================================

# ---------- Novas cidades por regional (ANF) — plano 26 ----------
# Fonte: REL_CIDADES_PLANEJADO_26 — lista FECHADA das cidades novas do plano
# (1 linha por IBGE, sem data/recorte de mês; não é base de realizado). Antes
# usava MUNICIPIOS_FECHAMENTO com MES_DIV_5G, que é fechamento/realizado —
# trocado a pedido do usuário porque misturava a raia de Plano com dado real.

R2_NEW_CITIES_BY_ANF = """
SELECT
    REGIONAL AS agrupador,
    COUNT(*) AS cidades
FROM NTW_OP.REL_CIDADES_PLANEJADO_26
WHERE 1 = 1
{uf_filter}
{municipio_filter}
{regional_filter}
GROUP BY REGIONAL
ORDER BY cidades DESC
"""


# ---------- Vendor por site do plano 26 ----------
# Filosofia:
#   - Casa Nova: agrupa como "A Contratar (Casa Nova)" — site ainda não existe
#   - Casa Existente: usa o vendor dominante do município (best-effort)
#     Se município sem sites cadastrados, cai em "Sem info (Existente)"
#
# DEDUPLICAÇÃO (endereço, não OC): TB_ROLLOUT_ACESSO é no grão de OC — a
# mesma Casa Nova gera 2+ OCs (uma por tecnologia, 4G e 5G separadas), então
# COUNT(*) inflava o número (~2171 OCs vs ~1000 endereços reais, conferido
# contra TB_NEXUS_CN_CE: 755 CN 4G + 245 CN 5G). Contamos endereços únicos
# por (COD_IBGE, ID_MASTER_PIVOT) — mesma chave que o rateio do Orçamento
# já usa pra não colapsar OCs do mesmo endereço.

R2_VENDORS_NEW_SITES = """
WITH ROLLOUT_2026 AS (
    SELECT
        r.ORDEM_COMPLEXA,
        r.COD_IBGE,
        TO_CHAR(r.COD_IBGE) || '-' || NVL(TO_CHAR(r.ID_MASTER_PIVOT), '0') AS ENDERECO_KEY,
        CASE
            WHEN r.CLASSIFICACAO_CASA IN ('NEW SITE', 'CO SITE CASA NOVA')
            THEN 'NOVA'
            ELSE 'EXISTENTE'
        END AS TIPO_CASA
    FROM NTW_OP.TB_ROLLOUT_ACESSO r
    LEFT JOIN (
        SELECT IBGE, UF, MUNICIPIO, REGIONAL
        FROM NTW_OP.MUNICIPIOS_FECHAMENTO
        WHERE TRUNC(DT_CARGA) = (
            SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
        )
    ) d ON d.IBGE = r.COD_IBGE
    WHERE r.PLANO = :ano
      AND r.STATUS_OC = 'ACTIVATED'
      {uf_filter_d}
      {municipio_filter_d}
      {regional_filter_d}
      {projeto_filter}
),
-- Para cada município, pega o vendor dominante considerando TODOS os REFs
-- (não só o último). Isso corrige o problema do "Sem info" massivo.
ALL_VENDORS AS (
    SELECT
        COD_IBGE,
        COALESCE(
            VENDOR_NR_3500, VENDOR_NR_26000, VENDOR_NR_2600DSS,
            VENDOR_NR_2300, VENDOR_NR_2100DSS, VENDOR_NR_1800DSS, VENDOR_NR_700DSS,
            VENDOR_LTE_2600P, VENDOR_LTE_2600, VENDOR_LTE_2600RS,
            VENDOR_LTE_2300, VENDOR_LTE_2100, VENDOR_LTE_1800,
            VENDOR_LTE_850, VENDOR_LTE_700,
            VENDOR_UMTS_2100, VENDOR_UMTS_850,
            VENDOR_GSM_1800, VENDOR_GSM_900
        ) AS VENDOR
    FROM NTW_MABE.BASE_TB_END_ID_NEW
),
DOMINANT_BY_CITY AS (
    SELECT COD_IBGE, VENDOR
    FROM (
        SELECT
            COD_IBGE,
            UPPER(VENDOR) AS VENDOR,
            ROW_NUMBER() OVER (
                PARTITION BY COD_IBGE
                ORDER BY COUNT(*) DESC
            ) AS rn
        FROM ALL_VENDORS
        WHERE VENDOR IS NOT NULL
        GROUP BY COD_IBGE, UPPER(VENDOR)
    )
    WHERE rn = 1
)
SELECT
    CASE
        WHEN r.TIPO_CASA = 'NOVA'
            THEN 'A Contratar (Casa Nova)'
        WHEN r.TIPO_CASA = 'EXISTENTE' AND d.VENDOR IS NOT NULL
            THEN d.VENDOR || ' (Existente)'
        ELSE 'Sem info (Existente)'
    END AS vendor,
    COUNT(DISTINCT r.ENDERECO_KEY) AS qtd
FROM ROLLOUT_2026 r
LEFT JOIN DOMINANT_BY_CITY d ON d.COD_IBGE = r.COD_IBGE
GROUP BY
    CASE
        WHEN r.TIPO_CASA = 'NOVA'
            THEN 'A Contratar (Casa Nova)'
        WHEN r.TIPO_CASA = 'EXISTENTE' AND d.VENDOR IS NOT NULL
            THEN d.VENDOR || ' (Existente)'
        ELSE 'Sem info (Existente)'
    END
ORDER BY qtd DESC
"""


# ---------- Casa Nova — meta NEXUS, estratificada geograficamente ----------
# TB_NEXUS_CN_CE nesta leitura é a META NACIONAL de endereços por tech
# (CAC aqui = contagem-meta: CN 4G 755 + CN 5G 245 = 1000 endereços novos).
# A tabela em si não tem UF/regional/município — mas o card "Fornecedores
# EoY 26" precisa responder aos filtros da tela, então a meta nacional é
# rateada geograficamente pelo mesmo mecanismo de "Orçamento por
# Tecnologia"/"Endereço por Tecnologia": peso = OCs de Casa Nova do
# rollout dentro do filtro ÷ OCs de Casa Nova do rollout no Brasil
# inteiro (TOTAL_OCS, sem filtro — denominador nunca filtra), por
# tecnologia. Aplicado à meta nacional de cada tech.
R2_CASA_NOVA_NEXUS_RATEIO = """
WITH ROLLOUT_ALL AS (
    -- SEM filtro geográfico: universo completo, denominador do rateio.
    SELECT
        COD_IBGE,
        TECNOLOGIA,
        ID_MASTER_PIVOT,
        COUNT(*) AS NUM_OCS
    FROM NTW_OP.TB_ROLLOUT_ACESSO
    WHERE PLANO = :ano
      AND TECNOLOGIA IN ('4G', '5G')
      AND CLASSIFICACAO_CASA IN ('NEW SITE', 'CO SITE CASA NOVA')
    GROUP BY COD_IBGE, TECNOLOGIA, ID_MASTER_PIVOT
),
TOTAL_OCS AS (
    SELECT TECNOLOGIA, SUM(NUM_OCS) AS TOTAL
    FROM ROLLOUT_ALL
    GROUP BY TECNOLOGIA
),
GEO AS (
    SELECT IBGE, UF, MUNICIPIO, REGIONAL
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
),
ROLLOUT AS (
    -- Só essa camada, que alimenta a soma exibida, recebe o filtro.
    SELECT R.*
    FROM ROLLOUT_ALL R
    LEFT JOIN GEO g ON g.IBGE = R.COD_IBGE
    WHERE 1=1
    {uf_filter_g}
    {municipio_filter_g}
    {regional_filter_g}
),
NEXUS AS (
    SELECT UPPER(TRIM(TECH)) AS TECH, SUM(CAC) AS QTD
    FROM TB_NEXUS_CN_CE
    WHERE UPPER(TRIM(TIPO_CASA)) = 'CN'
    GROUP BY UPPER(TRIM(TECH))
)
SELECT
    R.TECNOLOGIA AS tech,
    SUM(ROUND((R.NUM_OCS / T.TOTAL) * N.QTD, 4)) AS qtd
FROM ROLLOUT R
JOIN TOTAL_OCS T ON T.TECNOLOGIA = R.TECNOLOGIA
JOIN NEXUS N ON N.TECH = R.TECNOLOGIA
GROUP BY R.TECNOLOGIA
ORDER BY R.TECNOLOGIA DESC
"""
# ---------- CAC por projeto (Casa Nova > segmento > projeto, por cenário) ----------
# Substituiu o antigo "Top 10 Projetos" (que contava OCs de
# TB_ROLLOUT_ACESSO por PRIORIDADE). Hierarquia de 3 níveis, igual ao
# pivot que o usuário usa no Excel:
#     DLV_LEVEL_3 (Casa Nova/Existente) > SOURCE_AJUSTADO (TIM/B2B Mobile)
#     > DLV_LEVEL_2 (projeto)
# com as camadas de DLV_LEVEL_1 pivotadas em colunas.
#
# ⚠️ Não trazer SUM(KPI) bruto (todas as camadas de DLV_LEVEL_1) — só
# CAC_5G/CAC_4G/CAC_4G_IN_5G. O bruto incluía "outras camadas" (KPI fora
# desses 3 baldes, concentrado em B2B Mobile — ver histórico no git/
# CLAUDE.md), e o usuário pediu explicitamente pra tirar isso do cálculo
# (jul/26), não só escondido da tela como antes. `total_cac` no service é
# a soma só dessas 3 camadas.
#
# SEM rateio geográfico (decisão do usuário): a view não tem
# IBGE/UF/município, e ratear o CAC por OC aqui não teria significado —
# o peso seria idêntico pra todos os projetos dentro de um mesmo
# (tech, tipo de casa), mudando só a magnitude e nunca a composição. Este
# visual é NACIONAL, por cenário. Não reintroduzir rateio aqui.
#
# ⚠️ TO_CHAR(SOURCE_AJUSTADO): sem isso dá ORA-12704 (character set
# mismatch) no Oracle real. A coluna vem do NEXUS por DB link com
# character set diferente (NVARCHAR2/national), e misturar com literal
# VARCHAR2 num NVL/comparação estoura. TO_CHAR normaliza pro charset do
# banco local e é no-op quando a coluna já é VARCHAR2 — não remover.
#
# VALOR_5G_MM/VALOR_4G_MM: mesmo VALOR_TOTAL do projeto, só que quebrado
# por tech (com "4G in 5G Layers" já somado dentro de 4G) — usadas pelo
# resumo nacional CAPEX 5G x 4G ao lado da tabela (ver
# _resumo_5g_4g/get_r2_cac_por_projeto), não aparecem na tabela por
# projeto (que não mostra mais coluna de valor, só CAC).
R2_CAC_POR_PROJETO = """
WITH BASE AS (
    SELECT
        SCENARIO,
        NVL(KPI, 0) AS KPI,
        NVL(VALOR_TOTAL, 0) AS VALOR_TOTAL,
        CASE
            WHEN UPPER(TRIM(DLV_LEVEL_3)) = 'CASA NOVA' THEN 'CN'
            WHEN UPPER(TRIM(DLV_LEVEL_3)) = 'CASA EXISTENTE' THEN 'CE'
        END AS TIPO_CASA,
        NVL(TO_CHAR(SOURCE_AJUSTADO), 'NAO INFORMADO') AS SEGMENTO,
        NVL(DLV_LEVEL_2, 'N/A') AS PROJETO,
        CASE
            WHEN UPPER(TRIM(DLV_LEVEL_1)) = '5G LAYERS' THEN 'L5G'
            WHEN UPPER(TRIM(DLV_LEVEL_1)) = '4G LAYERS' THEN 'L4G'
            WHEN UPPER(TRIM(DLV_LEVEL_1)) IN ('4G IN 5G LAYERS', '4G/5G LAYERS')
                THEN 'L4G5G'
            ELSE 'OUTRAS'
        END AS CAMADA
    FROM VW_CAPEX_MASTER_FULL@NEXUS_LINK
    WHERE UPPER(TRIM(PRIORIDADE)) = 'IMPRESCINDÍVEL'
      AND UPPER(TRIM(LAYER_SUBAREA)) = 'MOBILE ACCESS'
      AND DLV_LEVEL_3 IS NOT NULL
      AND UPPER(TRIM(DLV_LEVEL_3)) IN ('CASA NOVA', 'CASA EXISTENTE')
)
SELECT
    SCENARIO,
    TIPO_CASA,
    SEGMENTO,
    PROJETO,
    SUM(CASE WHEN CAMADA = 'L5G' THEN KPI ELSE 0 END) AS CAC_5G,
    SUM(CASE WHEN CAMADA = 'L4G' THEN KPI ELSE 0 END) AS CAC_4G,
    SUM(CASE WHEN CAMADA = 'L4G5G' THEN KPI ELSE 0 END) AS CAC_4G_IN_5G,
    -- Usadas só no resumo CAPEX 5G x 4G (ao lado da tabela) — "4G in 5G
    -- Layers" entra dentro de 4G lá, então o valor já vem somado aqui.
    ROUND(SUM(CASE WHEN CAMADA = 'L5G' THEN VALOR_TOTAL ELSE 0 END) / 1000000, 2) AS VALOR_5G_MM,
    ROUND(SUM(CASE WHEN CAMADA IN ('L4G', 'L4G5G') THEN VALOR_TOTAL ELSE 0 END) / 1000000, 2) AS VALOR_4G_MM
FROM BASE
WHERE TIPO_CASA IS NOT NULL
GROUP BY
    SCENARIO,
    TIPO_CASA,
    SEGMENTO,
    PROJETO
ORDER BY
    SCENARIO,
    CASE TIPO_CASA WHEN 'CN' THEN 1 WHEN 'CE' THEN 2 ELSE 3 END,
    SEGMENTO,
    PROJETO
"""

# ---------- Cidades 5G por regional (fechamento 26 = base 25 + ganho 26) ----------
# ganho_26 = cidades do PLANO (REL_CIDADES_PLANEJADO_26), não "quem já
# ativou no ano" — MES_DIV_5G só tem data REALIZADA (mesmo bug do
# velocímetro 5G: cidade ainda não ativada não tem linha com data futura,
# então `MES_DIV_5G BETWEEN plan_start AND plan_end` só pega o YTD e o
# total colava no YTD, não no alvo do plano). Guard (MES_DIV_5G IS NULL OR
# > baseline_date) evita contar 2x quem já era 5G antes do plano.
#   - base_25:  cidades com 5G ANTES do plano (MES_DIV_5G <= 2025-12-31)
#   - ganho_26: cidades do plano ainda não em base_25

R3_TOTAL_CITIES_BY_REGIONAL = """
SELECT
    REGIONAL AS agrupador,
    SUM(CASE
        WHEN MES_DIV_5G IS NOT NULL AND MES_DIV_5G <= :baseline_date
        THEN 1 ELSE 0
    END) AS base_25,
    SUM(CASE
        WHEN IBGE IN (SELECT IBGE FROM NTW_OP.REL_CIDADES_PLANEJADO_26)
         AND (MES_DIV_5G IS NULL OR MES_DIV_5G > :baseline_date)
        THEN 1 ELSE 0
    END) AS ganho_26
FROM NTW_OP.MUNICIPIOS_FECHAMENTO
WHERE TRUNC(DT_CARGA) = (
    SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
)
AND REGIONAL IS NOT NULL
{uf_filter}
{municipio_filter}
{regional_filter}
GROUP BY REGIONAL
ORDER BY base_25 + ganho_26 DESC
"""


# ---------------------------------------------------------------------------
# Anos disponíveis (filtro "Ano" do Resumo) — migrada do módulo Plano
# ---------------------------------------------------------------------------

YEARS_QUERY = """
SELECT DISTINCT PLANO AS ANO
FROM NTW_OP.TB_ROLLOUT_ACESSO
WHERE PLANO IS NOT NULL
ORDER BY ANO DESC
"""

# ---------------------------------------------------------------------------
# RAIA 2 — Financeiro (NEXUS)
# ---------------------------------------------------------------------------

# ---------- Orçamento por Tecnologia ----------
# Rateia CAPEX/OPEX+LEASE do plano proporcionalmente ao nº de OCs de cada
# (município, pivot). A query original agrupava só por (COD_IBGE,
# ID_MASTER_PIVOT), perdendo a tecnologia no resultado — adicionamos
# R.TECNOLOGIA ao agrupamento (mesma fórmula de rateio, só não colapsa a
# tecnologia antes da hora) pra render um gráfico "por tecnologia" de
# verdade. O denominador T.TOTAL continua sendo a soma geral de OCs.
R2_ORCAMENTO_POR_TECNOLOGIA = """
WITH ROLLOUT_ALL AS (
    -- SEM filtro geográfico: é o universo completo que forma o
    -- denominador do rateio — filtrar aqui inflaria a fatia de quem
    -- ficou de fora do filtro.
    SELECT
        COD_IBGE,
        TECNOLOGIA,
        PRIORIDADE,
        ID_MASTER_PIVOT,
        COUNT(*) AS NUM_OCS
    FROM NTW_OP.TB_ROLLOUT_ACESSO
    WHERE PLANO = :ano
      AND TECNOLOGIA IN ('4G', '5G')
    GROUP BY
        COD_IBGE,
        TECNOLOGIA,
        PRIORIDADE,
        ID_MASTER_PIVOT
),
TOTAL_OCS AS (
    SELECT SUM(NUM_OCS) AS TOTAL
    FROM ROLLOUT_ALL
),
GEO AS (
    SELECT IBGE, UF, MUNICIPIO, REGIONAL
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
),
ROLLOUT AS (
    -- Só essa camada, que alimenta a soma exibida, recebe o filtro.
    SELECT R.*
    FROM ROLLOUT_ALL R
    LEFT JOIN GEO g ON g.IBGE = R.COD_IBGE
    WHERE 1=1
    {uf_filter_g}
    {municipio_filter_g}
    {regional_filter_g}
    {projeto_filter}
),
FINANCEIRO AS (
    SELECT
        UPPER(TIPO) AS TIPO,
        SUM(VALOR_TOTAL) AS VALOR_TOTAL
    FROM TB_NEXUS_FINANCEIRO
    WHERE UPPER(TIPO) IN ('CAPEX', 'OPEX', 'LEASE')
    GROUP BY
        UPPER(TIPO)
)
SELECT
    R.TECNOLOGIA AS TECH,
    F.TIPO,
    CASE WHEN F.TIPO = 'CAPEX' THEN 'CAPEX' ELSE 'OPEX/LEASE' END AS GRUPO,
    SUM(ROUND((R.NUM_OCS / T.TOTAL) * (F.VALOR_TOTAL / 1000000), 6)) AS VALOR
FROM ROLLOUT R
CROSS JOIN TOTAL_OCS T
CROSS JOIN FINANCEIRO F
GROUP BY R.TECNOLOGIA, F.TIPO
ORDER BY R.TECNOLOGIA, F.TIPO
"""


# ---------- Endereço por Tecnologia ----------
# CAC rateado por OC entre Casa Nova (CN) e Casa Existente (CE), por
# tecnologia E por CENÁRIO — numerador/denominador do rateio seguem
# vindo de TB_ROLLOUT_ACESSO (mesma lógica de sempre, ver
# R2_ORCAMENTO_POR_TECNOLOGIA); só o CAC total por (tech, tipo_casa) que
# passou a vir de VW_CAPEX_MASTER_FULL@NEXUS_LINK em vez de
# TB_NEXUS_CN_CE. Como o rollout não tem dimensão de cenário, o mesmo
# peso geográfico (NUM_OCS/TOTAL_OCS_GRUPO) é aplicado a cada cenário —
# o JOIN com CAPEX_CAC (uma linha por cenário) faz esse "fan-out"
# naturalmente: cada linha de rollout vira N linhas (uma por cenário),
# cada uma multiplicada pelo CAC_TOTAL daquele cenário específico.
R2_ENDERECO_POR_TECNOLOGIA = """
WITH ROLLOUT_REFERENCIA_ALL AS (
    -- Sem filtro geográfico: universo completo, denominador do rateio.
    SELECT
        R.COD_IBGE,
        CASE
            WHEN UPPER(R.TECNOLOGIA) LIKE '%5G%' THEN '5G'
            WHEN UPPER(R.TECNOLOGIA) LIKE '%NR%' THEN '5G'
            ELSE '4G'
        END AS TECH,
        CASE
            WHEN UPPER(R.CLASSIFICACAO_CASA) LIKE '%NEW SITE%' THEN 'CN'
            ELSE 'CE'
        END AS TIPO_CASA,
        R.PRIORIDADE,
        R.ID_MASTER_PIVOT,
        COUNT(1) AS NUM_OCS
    FROM NTW_OP.TB_ROLLOUT_ACESSO R
    WHERE R.PLANO = :ano
      AND R.TECNOLOGIA IN ('4G', '5G')
    GROUP BY
        R.COD_IBGE,
        CASE
            WHEN UPPER(R.TECNOLOGIA) LIKE '%5G%' THEN '5G'
            WHEN UPPER(R.TECNOLOGIA) LIKE '%NR%' THEN '5G'
            ELSE '4G'
        END,
        CASE
            WHEN UPPER(R.CLASSIFICACAO_CASA) LIKE '%NEW SITE%' THEN 'CN'
            ELSE 'CE'
        END,
        R.PRIORIDADE,
        R.ID_MASTER_PIVOT
),
GEO AS (
    SELECT IBGE, UF, MUNICIPIO, REGIONAL
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
),
ROLLOUT_REFERENCIA AS (
    SELECT RR.*
    FROM ROLLOUT_REFERENCIA_ALL RR
    LEFT JOIN GEO g ON g.IBGE = RR.COD_IBGE
    WHERE 1=1
    {uf_filter_g}
    {municipio_filter_g}
    {regional_filter_g}
    {projeto_filter}
),
CAPEX_BASE AS (
    SELECT
        SCENARIO,
        KPI,
        CASE
            WHEN DLV_LEVEL_3 = 'CASA NOVA' THEN 'CN'
            WHEN DLV_LEVEL_3 = 'CASA EXISTENTE' THEN 'CE'
        END AS TIPO_CASA,
        CASE
            WHEN DLV_LEVEL_1 IN ('4G LAYERS', '4G/5G LAYERS')
                THEN '4G'
            -- TO_CHAR: sem isso dá ORA-12704 (character set mismatch) —
            -- essas colunas vêm do NEXUS por DB link com charset
            -- diferente, e comparar com literal VARCHAR2 estoura.
            WHEN TO_CHAR(TAG_2) IN (
                'ROLLOUT - RQUAL',
                'ROLLOUT - EVENTOS SAZONAIS',
                'ROLLOUT - OBLIGATION 2.3GHZ',
                'PLATAFORMA IPSEC',
                'ROLLOUT ACESSO - RQUAL',
                'OBRIGAÇÃO 2.3GHZ',
                'EVENTOS SAZONAIS'
            )
                THEN '4G'
            WHEN TO_CHAR(SOURCE_AJUSTADO) = 'B2B MOBILE IOT'
                THEN '4G'
            ELSE '5G'
        END AS TECH
    FROM VW_CAPEX_MASTER_FULL@NEXUS_LINK
    WHERE PRIORIDADE = 'IMPRESCINDÍVEL'
),
CAPEX_CAC AS (
    SELECT
        SCENARIO,
        UPPER(TRIM(TECH)) AS TECH,
        UPPER(TRIM(TIPO_CASA)) AS TIPO_CASA,
        SUM(NVL(KPI, 0)) AS CAC_TOTAL
    FROM CAPEX_BASE
    WHERE TIPO_CASA IS NOT NULL
    GROUP BY SCENARIO, UPPER(TRIM(TECH)), UPPER(TRIM(TIPO_CASA))
),
TOTAL_OCS_GRUPO_ALL AS (
    -- Denominador do rateio: sempre o universo completo (sem filtro
    -- geográfico) — senão filtrar por UF faria aquele recorte "herdar"
    -- 100% do orçamento nacional do grupo.
    SELECT TECH, TIPO_CASA, SUM(NUM_OCS) AS TOTAL_OCS_GRUPO
    FROM ROLLOUT_REFERENCIA_ALL
    GROUP BY TECH, TIPO_CASA
),
BASE_RATEIO AS (
    SELECT
        RR.COD_IBGE,
        RR.TECH,
        RR.TIPO_CASA,
        RR.ID_MASTER_PIVOT,
        RR.NUM_OCS,
        N.SCENARIO,
        N.CAC_TOTAL,
        G.TOTAL_OCS_GRUPO
    FROM ROLLOUT_REFERENCIA RR
    INNER JOIN CAPEX_CAC N
        ON N.TECH = RR.TECH
       AND N.TIPO_CASA = RR.TIPO_CASA
    INNER JOIN TOTAL_OCS_GRUPO_ALL G
        ON G.TECH = RR.TECH
       AND G.TIPO_CASA = RR.TIPO_CASA
),
ROLLOUT_CE_CN AS (
    SELECT
        SCENARIO,
        TECH,
        TIPO_CASA AS CLASSIFICACAO,
        CASE
            WHEN TOTAL_OCS_GRUPO = 0 THEN 0
            ELSE CAC_TOTAL * (NUM_OCS / TOTAL_OCS_GRUPO)
        END AS VALOR
    FROM BASE_RATEIO
)
SELECT
    SCENARIO,
    TECH,
    CLASSIFICACAO,
    SUM(VALOR) AS VALOR
FROM ROLLOUT_CE_CN
GROUP BY SCENARIO, TECH, CLASSIFICACAO
ORDER BY SCENARIO, TECH, CLASSIFICACAO
"""

