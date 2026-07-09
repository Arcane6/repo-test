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


# ===========================================================================
# RAIA 1 — FECHAMENTO 25 (baseline até 31/dez do ano-1)
# ===========================================================================

# ---------- Sites por tecnologia (fechamento 25) ----------
# Fonte: TB_FT_BASE_UNICA_SITES + regra:
#   pega o último MES_REF ≤ baseline_date
#   agrupa por tecnologia via LIKE (a coluna vem "2G/3G/4G/5G")

R1_SITES_BY_TECH = """
WITH BASE AS (
    SELECT END_ID, UF, MUNICIPIO, TECNOLOGIA
    FROM NTW_OP.TB_FT_BASE_UNICA_SITES
    WHERE MES_REF = (
        SELECT MAX(MES_REF)
        FROM NTW_OP.TB_FT_BASE_UNICA_SITES
        WHERE MES_REF <= :baseline_date
    )
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
    SUM(CASE WHEN TECNOLOGIA LIKE '%2G%' THEN 1 ELSE 0 END) AS sites_2g,
    SUM(CASE WHEN TECNOLOGIA LIKE '%3G%' THEN 1 ELSE 0 END) AS sites_3g,
    SUM(CASE WHEN TECNOLOGIA LIKE '%4G%' THEN 1 ELSE 0 END) AS sites_4g,
    SUM(CASE WHEN TECNOLOGIA LIKE '%5G%' THEN 1 ELSE 0 END) AS sites_5g,
    COUNT(DISTINCT END_ID) AS total_sites
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

R1_VENDORS = """
WITH BASE AS (
    SELECT
        END_ID, UF, MUNICIPIO, ANF,
        -- Cascata 5G (maior banda primeiro): 3500 > 26000 > 2600 > 2300 > 2100 > 1800 > 700
        COALESCE(
            VENDOR_NR_3500, VENDOR_NR_26000, VENDOR_NR_2600DSS,
            VENDOR_NR_2300, VENDOR_NR_2100DSS, VENDOR_NR_1800DSS, VENDOR_NR_700DSS
        ) AS VENDOR_5G,
        -- Cascata 4G: 2600P > 2600 > 2300 > 2100 > 1800 > 850 > 700
        COALESCE(
            VENDOR_LTE_2600P, VENDOR_LTE_2600, VENDOR_LTE_2600RS,
            VENDOR_LTE_2300, VENDOR_LTE_2100, VENDOR_LTE_1800,
            VENDOR_LTE_850, VENDOR_LTE_700
        ) AS VENDOR_4G,
        -- Cascata 3G: 2100 > 850
        COALESCE(VENDOR_UMTS_2100, VENDOR_UMTS_850) AS VENDOR_3G,
        -- Cascata 2G: 1800 > 900
        COALESCE(VENDOR_GSM_1800, VENDOR_GSM_900) AS VENDOR_2G
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
    {uf_filter}
    {municipio_filter}
),
VENDOR_FINAL AS (
    SELECT
        END_ID, UF, MUNICIPIO,
        COALESCE(VENDOR_5G, VENDOR_4G, VENDOR_3G, VENDOR_2G) AS VENDOR
    FROM BASE
    WHERE VENDOR_5G IS NOT NULL
       OR VENDOR_4G IS NOT NULL
       OR VENDOR_3G IS NOT NULL
       OR VENDOR_2G IS NOT NULL
),
GEO AS (
    SELECT UF, MUNICIPIO, REGIONAL
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
)
SELECT
    UPPER(v.VENDOR) AS vendor,
    COUNT(*) AS qtd
FROM VENDOR_FINAL v
LEFT JOIN GEO g ON g.UF = v.UF AND UPPER(g.MUNICIPIO) = UPPER(v.MUNICIPIO)
WHERE 1=1
{regional_filter}
GROUP BY UPPER(v.VENDOR)
ORDER BY qtd DESC
"""


# ===========================================================================
# RAIA 2 — PLANO 26 (só o delta do ano)
# ===========================================================================

# ---------- Sites por tecnologia (plano 26) ----------
# Fonte: TB_ROLLOUT_ACESSO 2026 ACTIVATED, agrupado por tecnologia

R2_SITES_BY_TECH = """
SELECT
    -- Casa Nova = NEW SITE + CO SITE CASA NOVA
    SUM(CASE WHEN UPPER(REPLACE(REPLACE(r.TECNOLOGIA,'"',''),'''','')) = '2G'
              AND r.CLASSIFICACAO_CASA IN ('NEW SITE', 'CO SITE CASA NOVA')
             THEN 1 ELSE 0 END) AS nova_2g,
    SUM(CASE WHEN UPPER(REPLACE(REPLACE(r.TECNOLOGIA,'"',''),'''','')) = '3G'
              AND r.CLASSIFICACAO_CASA IN ('NEW SITE', 'CO SITE CASA NOVA')
             THEN 1 ELSE 0 END) AS nova_3g,
    SUM(CASE WHEN UPPER(REPLACE(REPLACE(r.TECNOLOGIA,'"',''),'''','')) = '4G'
              AND r.CLASSIFICACAO_CASA IN ('NEW SITE', 'CO SITE CASA NOVA')
             THEN 1 ELSE 0 END) AS nova_4g,
    SUM(CASE WHEN UPPER(REPLACE(REPLACE(r.TECNOLOGIA,'"',''),'''','')) = '5G'
              AND r.CLASSIFICACAO_CASA IN ('NEW SITE', 'CO SITE CASA NOVA')
             THEN 1 ELSE 0 END) AS nova_5g,
    -- Casa Existente = tudo que não é nova (upgrade em site que já existe)
    SUM(CASE WHEN UPPER(REPLACE(REPLACE(r.TECNOLOGIA,'"',''),'''','')) = '2G'
              AND (r.CLASSIFICACAO_CASA IS NULL
                   OR r.CLASSIFICACAO_CASA NOT IN ('NEW SITE', 'CO SITE CASA NOVA'))
             THEN 1 ELSE 0 END) AS existente_2g,
    SUM(CASE WHEN UPPER(REPLACE(REPLACE(r.TECNOLOGIA,'"',''),'''','')) = '3G'
              AND (r.CLASSIFICACAO_CASA IS NULL
                   OR r.CLASSIFICACAO_CASA NOT IN ('NEW SITE', 'CO SITE CASA NOVA'))
             THEN 1 ELSE 0 END) AS existente_3g,
    SUM(CASE WHEN UPPER(REPLACE(REPLACE(r.TECNOLOGIA,'"',''),'''','')) = '4G'
              AND (r.CLASSIFICACAO_CASA IS NULL
                   OR r.CLASSIFICACAO_CASA NOT IN ('NEW SITE', 'CO SITE CASA NOVA'))
             THEN 1 ELSE 0 END) AS existente_4g,
    SUM(CASE WHEN UPPER(REPLACE(REPLACE(r.TECNOLOGIA,'"',''),'''','')) = '5G'
              AND (r.CLASSIFICACAO_CASA IS NULL
                   OR r.CLASSIFICACAO_CASA NOT IN ('NEW SITE', 'CO SITE CASA NOVA'))
             THEN 1 ELSE 0 END) AS existente_5g,
    COUNT(*) AS total_sites
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
"""

# ---------- Novas cidades por regional (ANF) — plano 26 ----------
# Fonte: MUNICIPIOS_FECHAMENTO com MES_DIV_5G no ano-plano
# Foca 5G (que é onde há expansão real de cidades)

R2_NEW_CITIES_BY_ANF = """
SELECT
    REGIONAL AS agrupador,
    COUNT(DISTINCT IBGE) AS cidades
FROM NTW_OP.MUNICIPIOS_FECHAMENTO
WHERE TRUNC(DT_CARGA) = (
    SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
)
AND MES_DIV_5G BETWEEN :plan_start AND :plan_end
AND REGIONAL IS NOT NULL
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
# Total do donut = total do card "Sites por Tecnologia"

R2_VENDORS_NEW_SITES = """
WITH ROLLOUT_2026 AS (
    SELECT
        r.ORDEM_COMPLEXA,
        r.COD_IBGE,
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
    COUNT(*) AS qtd
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
# ---------- Top 10 projetos (plano 26) ----------
# Fonte: TB_ROLLOUT_ACESSO GROUP BY PRIORIDADE

R2_TOP_PROJECTS = """
SELECT
    r.PRIORIDADE,
    COUNT(*) AS qtd
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
  AND r.PRIORIDADE IS NOT NULL
  {uf_filter_d}
  {municipio_filter_d}
  {regional_filter_d}
  {projeto_filter}
GROUP BY r.PRIORIDADE
ORDER BY qtd DESC
FETCH FIRST 10 ROWS ONLY
"""

# ---------- Cidades 5G por regional (fechamento 26 = base 25 + ganho 26) ----------
# Retorna 3 colunas por regional:
#   - base_25:  cidades com 5G ANTES do plano (MES_DIV_5G <= 2025-12-31)
#   - ganho_26: cidades com 5G no ANO do plano (MES_DIV_5G entre plan_start/end)
#   - total:    base_25 + ganho_26

R3_TOTAL_CITIES_BY_REGIONAL = """
SELECT
    REGIONAL AS agrupador,
    SUM(CASE
        WHEN MES_DIV_5G IS NOT NULL AND MES_DIV_5G <= :baseline_date
        THEN 1 ELSE 0
    END) AS base_25,
    SUM(CASE
        WHEN MES_DIV_5G BETWEEN :plan_start AND :plan_end
        THEN 1 ELSE 0
    END) AS ganho_26,
    SUM(CASE
        WHEN MES_DIV_5G IS NOT NULL AND MES_DIV_5G <= :plan_end
        THEN 1 ELSE 0
    END) AS total
FROM NTW_OP.MUNICIPIOS_FECHAMENTO
WHERE TRUNC(DT_CARGA) = (
    SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
)
AND REGIONAL IS NOT NULL
{uf_filter}
{municipio_filter}
{regional_filter}
GROUP BY REGIONAL
HAVING SUM(CASE WHEN MES_DIV_5G IS NOT NULL AND MES_DIV_5G <= :plan_end THEN 1 ELSE 0 END) > 0
ORDER BY total DESC
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
# CAC (custo de aquisição) rateado por OC entre Casa Nova (CN) e Casa
# Existente (CE), por tecnologia — fonte TB_NEXUS_CN_CE.
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
NEXUS_CN_CE AS (
    SELECT
        UPPER(TRIM(TECH)) AS TECH,
        UPPER(TRIM(TIPO_CASA)) AS TIPO_CASA,
        SUM(CAC) AS CAC_TOTAL
    FROM TB_NEXUS_CN_CE
    GROUP BY
        UPPER(TRIM(TECH)),
        UPPER(TRIM(TIPO_CASA))
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
        N.CAC_TOTAL,
        G.TOTAL_OCS_GRUPO
    FROM ROLLOUT_REFERENCIA RR
    INNER JOIN NEXUS_CN_CE N
        ON N.TECH = RR.TECH
       AND N.TIPO_CASA = RR.TIPO_CASA
    INNER JOIN TOTAL_OCS_GRUPO_ALL G
        ON G.TECH = RR.TECH
       AND G.TIPO_CASA = RR.TIPO_CASA
),
ROLLOUT_CE_CN AS (
    SELECT
        COD_IBGE,
        TECH,
        TIPO_CASA AS CLASSIFICACAO,
        ID_MASTER_PIVOT,
        CASE
            WHEN TOTAL_OCS_GRUPO = 0 THEN 0
            ELSE CAC_TOTAL * (NUM_OCS / TOTAL_OCS_GRUPO)
        END AS VALOR
    FROM BASE_RATEIO
)
SELECT
    TECH,
    CLASSIFICACAO,
    SUM(VALOR) AS VALOR
FROM ROLLOUT_CE_CN
GROUP BY TECH, CLASSIFICACAO
ORDER BY TECH, CLASSIFICACAO
"""


# ---------- Fornecedores do plano, ponderados pelo CAC do NEXUS ----------
# Mesmo rateio de CAC da query acima (Casa Nova / Casa Existente por
# tecnologia), mas a fatia "Casa Existente" é quebrada pelo fornecedor
# dominante de cada município (mesma lógica de R2_VENDORS_NEW_SITES) —
# o tamanho de cada fatia no gráfico passa a refletir R$, não OC bruta.
R2_VENDORS_NEXUS = """
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
NEXUS_CN_CE AS (
    SELECT
        UPPER(TRIM(TECH)) AS TECH,
        UPPER(TRIM(TIPO_CASA)) AS TIPO_CASA,
        SUM(CAC) AS CAC_TOTAL
    FROM TB_NEXUS_CN_CE
    GROUP BY
        UPPER(TRIM(TECH)),
        UPPER(TRIM(TIPO_CASA))
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
        N.CAC_TOTAL,
        G.TOTAL_OCS_GRUPO
    FROM ROLLOUT_REFERENCIA RR
    INNER JOIN NEXUS_CN_CE N
        ON N.TECH = RR.TECH
       AND N.TIPO_CASA = RR.TIPO_CASA
    INNER JOIN TOTAL_OCS_GRUPO_ALL G
        ON G.TECH = RR.TECH
       AND G.TIPO_CASA = RR.TIPO_CASA
),
VALOR_POR_SITE AS (
    SELECT
        COD_IBGE,
        TIPO_CASA,
        CASE
            WHEN TOTAL_OCS_GRUPO = 0 THEN 0
            ELSE CAC_TOTAL * (NUM_OCS / TOTAL_OCS_GRUPO)
        END AS VALOR
    FROM BASE_RATEIO
),
-- Fornecedor dominante por município (mesma regra de R2_VENDORS_NEW_SITES)
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
        WHEN v.TIPO_CASA = 'CN' THEN 'A Contratar (Casa Nova)'
        WHEN d.VENDOR IS NOT NULL THEN d.VENDOR || ' (Existente)'
        ELSE 'Sem info (Existente)'
    END AS vendor,
    SUM(v.VALOR) AS valor
FROM VALOR_POR_SITE v
LEFT JOIN DOMINANT_BY_CITY d ON d.COD_IBGE = v.COD_IBGE
GROUP BY
    CASE
        WHEN v.TIPO_CASA = 'CN' THEN 'A Contratar (Casa Nova)'
        WHEN d.VENDOR IS NOT NULL THEN d.VENDOR || ' (Existente)'
        ELSE 'Sem info (Existente)'
    END
ORDER BY valor DESC
"""
