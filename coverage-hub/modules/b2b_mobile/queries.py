"""
Queries SQL do módulo B2B Mobile.

Fonte: NTW_OP.TB_ROLLOUT_ACESSO — filtro fixo por PRIORIDADE LIKE '%B2B%'

Classificação dinâmica:
    - Vertical = padrão extraído da MACRO_CLASS ("AGRO/…" -> Agronegócio, etc.)
    - Cliente  = parte após a "/" na MACRO_CLASS ("AGRO/CARGILL" -> "CARGILL")
"""


# ---------------------------------------------------------------------------
# BASE CTE — Só OCs B2B, com vertical/cliente já classificados
# ---------------------------------------------------------------------------
#
# Placeholders substituídos em service.py:
#   {ano_filter}       AND r.PLANO = :ano
#   {status_filter}    AND r.STATUS_OC IN (…)
#   {uf_filter}        AND UF IN (…)   (dicionário)
#   {mun_filter}       AND MUNICIPIO IN (…)
#   {vertical_filter}  AND vertical_calc IN (…)   (aplicado após CTE)
#   {cliente_filter}   AND cliente_calc  IN (…)   (idem)
#   {tec_filter}       AND TECNOLOGIA IN (…)
# ---------------------------------------------------------------------------

BASE_CTE_TEMPLATE = """
WITH DIC AS (
    SELECT IBGE, UF, MUNICIPIO
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA))
        FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
),
B2B_RAW AS (
    SELECT
        r.ORDEM_COMPLEXA,
        r.STATUS_OC,
        r.PLANO,
        r.PRIORIDADE,
        r.MACRO_CLASS,
        r.CLASSIFICACAO_CASA,
        UPPER(REPLACE(REPLACE(r.TECNOLOGIA,'"',''),'''','')) AS TECNOLOGIA,
        r.COD_IBGE,
        -- Vertical (dinâmica, mapeando pelo prefixo do MACRO_CLASS)
        CASE
            WHEN UPPER(r.MACRO_CLASS) LIKE 'B2B MOBILE - AGRO%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%/ AGRO%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%/AGRO%%'
              OR UPPER(r.MACRO_CLASS) LIKE 'AGRO%%'
                THEN 'Agronegócio'

            WHEN UPPER(r.MACRO_CLASS) LIKE 'B2B MOBILE - LOGISTICA%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%LOGISTICA/%%'
              OR UPPER(r.MACRO_CLASS) LIKE 'LOGISTICA%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%CCR%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%ECORODOVIAS%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%ECORIOMINAS%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%WAY%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%RAPOSO%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%CART%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%EPR LITORAL%%'
                THEN 'Logística'

            WHEN UPPER(r.MACRO_CLASS) LIKE 'B2B MOBILE - INDUSTRIA%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%/INDUSTRIA%%'
              OR UPPER(r.MACRO_CLASS) LIKE 'INDUSTRIA%%'
                THEN 'Indústria'

            WHEN UPPER(r.MACRO_CLASS) LIKE 'B2B MOBILE - MINERADORA%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%MINERADORA%%'
                THEN 'Mineração'

            WHEN UPPER(r.MACRO_CLASS) LIKE '%%CORPORATE%%'
                THEN 'Corporate Top'

            WHEN UPPER(r.MACRO_CLASS) LIKE '%%COMMON%%'
              OR UPPER(r.MACRO_CLASS) LIKE '%%SWAP%%'
                THEN 'Genérico'

            ELSE 'Genérico'
        END AS VERTICAL,

        -- Cliente (dinâmico: parte após a última "/" no MACRO_CLASS)
        CASE
            WHEN r.MACRO_CLASS IS NULL THEN 'GENÉRICO'
            WHEN INSTR(r.MACRO_CLASS, '/') = 0 THEN 'GENÉRICO'
            ELSE UPPER(TRIM(
                SUBSTR(r.MACRO_CLASS, INSTR(r.MACRO_CLASS, '/', -1) + 1)
            ))
        END AS CLIENTE
    FROM NTW_OP.TB_ROLLOUT_ACESSO r
    WHERE UPPER(r.PRIORIDADE) LIKE '%%B2B MOBILE%%'
      {ano_filter}
      {status_filter}
),
BASE AS (
    SELECT
        b.*,
        d.UF,
        d.MUNICIPIO
    FROM B2B_RAW b
    LEFT JOIN DIC d ON d.IBGE = b.COD_IBGE
    WHERE 1=1
      {uf_filter}
      {mun_filter}
      {vertical_filter}
      {cliente_filter}
      {tec_filter}
)
"""


# ---------------------------------------------------------------------------
# KPIs
# ---------------------------------------------------------------------------

KPIS_TEMPLATE = """
SELECT
    COUNT(*) AS total_ocs,
    SUM(CASE WHEN STATUS_OC = 'ACTIVATED' THEN 1 ELSE 0 END) AS ativas,
    SUM(CASE WHEN STATUS_OC = 'CLOSED' THEN 1 ELSE 0 END) AS canceladas,
    COUNT(DISTINCT CLIENTE) AS clientes_distintos,
    COUNT(DISTINCT COD_IBGE) AS municipios,
    SUM(CASE WHEN TECNOLOGIA = '5G' THEN 1 ELSE 0 END) AS ocs_5g
FROM BASE
"""


# ---------------------------------------------------------------------------
# Top Clientes
# ---------------------------------------------------------------------------

TOP_CLIENTES_TEMPLATE = """
SELECT
    CLIENTE,
    VERTICAL,
    COUNT(*) AS QTD,
    COUNT(DISTINCT COD_IBGE) AS MUNICIPIOS
FROM BASE
WHERE CLIENTE IS NOT NULL
GROUP BY CLIENTE, VERTICAL
ORDER BY QTD DESC
FETCH FIRST 20 ROWS ONLY
"""


# ---------------------------------------------------------------------------
# Distribuição por Vertical
# ---------------------------------------------------------------------------

BY_VERTICAL_TEMPLATE = """
SELECT
    VERTICAL,
    COUNT(*) AS QTD
FROM BASE
GROUP BY VERTICAL
ORDER BY QTD DESC
"""


# ---------------------------------------------------------------------------
# Distribuição por Tecnologia
# ---------------------------------------------------------------------------

BY_TECH_TEMPLATE = """
SELECT
    TECNOLOGIA,
    COUNT(*) AS QTD
FROM BASE
WHERE TECNOLOGIA IN ('2G', '3G', '4G', '5G')
GROUP BY TECNOLOGIA
ORDER BY
    CASE TECNOLOGIA WHEN '2G' THEN 1 WHEN '3G' THEN 2
                    WHEN '4G' THEN 3 WHEN '5G' THEN 4 END
"""


# ---------------------------------------------------------------------------
# Distribuição por UF (mapa)
# ---------------------------------------------------------------------------

BY_UF_TEMPLATE = """
SELECT
    UF,
    COUNT(*) AS QTD,
    COUNT(DISTINCT COD_IBGE) AS MUNICIPIOS,
    COUNT(DISTINCT CLIENTE) AS CLIENTES
FROM BASE
WHERE UF IS NOT NULL
GROUP BY UF
ORDER BY QTD DESC
"""


# ---------------------------------------------------------------------------
# Tabela detalhada
# ---------------------------------------------------------------------------

TABLE_TEMPLATE = """
SELECT
    ORDEM_COMPLEXA,
    STATUS_OC,
    VERTICAL,
    CLIENTE,
    MACRO_CLASS,
    CLASSIFICACAO_CASA,
    TECNOLOGIA,
    COD_IBGE,
    UF,
    MUNICIPIO
FROM BASE
ORDER BY VERTICAL, CLIENTE, UF, MUNICIPIO
FETCH FIRST 1000 ROWS ONLY
"""


# ---------------------------------------------------------------------------
# Filtros disponíveis (para dropdowns)
# ---------------------------------------------------------------------------

VERTICAIS_QUERY = """
WITH B2B_RAW AS (
    SELECT
        CASE
            WHEN UPPER(r.MACRO_CLASS) LIKE 'B2B MOBILE - AGRO%'
              OR UPPER(r.MACRO_CLASS) LIKE '%/AGRO%'
                THEN 'Agronegócio'
            WHEN UPPER(r.MACRO_CLASS) LIKE 'B2B MOBILE - LOGISTICA%'
              OR UPPER(r.MACRO_CLASS) LIKE '%LOGISTICA/%'
              OR UPPER(r.MACRO_CLASS) LIKE '%CCR%'
              OR UPPER(r.MACRO_CLASS) LIKE '%ECORODOVIAS%'
              OR UPPER(r.MACRO_CLASS) LIKE '%ECORIOMINAS%'
              OR UPPER(r.MACRO_CLASS) LIKE '%WAY%'
              OR UPPER(r.MACRO_CLASS) LIKE '%RAPOSO%'
              OR UPPER(r.MACRO_CLASS) LIKE '%CART%'
              OR UPPER(r.MACRO_CLASS) LIKE '%EPR LITORAL%'
                THEN 'Logística'
            WHEN UPPER(r.MACRO_CLASS) LIKE 'B2B MOBILE - INDUSTRIA%'
              OR UPPER(r.MACRO_CLASS) LIKE '%/INDUSTRIA%'
                THEN 'Indústria'
            WHEN UPPER(r.MACRO_CLASS) LIKE '%MINERADORA%'
                THEN 'Mineração'
            WHEN UPPER(r.MACRO_CLASS) LIKE '%CORPORATE%'
                THEN 'Corporate Top'
            ELSE 'Genérico'
        END AS VERTICAL
    FROM NTW_OP.TB_ROLLOUT_ACESSO r
    WHERE UPPER(r.PRIORIDADE) LIKE '%B2B MOBILE%'
)
SELECT DISTINCT VERTICAL
FROM B2B_RAW
WHERE VERTICAL IS NOT NULL
ORDER BY VERTICAL
"""


CLIENTES_SEARCH_QUERY = """
WITH B2B_RAW AS (
    SELECT DISTINCT
        CASE
            WHEN r.MACRO_CLASS IS NULL THEN 'GENÉRICO'
            WHEN INSTR(r.MACRO_CLASS, '/') = 0 THEN 'GENÉRICO'
            ELSE UPPER(TRIM(
                SUBSTR(r.MACRO_CLASS, INSTR(r.MACRO_CLASS, '/', -1) + 1)
            ))
        END AS CLIENTE
    FROM NTW_OP.TB_ROLLOUT_ACESSO r
    WHERE UPPER(r.PRIORIDADE) LIKE '%B2B MOBILE%'
)
SELECT CLIENTE
FROM B2B_RAW
WHERE CLIENTE IS NOT NULL
  AND UPPER(CLIENTE) LIKE UPPER(:q)
ORDER BY CLIENTE
FETCH FIRST 30 ROWS ONLY
"""


ANOS_QUERY = """
SELECT DISTINCT PLANO AS ANO
FROM NTW_OP.TB_ROLLOUT_ACESSO
WHERE PLANO IS NOT NULL
  AND UPPER(PRIORIDADE) LIKE '%B2B MOBILE%'
ORDER BY ANO DESC
"""