"""
Queries SQL para a aba "Plano".
Fonte: TB_ROLLOUT_ACESSO (ou equivalente no owner correto).

Filtros suportados (via WHERE dinâmico):
    - Ano                    (obrigatório, default 2026)
    - STATUS_OC              (ACTIVATED sempre; CLOSED opcional)
    - PRIORIDADE excluídas   (operações, opcional)
    - UF                     (JOIN via COD_IBGE com MUNICIPIOS_FECHAMENTO)
    - Município              (JOIN via COD_IBGE)
    - Tecnologia             (2G/3G/4G/5G)
"""

# ---------------------------------------------------------------------------
# BASE CTE — todas as queries se penduram nela
# ---------------------------------------------------------------------------
#
# Precisamos do UF/MUNICIPIO dos IBGEs para filtrar por região.
# Usamos a última carga de MUNICIPIOS_FECHAMENTO como dicionário IBGE->UF/MUN.
#
# {ano_filter}, {status_filter}, {ops_filter}, {uf_filter},
# {municipio_filter}, {tec_filter} são substituídos em service.py.
# ---------------------------------------------------------------------------

BASE_CTE_TEMPLATE = """
WITH DIC_MUN AS (
    SELECT IBGE, UF, MUNICIPIO
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA))
        FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
),
BASE AS (
    SELECT
        r.ORDEM_COMPLEXA,
        r.STATUS_OC,
        r.PLANO,
        r.PRIORIDADE,
        r.ID_MASTER_PIVOT,
        r.MACRO_CLASS,
        r.CLASSIFICACAO_CASA,
        UPPER(REPLACE(REPLACE(r.TECNOLOGIA, '"', ''), '''', '')) AS TECNOLOGIA,
        r.COD_IBGE,
        d.UF,
        d.MUNICIPIO
    FROM NTW_OP.TB_ROLLOUT_ACESSO r
    LEFT JOIN DIC_MUN d
        ON d.IBGE = r.COD_IBGE
    WHERE 1=1
      {ano_filter}
      {status_filter}
      {ops_filter}
      {uf_filter}
      {municipio_filter}
      {tec_filter}
)
"""


# ---------------------------------------------------------------------------
# KPIs — 5 cards do topo
# ---------------------------------------------------------------------------

KPIS_TEMPLATE = """
SELECT
    COUNT(*) AS total_ocs,
    COUNT(DISTINCT COD_IBGE) AS municipios_impactados,
    SUM(CASE WHEN CLASSIFICACAO_CASA = 'NEW SITE' THEN 1 ELSE 0 END) AS novos_sites,
    SUM(CASE WHEN CLASSIFICACAO_CASA = 'CASA EXISTENTE' THEN 1 ELSE 0 END) AS casas_existentes,
    SUM(CASE WHEN TECNOLOGIA = '5G'
             AND (PRIORIDADE LIKE 'OBRIGACAO 3%GHZ%' OR PRIORIDADE = 'OBRIGACAO 3,5GHZ')
             THEN 1 ELSE 0 END) AS ocs_5g_obrigacao,
    SUM(CASE WHEN STATUS_OC = 'CLOSED' THEN 1 ELSE 0 END) AS canceladas
FROM BASE
"""


# ---------------------------------------------------------------------------
# Composição por PRIORIDADE (bar horizontal)
# ---------------------------------------------------------------------------

COMPOSITION_TEMPLATE = """
SELECT PRIORIDADE, COUNT(*) AS QTD
FROM BASE
WHERE PRIORIDADE IS NOT NULL
GROUP BY PRIORIDADE
ORDER BY QTD DESC
"""


# ---------------------------------------------------------------------------
# Distribuição por tecnologia (donut)
# ---------------------------------------------------------------------------

BY_TECH_TEMPLATE = """
SELECT TECNOLOGIA, COUNT(*) AS QTD
FROM BASE
WHERE TECNOLOGIA IN ('2G', '3G', '4G', '5G')
GROUP BY TECNOLOGIA
ORDER BY
    CASE TECNOLOGIA WHEN '2G' THEN 1 WHEN '3G' THEN 2 WHEN '4G' THEN 3 WHEN '5G' THEN 4 END
"""


# ---------------------------------------------------------------------------
# Sunburst — NEW SITE / CASA EXISTENTE / CO SITE CASA NOVA -> Tecnologia
# ---------------------------------------------------------------------------

SUNBURST_TEMPLATE = """
SELECT
    NVL(CLASSIFICACAO_CASA, 'NÃO CLASSIFICADO') AS CATEGORIA,
    TECNOLOGIA,
    COUNT(*) AS QTD
FROM BASE
WHERE TECNOLOGIA IN ('2G', '3G', '4G', '5G')
GROUP BY CLASSIFICACAO_CASA, TECNOLOGIA
"""


# ---------------------------------------------------------------------------
# Top N municípios (bar horizontal)
# ---------------------------------------------------------------------------

TOP_MUNICIPIOS_TEMPLATE = """
SELECT
    COD_IBGE,
    MUNICIPIO,
    UF,
    COUNT(*) AS QTD
FROM BASE
WHERE COD_IBGE IS NOT NULL
GROUP BY COD_IBGE, MUNICIPIO, UF
ORDER BY QTD DESC
FETCH FIRST 20 ROWS ONLY
"""


# ---------------------------------------------------------------------------
# Tabela detalhada
# ---------------------------------------------------------------------------

TABLE_TEMPLATE = """
SELECT
    ORDEM_COMPLEXA,
    STATUS_OC,
    PLANO,
    PRIORIDADE,
    MACRO_CLASS,
    CLASSIFICACAO_CASA,
    TECNOLOGIA,
    COD_IBGE,
    UF,
    MUNICIPIO
FROM BASE
ORDER BY PRIORIDADE, UF, MUNICIPIO
FETCH FIRST 2000 ROWS ONLY
"""


# ---------------------------------------------------------------------------
# Anos disponíveis (dropdown do filtro)
# ---------------------------------------------------------------------------

YEARS_QUERY = """
SELECT DISTINCT PLANO AS ANO
FROM NTW_OP.TB_ROLLOUT_ACESSO
WHERE PLANO IS NOT NULL
ORDER BY ANO DESC
"""

# ---------------------------------------------------------------------------
# Distribuição por UF (para o mapa de calor)
# ---------------------------------------------------------------------------

BY_UF_TEMPLATE = """
SELECT
    UF,
    COUNT(*) AS QTD,
    COUNT(DISTINCT COD_IBGE) AS MUNICIPIOS
FROM BASE
WHERE UF IS NOT NULL
GROUP BY UF
ORDER BY QTD DESC
"""