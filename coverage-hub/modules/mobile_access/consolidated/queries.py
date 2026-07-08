"""
Queries SQL para a aba "Consolidado" (Rede + Plano).

Fonte única de verdade para o Gap:
    NTW_OP.MUNICIPIOS_FECHAMENTO (última carga), com a coluna MES_DIV_XG:
        - Baseline (EoY-1) = MES_DIV_XG <= 31/dez do ano anterior
        - Plano do ano     = MES_DIV_XG entre 01/jan e 31/dez do ano
        - YTD              = PRESENCA_XG = 1 hoje
        - Projetado        = Baseline + Plano

Fontes complementares (só nos velocímetros):
    - NTW_OP.TB_ROLLOUT_ACESSO       → plano de sites 5G
    - NTW_OP.TB_FT_BASE_UNICA_SITES  → sites 5G ativos

Filtros dinâmicos globais:
    - Ano                (obrigatório, default 2026)
    - UF, Município      (opcionais)
    - include_closed     (só nos velocímetros; aceita CLOSED no plano)
    - include_ops        (só nos velocímetros; mantém SWAP/DECOMMISSIONING)

Notas:
    - O gap 5G reporta 138 municípios como "plano do ano" (todos com MES_DIV_5G
      entre jan-dez do ano corrente). Divergências vs planilhas externas do
      time de planejamento (ex.: 134 do PBI executivo) podem existir por curadoria
      manual fora do banco. Fonte única aqui é o campo MES_DIV_5G.
"""


# ---------------------------------------------------------------------------
# CTE base do gap: só MUNICIPIOS_FECHAMENTO, com flags de baseline e plano
# derivadas de MES_DIV_XG
# ---------------------------------------------------------------------------
#
# Placeholders substituídos em service.py:
#   {uf_filter}         -> AND UF IN (...)
#   {municipio_filter}  -> AND MUNICIPIO IN (...)
#
# Binds necessários (setados em service.py):
#   :baseline_date  -> 31/dez do ano-1
#   :plan_start     -> 01/jan do ano
#   :plan_end       -> 31/dez do ano
# ---------------------------------------------------------------------------

BASE_CTE_TEMPLATE = """
WITH BASE AS (
    SELECT
        IBGE, UF, MUNICIPIO,
        NVL(PRESENCA, 0)    AS TIM_HOJE,
        NVL(PRESENCA_2G, 0) AS HAS_2G_RAW,
        NVL(PRESENCA_3G, 0) AS HAS_3G_RAW,
        NVL(PRESENCA_4G, 0) AS HAS_4G_RAW,
        NVL(PRESENCA_5G, 0) AS HAS_5G_RAW,
        MES_DIV_2G, MES_DIV_3G, MES_DIV_4G, MES_DIV_5G,
        -- BASELINE: tinha a tec até o fim do ano-1
        CASE WHEN MES_DIV_2G IS NOT NULL AND MES_DIV_2G <= :baseline_date THEN 1 ELSE 0 END AS HAD_2G_BASELINE,
        CASE WHEN MES_DIV_3G IS NOT NULL AND MES_DIV_3G <= :baseline_date THEN 1 ELSE 0 END AS HAD_3G_BASELINE,
        CASE WHEN MES_DIV_4G IS NOT NULL AND MES_DIV_4G <= :baseline_date THEN 1 ELSE 0 END AS HAD_4G_BASELINE,
        CASE WHEN MES_DIV_5G IS NOT NULL AND MES_DIV_5G <= :baseline_date THEN 1 ELSE 0 END AS HAD_5G_BASELINE,
        -- ATIVO HOJE: tec liberada até o mês corrente (não conta datas futuras!)
        CASE WHEN MES_DIV_2G IS NOT NULL AND MES_DIV_2G <= :today_date THEN 1 ELSE 0 END AS HAS_2G,
        CASE WHEN MES_DIV_3G IS NOT NULL AND MES_DIV_3G <= :today_date THEN 1 ELSE 0 END AS HAS_3G,
        CASE WHEN MES_DIV_4G IS NOT NULL AND MES_DIV_4G <= :today_date THEN 1 ELSE 0 END AS HAS_4G,
        CASE WHEN MES_DIV_5G IS NOT NULL AND MES_DIV_5G <= :today_date THEN 1 ELSE 0 END AS HAS_5G,
        -- PLANO DO ANO: MES_DIV dentro do ano corrente (inclui já ativados + futuros)
        CASE WHEN MES_DIV_2G BETWEEN :plan_start AND :plan_end THEN 1 ELSE 0 END AS PLAN_2G,
        CASE WHEN MES_DIV_3G BETWEEN :plan_start AND :plan_end THEN 1 ELSE 0 END AS PLAN_3G,
        CASE WHEN MES_DIV_4G BETWEEN :plan_start AND :plan_end THEN 1 ELSE 0 END AS PLAN_4G,
        CASE WHEN MES_DIV_5G BETWEEN :plan_start AND :plan_end THEN 1 ELSE 0 END AS PLAN_5G
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
    {uf_filter}
    {municipio_filter}
)
"""

# ---------------------------------------------------------------------------
# GAP ANALYSIS — Baseline vs Atual vs Projetado por tecnologia
# ---------------------------------------------------------------------------
#
# Regra:
#   baseline  = cidades com a tec no fim do ano-1
#   atual     = cidades com PRESENCA_XG = 1 hoje
#   ganho     = cidades com MES_DIV_XG dentro do ano do plano
#   projetado = baseline + ganho
# ---------------------------------------------------------------------------

GAP_QUERY = """
SELECT
    COUNT(*) AS total_municipios,

    -- Baseline (EoY do ano anterior)
    SUM(HAD_2G_BASELINE) AS baseline_2g,
    SUM(HAD_3G_BASELINE) AS baseline_3g,
    SUM(HAD_4G_BASELINE) AS baseline_4g,
    SUM(HAD_5G_BASELINE) AS baseline_5g,

    -- Atual (YTD)
    SUM(HAS_2G) AS atual_2g,
    SUM(HAS_3G) AS atual_3g,
    SUM(HAS_4G) AS atual_4g,
    SUM(HAS_5G) AS atual_5g,

    -- Plano (MES_DIV dentro do ano)
    SUM(PLAN_2G) AS ganho_2g,
    SUM(PLAN_3G) AS ganho_3g,
    SUM(PLAN_4G) AS ganho_4g,
    SUM(PLAN_5G) AS ganho_5g,

    -- Projetado = Baseline + Plano
    SUM(HAD_2G_BASELINE) + SUM(PLAN_2G) AS proj_2g,
    SUM(HAD_3G_BASELINE) + SUM(PLAN_3G) AS proj_3g,
    SUM(HAD_4G_BASELINE) + SUM(PLAN_4G) AS proj_4g,
    SUM(HAD_5G_BASELINE) + SUM(PLAN_5G) AS proj_5g
FROM BASE
"""


# ---------------------------------------------------------------------------
# DELTA POR UF — Ganhos do ano agrupados por UF
# ---------------------------------------------------------------------------
#
# Ganho por UF/tec = municípios que ganharam a tec desde o baseline.
#   - Se HAS=1 e HAD_BASELINE=0 → ganho já entregue (ativado no ano)
#   - Se PLAN=1                 → ganho planejado (pode ou não ter sido entregue)
#
# Usamos OR pra pegar ambos, com CASE ganho binário (não soma cidade 2x).
# Alinha com o "Ganho FY" do velocímetro.
# ---------------------------------------------------------------------------

DELTA_BY_UF_QUERY = """
SELECT
    UF,

    SUM(CASE WHEN (HAS_2G=1 AND HAD_2G_BASELINE=0) OR PLAN_2G=1 THEN 1 ELSE 0 END) AS ganho_2g,
    SUM(CASE WHEN (HAS_3G=1 AND HAD_3G_BASELINE=0) OR PLAN_3G=1 THEN 1 ELSE 0 END) AS ganho_3g,
    SUM(CASE WHEN (HAS_4G=1 AND HAD_4G_BASELINE=0) OR PLAN_4G=1 THEN 1 ELSE 0 END) AS ganho_4g,
    SUM(CASE WHEN (HAS_5G=1 AND HAD_5G_BASELINE=0) OR PLAN_5G=1 THEN 1 ELSE 0 END) AS ganho_5g,

    SUM(CASE WHEN (HAS_2G=1 AND HAD_2G_BASELINE=0) OR PLAN_2G=1 THEN 1 ELSE 0 END)
      + SUM(CASE WHEN (HAS_3G=1 AND HAD_3G_BASELINE=0) OR PLAN_3G=1 THEN 1 ELSE 0 END)
      + SUM(CASE WHEN (HAS_4G=1 AND HAD_4G_BASELINE=0) OR PLAN_4G=1 THEN 1 ELSE 0 END)
      + SUM(CASE WHEN (HAS_5G=1 AND HAD_5G_BASELINE=0) OR PLAN_5G=1 THEN 1 ELSE 0 END) AS ganho_total

FROM BASE
WHERE UF IS NOT NULL
GROUP BY UF
HAVING
    SUM(CASE WHEN (HAS_2G=1 AND HAD_2G_BASELINE=0) OR PLAN_2G=1 THEN 1 ELSE 0 END)
      + SUM(CASE WHEN (HAS_3G=1 AND HAD_3G_BASELINE=0) OR PLAN_3G=1 THEN 1 ELSE 0 END)
      + SUM(CASE WHEN (HAS_4G=1 AND HAD_4G_BASELINE=0) OR PLAN_4G=1 THEN 1 ELSE 0 END)
      + SUM(CASE WHEN (HAS_5G=1 AND HAD_5G_BASELINE=0) OR PLAN_5G=1 THEN 1 ELSE 0 END) > 0
ORDER BY ganho_total DESC
"""


# ---------------------------------------------------------------------------
# TIMELINE HISTÓRICA + PROJEÇÃO
# ---------------------------------------------------------------------------
#
# Histórico: soma acumulada mensal a partir de MES_DIV_XG.
# Projeção: adicionada no service, no ponto dez/AAAA (não vem do SQL).
# ---------------------------------------------------------------------------

HISTORICAL_CTE_TEMPLATE = """
WITH DIC_HIST AS (
    SELECT
        IBGE, UF, MUNICIPIO,
        MES_DIV_2G, MES_DIV_3G, MES_DIV_4G, MES_DIV_5G
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA))
        FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
    {uf_filter}
    {municipio_filter}
)
"""


HISTORICAL_QUERY = """
SELECT TEC, PERIODO, QTD
FROM (
    SELECT '2G' AS TEC, TRUNC(MES_DIV_2G, 'MM') AS PERIODO,
           COUNT(DISTINCT IBGE) AS QTD
    FROM DIC_HIST
    WHERE MES_DIV_2G IS NOT NULL
    GROUP BY TRUNC(MES_DIV_2G, 'MM')

    UNION ALL

    SELECT '3G', TRUNC(MES_DIV_3G, 'MM'), COUNT(DISTINCT IBGE)
    FROM DIC_HIST
    WHERE MES_DIV_3G IS NOT NULL
    GROUP BY TRUNC(MES_DIV_3G, 'MM')

    UNION ALL

    SELECT '4G', TRUNC(MES_DIV_4G, 'MM'), COUNT(DISTINCT IBGE)
    FROM DIC_HIST
    WHERE MES_DIV_4G IS NOT NULL
    GROUP BY TRUNC(MES_DIV_4G, 'MM')

    UNION ALL

    SELECT '5G', TRUNC(MES_DIV_5G, 'MM'), COUNT(DISTINCT IBGE)
    FROM DIC_HIST
    WHERE MES_DIV_5G IS NOT NULL
    GROUP BY TRUNC(MES_DIV_5G, 'MM')
)
ORDER BY TEC, PERIODO
"""


# ---------------------------------------------------------------------------
# VELOCÍMETROS — Cidades 5G e Sites 5G
# ---------------------------------------------------------------------------
#
# Filosofia: aqui usamos TB_ROLLOUT_ACESSO como fonte do plano para manter
# consistência com Sites 5G (que dependem obrigatoriamente do rollout, pois
# TB_FT_BASE_UNICA_SITES não tem MES_DIV_5G para o futuro).
#
# Se depois quiser padronizar Cidades 5G para MES_DIV_5G do fechamento,
# basta trocar GAUGE_CITIES_5G_PLAN por uma query simples em
# MUNICIPIOS_FECHAMENTO com o filtro BETWEEN.
# ---------------------------------------------------------------------------

# --------- CIDADES 5G ---------

GAUGE_CITIES_5G_EOY25 = """
SELECT COUNT(DISTINCT IBGE) AS QTD
FROM NTW_OP.MUNICIPIOS_FECHAMENTO
WHERE TRUNC(DT_CARGA) = (
    SELECT TRUNC(MAX(DT_CARGA))
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
)
AND PRESENCA_5G = 1
AND MES_DIV_5G IS NOT NULL
AND MES_DIV_5G <= :baseline_date
{uf_filter}
{municipio_filter}
"""


GAUGE_CITIES_5G_YTD = """
SELECT NVL(SUM(PRESENCA_5G), 0) AS QTD
FROM NTW_OP.MUNICIPIOS_FECHAMENTO
WHERE TRUNC(DT_CARGA) = (
    SELECT TRUNC(MAX(DT_CARGA))
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
)
{uf_filter}
{municipio_filter}
"""


GAUGE_CITIES_5G_PLAN = """
SELECT COUNT(DISTINCT r.COD_IBGE) AS QTD
FROM NTW_OP.TB_ROLLOUT_ACESSO r
LEFT JOIN (
    SELECT IBGE, UF, MUNICIPIO,
           NVL(PRESENCA_5G, 0) AS HAS_5G
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA))
        FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
) d ON d.IBGE = r.COD_IBGE
WHERE r.PLANO = :ano
  AND UPPER(REPLACE(REPLACE(r.TECNOLOGIA,'"',''),'''','')) = '5G'
  AND r.PRIORIDADE IN ('5G UPSIDE 2026 - NOVOS MUNICIPIOS', 'OBRIGACAO 3,5GHZ')
  AND NVL(d.HAS_5G, 0) = 0
  {status_filter}
  {ops_filter}
  {uf_filter_d}
  {municipio_filter_d}
"""


# --------- SITES 5G ---------

GAUGE_SITES_5G_EOY25 = """
SELECT COUNT(DISTINCT END_ID) AS QTD
FROM NTW_OP.TB_FT_BASE_UNICA_SITES
WHERE TECNOLOGIA LIKE '%5G%'
  AND MES_REF = (
      SELECT MAX(MES_REF)
      FROM NTW_OP.TB_FT_BASE_UNICA_SITES
      WHERE MES_REF <= :baseline_date
  )
  {uf_filter_site}
  {municipio_filter_site}
"""


GAUGE_SITES_5G_YTD = """
SELECT COUNT(DISTINCT END_ID) AS QTD
FROM NTW_OP.TB_FT_BASE_UNICA_SITES
WHERE TECNOLOGIA LIKE '%5G%'
  AND MES_REF = (
      SELECT MAX(MES_REF) FROM NTW_OP.TB_FT_BASE_UNICA_SITES
  )
  {uf_filter_site}
  {municipio_filter_site}
"""


GAUGE_SITES_5G_PLAN = """
SELECT COUNT(*) AS QTD
FROM NTW_OP.TB_ROLLOUT_ACESSO r
LEFT JOIN (
    SELECT IBGE, UF, MUNICIPIO
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA))
        FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
) d ON d.IBGE = r.COD_IBGE
WHERE r.PLANO = :ano
  AND UPPER(REPLACE(REPLACE(r.TECNOLOGIA,'"',''),'''','')) = '5G'
  {status_filter}
  {ops_filter}
  {uf_filter_d}
  {municipio_filter_d}
"""