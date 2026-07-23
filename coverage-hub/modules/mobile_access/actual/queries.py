"""
Queries SQL para a aba "Rede Hoje" (fonte: NTW_OP.MUNICIPIOS_FECHAMENTO).
"""

BASE_CTE_TEMPLATE = """
WITH BASE_RAW AS (
    -- PRESENCA_xG da tabela fica true assim que o site entra em rollout,
    -- mesmo antes de divulgado (ainda em ativação/planejamento). "Rede
    -- hoje" precisa refletir o que já foi de fato divulgado — daí
    -- recalcular presença a partir de MES_DIV_xG <= hoje, não da flag.
    SELECT
        IBGE,
        UF,
        MUNICIPIO,
        BANDA_2G_MHZ,
        BANDA_3G_MHZ,
        BANDA_4G_MHZ,
        BANDA_5G_MHZ,
        MES_DIV_2G,
        MES_DIV_3G,
        MES_DIV_4G,
        MES_DIV_5G,
        CASE WHEN MES_DIV_2G IS NOT NULL AND MES_DIV_2G <= TRUNC(SYSDATE) THEN 1 ELSE 0 END AS PRESENCA_2G,
        CASE WHEN MES_DIV_3G IS NOT NULL AND MES_DIV_3G <= TRUNC(SYSDATE) THEN 1 ELSE 0 END AS PRESENCA_3G,
        CASE WHEN MES_DIV_4G IS NOT NULL AND MES_DIV_4G <= TRUNC(SYSDATE) THEN 1 ELSE 0 END AS PRESENCA_4G,
        CASE WHEN MES_DIV_5G IS NOT NULL AND MES_DIV_5G <= TRUNC(SYSDATE) THEN 1 ELSE 0 END AS PRESENCA_5G
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA))
        FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
),
BASE AS (
    SELECT
        IBGE,
        UF,
        MUNICIPIO,
        BANDA_2G_MHZ,
        BANDA_3G_MHZ,
        BANDA_4G_MHZ,
        BANDA_5G_MHZ,
        MES_DIV_2G,
        MES_DIV_3G,
        MES_DIV_4G,
        MES_DIV_5G,
        PRESENCA_2G,
        PRESENCA_3G,
        PRESENCA_4G,
        PRESENCA_5G,
        CASE WHEN PRESENCA_2G = 1 OR PRESENCA_3G = 1 OR PRESENCA_4G = 1 OR PRESENCA_5G = 1
             THEN 1 ELSE 0 END AS PRESENCA
    FROM BASE_RAW
    WHERE 1=1
    {uf_filter}
    {municipio_filter}
    {tecnologia_filter}
    {venn_filter}
)
"""

# Combinação exata de presença 2G/3G/5G por região do diagrama de Venn (4G
# fica de fora do diagrama, como já era — ver VENN_TEMPLATE). Clicar numa
# fatia filtra a base inteira para exatamente essa combinação, diferente
# do filtro de tecnologia (que é "tem pelo menos uma dessas").
VENN_REGION_CLAUSES = {
    "only_2g":     "PRESENCA_2G = 1 AND PRESENCA_3G = 0 AND PRESENCA_5G = 0",
    "only_3g":     "PRESENCA_2G = 0 AND PRESENCA_3G = 1 AND PRESENCA_5G = 0",
    "only_5g":     "PRESENCA_2G = 0 AND PRESENCA_3G = 0 AND PRESENCA_5G = 1",
    "inter_2g_3g": "PRESENCA_2G = 1 AND PRESENCA_3G = 1 AND PRESENCA_5G = 0",
    "inter_2g_5g": "PRESENCA_2G = 1 AND PRESENCA_3G = 0 AND PRESENCA_5G = 1",
    "inter_3g_5g": "PRESENCA_2G = 0 AND PRESENCA_3G = 1 AND PRESENCA_5G = 1",
    "inter_all":   "PRESENCA_2G = 1 AND PRESENCA_3G = 1 AND PRESENCA_5G = 1",
}


KPIS_TEMPLATE = """
SELECT
    COUNT(*) AS total_municipios,
    NVL(SUM(PRESENCA), 0) AS municipios_cobertos,
    NVL(SUM(PRESENCA_5G), 0) AS municipios_5g,
    NVL(SUM(PRESENCA_4G), 0) AS municipios_4g,
    NVL(SUM(PRESENCA_3G), 0) AS municipios_3g,
    NVL(SUM(PRESENCA_2G), 0) AS municipios_2g
FROM BASE
"""


VENN_TEMPLATE = """
SELECT
    SUM(CASE WHEN PRESENCA_2G=1 AND PRESENCA_3G=0 AND PRESENCA_5G=0 THEN 1 ELSE 0 END) AS only_2g,
    SUM(CASE WHEN PRESENCA_2G=0 AND PRESENCA_3G=1 AND PRESENCA_5G=0 THEN 1 ELSE 0 END) AS only_3g,
    SUM(CASE WHEN PRESENCA_2G=0 AND PRESENCA_3G=0 AND PRESENCA_5G=1 THEN 1 ELSE 0 END) AS only_5g,
    SUM(CASE WHEN PRESENCA_2G=1 AND PRESENCA_3G=1 AND PRESENCA_5G=0 THEN 1 ELSE 0 END) AS inter_2g_3g,
    SUM(CASE WHEN PRESENCA_2G=1 AND PRESENCA_3G=0 AND PRESENCA_5G=1 THEN 1 ELSE 0 END) AS inter_2g_5g,
    SUM(CASE WHEN PRESENCA_2G=0 AND PRESENCA_3G=1 AND PRESENCA_5G=1 THEN 1 ELSE 0 END) AS inter_3g_5g,
    SUM(CASE WHEN PRESENCA_2G=1 AND PRESENCA_3G=1 AND PRESENCA_5G=1 THEN 1 ELSE 0 END) AS inter_all,
    NVL(SUM(PRESENCA_2G), 0) AS total_2g,
    NVL(SUM(PRESENCA_3G), 0) AS total_3g,
    NVL(SUM(PRESENCA_5G), 0) AS total_5g,
    COUNT(*) AS total_municipios
FROM BASE
"""


_STATUS_CASE = """
    CASE
        WHEN MES_DIV_{tec} IS NULL THEN NULL
        WHEN MES_DIV_{tec} < TRUNC(SYSDATE, 'YYYY') THEN 'EOY_PREV'
        WHEN MES_DIV_{tec} <= TRUNC(SYSDATE) THEN 'YTD'
        WHEN MES_DIV_{tec} < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12) THEN 'EOY_CURR'
        ELSE NULL
    END AS STATUS_{tec}"""

# Fase de cada tecnologia por município: EOY_PREV (divulgado até 31/dez do ano
# anterior), YTD (divulgado neste ano, até hoje) ou EOY_CURR (planejado até o
# fim do ano corrente). O service traduz pros rótulos EOY25/YTD/EOY26.
TABLE_TEMPLATE = (
    """
SELECT
    IBGE,
    UF,
    MUNICIPIO,"""
    + ",".join(_STATUS_CASE.format(tec=t) for t in ("5G", "4G", "3G", "2G"))
    + """
FROM BASE
ORDER BY UF, MUNICIPIO
"""
)


# Velocímetros da aba Cidades: por tecnologia, quantos municípios estavam
# divulgados no fechamento do ano anterior (EOY_PREV), quantos estão até hoje
# (YTD) e quantos fecham o ano corrente (EOY_CURR, inclui os planejados).
GAUGES_TEMPLATE = """
SELECT
    COUNT(*) AS total_municipios,
    {metrics}
FROM BASE
"""

GAUGE_METRIC = """
    SUM(CASE WHEN MES_DIV_{tec} IS NOT NULL AND MES_DIV_{tec} < TRUNC(SYSDATE, 'YYYY') THEN 1 ELSE 0 END) AS eoy_prev_{tec},
    SUM(CASE WHEN MES_DIV_{tec} IS NOT NULL AND MES_DIV_{tec} <= TRUNC(SYSDATE) THEN 1 ELSE 0 END) AS ytd_{tec},
    SUM(CASE WHEN MES_DIV_{tec} IS NOT NULL AND MES_DIV_{tec} < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12) THEN 1 ELSE 0 END) AS eoy_curr_{tec}"""

# Alvo EOY26 do 5G: o MES_DIV_5G da base de fechamento só tem data REALIZADA
# (não existe linha com data futura), então o eoy_curr calculado por data
# colapsava no YTD (mostrava 1112 quando o alvo é 1089 + 134 do plano).
# O alvo verdadeiro = EOY25 + cidades novas do plano
# (NTW_OP.REL_CIDADES_PLANEJADO_26) — o service soma eoy_prev_5g +
# planejado_5g. O guard de MES_DIV evita dupla contagem de cidade do plano
# que já era 5G antes do ano (contada no eoy_prev); quem ativou DENTRO do
# ano (YTD) continua contando — está no plano e no realizado, mas só soma
# uma vez porque o eoy_prev não a inclui.
GAUGE_PLANEJADO_5G_METRIC = """
    SUM(CASE WHEN IBGE IN (SELECT IBGE FROM NTW_OP.REL_CIDADES_PLANEJADO_26)
              AND (MES_DIV_5G IS NULL OR MES_DIV_5G >= TRUNC(SYSDATE, 'YYYY'))
             THEN 1 ELSE 0 END) AS planejado_5g"""


UFS_QUERY = """
SELECT DISTINCT UF
FROM NTW_OP.MUNICIPIOS_FECHAMENTO
WHERE TRUNC(DT_CARGA) = (
    SELECT TRUNC(MAX(DT_CARGA))
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
)
ORDER BY UF
"""


MUNICIPIOS_SEARCH_QUERY = """
SELECT DISTINCT MUNICIPIO, UF
FROM NTW_OP.MUNICIPIOS_FECHAMENTO
WHERE TRUNC(DT_CARGA) = (
    SELECT TRUNC(MAX(DT_CARGA))
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
)
AND UPPER(MUNICIPIO) LIKE UPPER(:q)
{uf_filter}
ORDER BY MUNICIPIO
FETCH FIRST 100 ROWS ONLY
"""


FREQUENCIES_TEMPLATE = """
SELECT TEC, BANDA, COUNT(DISTINCT IBGE) AS QTD
FROM (
    SELECT
        b.IBGE,
        '2G' AS TEC,
        TRIM(REGEXP_SUBSTR(REGEXP_REPLACE(b.BANDA_2G_MHZ, '\\s*\\([^)]*\\)', ''),
                           '[^/]+', 1, LEVELS.LVL)) AS BANDA
    FROM BASE b
    CROSS JOIN (
        SELECT LEVEL AS LVL FROM DUAL CONNECT BY LEVEL <= 10
    ) LEVELS
    WHERE b.PRESENCA_2G = 1
      AND b.BANDA_2G_MHZ IS NOT NULL
      AND REGEXP_SUBSTR(b.BANDA_2G_MHZ, '[^/]+', 1, LEVELS.LVL) IS NOT NULL

    UNION ALL

    SELECT
        b.IBGE,
        '3G' AS TEC,
        TRIM(REGEXP_SUBSTR(REGEXP_REPLACE(b.BANDA_3G_MHZ, '\\s*\\([^)]*\\)', ''),
                           '[^/]+', 1, LEVELS.LVL)) AS BANDA
    FROM BASE b
    CROSS JOIN (
        SELECT LEVEL AS LVL FROM DUAL CONNECT BY LEVEL <= 10
    ) LEVELS
    WHERE b.PRESENCA_3G = 1
      AND b.BANDA_3G_MHZ IS NOT NULL
      AND REGEXP_SUBSTR(b.BANDA_3G_MHZ, '[^/]+', 1, LEVELS.LVL) IS NOT NULL

    UNION ALL

    SELECT
        b.IBGE,
        '4G' AS TEC,
        TRIM(REGEXP_SUBSTR(REGEXP_REPLACE(b.BANDA_4G_MHZ, '\\s*\\([^)]*\\)', ''),
                           '[^/]+', 1, LEVELS.LVL)) AS BANDA
    FROM BASE b
    CROSS JOIN (
        SELECT LEVEL AS LVL FROM DUAL CONNECT BY LEVEL <= 10
    ) LEVELS
    WHERE b.PRESENCA_4G = 1
      AND b.BANDA_4G_MHZ IS NOT NULL
      AND REGEXP_SUBSTR(b.BANDA_4G_MHZ, '[^/]+', 1, LEVELS.LVL) IS NOT NULL

    UNION ALL

    SELECT
        b.IBGE,
        '5G' AS TEC,
        TRIM(REGEXP_SUBSTR(REGEXP_REPLACE(b.BANDA_5G_MHZ, '\\s*\\([^)]*\\)', ''),
                           '[^/]+', 1, LEVELS.LVL)) AS BANDA
    FROM BASE b
    CROSS JOIN (
        SELECT LEVEL AS LVL FROM DUAL CONNECT BY LEVEL <= 10
    ) LEVELS
    WHERE b.PRESENCA_5G = 1
      AND b.BANDA_5G_MHZ IS NOT NULL
      AND REGEXP_SUBSTR(b.BANDA_5G_MHZ, '[^/]+', 1, LEVELS.LVL) IS NOT NULL
)
WHERE BANDA IS NOT NULL
GROUP BY TEC, BANDA
ORDER BY
    CASE TEC WHEN '2G' THEN 1 WHEN '3G' THEN 2 WHEN '4G' THEN 3 WHEN '5G' THEN 4 END,
    CASE
        WHEN REGEXP_LIKE(BANDA, '^[0-9]+$') THEN TO_NUMBER(BANDA)
        ELSE 999999
    END,
    BANDA
"""


TIMESERIES_TEMPLATE = """
SELECT TEC, PERIODO, QTD
FROM (
    SELECT
        '2G' AS TEC,
        TRUNC(MES_DIV_2G, 'MM') AS PERIODO,
        COUNT(DISTINCT IBGE) AS QTD
    FROM BASE
    WHERE MES_DIV_2G IS NOT NULL
    GROUP BY TRUNC(MES_DIV_2G, 'MM')

    UNION ALL

    SELECT
        '3G' AS TEC,
        TRUNC(MES_DIV_3G, 'MM') AS PERIODO,
        COUNT(DISTINCT IBGE) AS QTD
    FROM BASE
    WHERE MES_DIV_3G IS NOT NULL
    GROUP BY TRUNC(MES_DIV_3G, 'MM')

    UNION ALL

    SELECT
        '4G' AS TEC,
        TRUNC(MES_DIV_4G, 'MM') AS PERIODO,
        COUNT(DISTINCT IBGE) AS QTD
    FROM BASE
    WHERE MES_DIV_4G IS NOT NULL
    GROUP BY TRUNC(MES_DIV_4G, 'MM')

    UNION ALL

    SELECT
        '5G' AS TEC,
        TRUNC(MES_DIV_5G, 'MM') AS PERIODO,
        COUNT(DISTINCT IBGE) AS QTD
    FROM BASE
    WHERE MES_DIV_5G IS NOT NULL
    GROUP BY TRUNC(MES_DIV_5G, 'MM')

    UNION ALL

    -- Cidades novas do PLANO 26 entram na curva 5G em dez/26 (pedido do
    -- usuário): são as de REL_CIDADES_PLANEJADO_26 ainda não realizadas
    -- (MES_DIV_5G nulo ou futuro — quem já ativou no ano conta no mês real
    -- acima, não aqui, senão contaria duas vezes). Join com BASE pra
    -- respeitar os mesmos filtros de UF/município/tec/venn da aba.
    SELECT
        '5G' AS TEC,
        DATE '2026-12-01' AS PERIODO,
        COUNT(DISTINCT p.IBGE) AS QTD
    FROM BASE b
    JOIN NTW_OP.REL_CIDADES_PLANEJADO_26 p ON p.IBGE = b.IBGE
    WHERE (b.MES_DIV_5G IS NULL OR b.MES_DIV_5G > TRUNC(SYSDATE))
    HAVING COUNT(DISTINCT p.IBGE) > 0
)
ORDER BY TEC, PERIODO
"""

GAUGE_TIM_METRIC = """
    SUM(CASE WHEN LEAST(
        NVL(MES_DIV_2G, DATE '9999-12-31'),
        NVL(MES_DIV_3G, DATE '9999-12-31'),
        NVL(MES_DIV_4G, DATE '9999-12-31'),
        NVL(MES_DIV_5G, DATE '9999-12-31')
    ) < TRUNC(SYSDATE, 'YYYY') THEN 1 ELSE 0 END) AS eoy_prev_tim,
    SUM(CASE WHEN LEAST(
        NVL(MES_DIV_2G, DATE '9999-12-31'),
        NVL(MES_DIV_3G, DATE '9999-12-31'),
        NVL(MES_DIV_4G, DATE '9999-12-31'),
        NVL(MES_DIV_5G, DATE '9999-12-31')
    ) <= TRUNC(SYSDATE) THEN 1 ELSE 0 END) AS ytd_tim,
    SUM(CASE WHEN LEAST(
        NVL(MES_DIV_2G, DATE '9999-12-31'),
        NVL(MES_DIV_3G, DATE '9999-12-31'),
        NVL(MES_DIV_4G, DATE '9999-12-31'),
        NVL(MES_DIV_5G, DATE '9999-12-31')
    ) < ADD_MONTHS(TRUNC(SYSDATE, 'YYYY'), 12) THEN 1 ELSE 0 END) AS eoy_curr_tim"""
