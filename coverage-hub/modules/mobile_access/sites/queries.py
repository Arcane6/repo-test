"""
Queries SQL para a aba "Sites" (fonte: NTW_OP.TB_FT_BASE_UNICA_SITES).

Mesmo universo "Mobile Sites" usado no Resumo (R1_SITES_VENN) — ver
modules/mobile_access/shared/site_universe.py pra a hierarquia completa
e a regra de cada categoria. Diferente do Resumo, aqui o recorte de mês é
o MES_REF mais recente (inventário atual, não um fechamento histórico), e
o join com MUNICIPIOS_FECHAMENTO (pra pegar REGIONAL) é feito por IBGE —
a tabela de sites tem essa coluna — em vez de UF+MUNICIPIO por string,
que é mais frágil (acentuação, abreviação, etc.).

Exceção: SITES_TIPO (abaixo) é DELIBERADAMENTE outro universo — ver
comentário lá.
"""

from modules.mobile_access.shared.site_universe import (
    MOBILE_SITES_WHERE,
    MACRO_WHERE,
    SMALL_CELL_MOVEL_SLS_WHERE,
    RAN_SHARING_WHERE,
    SEM_RF_WHERE,
    ROAMING_VIVO_WHERE,
)

# ---------- Base compartilhada por todas as queries desta aba ----------
# HAS_2G..HAS_5G são flags de presença; SITES_BASE_CTE é reaproveitado
# (via .format) dentro de cada query — cada uma decide o agrupamento.

SITES_BASE_CTE = """
WITH BASE AS (
    SELECT
        END_ID, IBGE, UF, MUNICIPIO,
        CASE WHEN TECNOLOGIA LIKE '%2G%' THEN 1 ELSE 0 END AS HAS_2G,
        CASE WHEN TECNOLOGIA LIKE '%3G%' THEN 1 ELSE 0 END AS HAS_3G,
        CASE WHEN TECNOLOGIA LIKE '%4G%' THEN 1 ELSE 0 END AS HAS_4G,
        CASE WHEN TECNOLOGIA LIKE '%5G%' THEN 1 ELSE 0 END AS HAS_5G
    FROM NTW_OP.TB_FT_BASE_UNICA_SITES
    WHERE MES_REF = (
        SELECT MAX(MES_REF) FROM NTW_OP.TB_FT_BASE_UNICA_SITES
    )
    AND """ + MOBILE_SITES_WHERE + """
    AND TECNOLOGIA <> '-'
    {uf_filter_site}
    {municipio_filter_site}
),
GEO AS (
    SELECT IBGE, REGIONAL
    FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    WHERE TRUNC(DT_CARGA) = (
        SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
    )
)"""

# ---------- Sites por "max tech" — cada site conta uma única vez, na ----------
# tecnologia mais nova que ele tem (cascata 5G > 4G > 3G > 2G).
SITES_BY_MAX_TECH = SITES_BASE_CTE + """
SELECT
    SUM(CASE WHEN b.HAS_5G = 1 THEN 1 ELSE 0 END) AS sites_5g,
    SUM(CASE WHEN b.HAS_5G = 0 AND b.HAS_4G = 1 THEN 1 ELSE 0 END) AS sites_4g,
    SUM(CASE WHEN b.HAS_5G = 0 AND b.HAS_4G = 0 AND b.HAS_3G = 1 THEN 1 ELSE 0 END) AS sites_3g,
    SUM(CASE WHEN b.HAS_5G = 0 AND b.HAS_4G = 0 AND b.HAS_3G = 0 AND b.HAS_2G = 1 THEN 1 ELSE 0 END) AS sites_2g,
    COUNT(*) AS total_sites
FROM BASE b
LEFT JOIN GEO g ON g.IBGE = b.IBGE
WHERE 1=1
{regional_filter_site}
"""

# ---------- Sites por tecnologia — contagem independente por tech. ----------
# Um site com 2G+4G conta em sites_2g E em sites_4g (não é dedup, é
# "quantos sites têm essa tecnologia", diferente do max-tech acima).
SITES_BY_TECNOLOGIA = SITES_BASE_CTE + """
SELECT
    SUM(b.HAS_2G) AS sites_2g,
    SUM(b.HAS_3G) AS sites_3g,
    SUM(b.HAS_4G) AS sites_4g,
    SUM(b.HAS_5G) AS sites_5g,
    COUNT(*) AS total_sites
FROM BASE b
LEFT JOIN GEO g ON g.IBGE = b.IBGE
WHERE 1=1
{regional_filter_site}
"""

# ---------- Pivot: mesmas duas métricas acima, abertas por Regional/UF/ ----------
# Município. Uma linha por (Regional, UF, Município) com as 9 colunas de
# métrica — o agrupamento/hierarquia de exibição fica por conta do
# frontend, o backend só entrega a base já agregada no menor grão.
SITES_PIVOT = SITES_BASE_CTE + """
SELECT
    g.REGIONAL,
    b.UF,
    b.MUNICIPIO,
    SUM(CASE WHEN b.HAS_5G = 1 THEN 1 ELSE 0 END) AS max_5g,
    SUM(CASE WHEN b.HAS_5G = 0 AND b.HAS_4G = 1 THEN 1 ELSE 0 END) AS max_4g,
    SUM(CASE WHEN b.HAS_5G = 0 AND b.HAS_4G = 0 AND b.HAS_3G = 1 THEN 1 ELSE 0 END) AS max_3g,
    SUM(CASE WHEN b.HAS_5G = 0 AND b.HAS_4G = 0 AND b.HAS_3G = 0 AND b.HAS_2G = 1 THEN 1 ELSE 0 END) AS max_2g,
    SUM(b.HAS_2G) AS tec_2g,
    SUM(b.HAS_3G) AS tec_3g,
    SUM(b.HAS_4G) AS tec_4g,
    SUM(b.HAS_5G) AS tec_5g,
    COUNT(*) AS total_sites
FROM BASE b
LEFT JOIN GEO g ON g.IBGE = b.IBGE
WHERE 1=1
{regional_filter_site}
GROUP BY g.REGIONAL, b.UF, b.MUNICIPIO
ORDER BY g.REGIONAL, b.UF, b.MUNICIPIO
"""

# ---------- Fornecedor dominante por site ----------
# Fonte: NTW_MABE.BASE_TB_END_ID_NEW — mesma tabela e mesma cascata de
# colunas VENDOR_* (maior banda primeiro dentro de cada tec) já usada em
# R1_VENDORS (summary/queries.py), confirmada pelo usuário via query real
# do Power BI antigo (Odbc.Query em NTW_MABE.BASE_TB_END_ID_NEW). Aqui o
# join é feito DENTRO do universo de sites já filtrado desta aba (BASE),
# não como query independente — assim o total de "sites com fornecedor"
# bate com o total das outras visões da mesma tela, em vez de ter dois
# universos de sites diferentes na mesma aba.
SITES_VENDORS = SITES_BASE_CTE + """,
VENDOR_BASE AS (
    SELECT
        END_ID,
        -- Cascata 5G (maior banda primeiro): 3500 > 26000 > 2600 > 2300 > 2100 > 1800 > 700
        -- NULLIF(TRIM(...), '') normaliza string vazia/só espaço pra NULL em
        -- CADA coluna antes do COALESCE — sem isso, uma banda maior com ''
        -- "vencia" a cascata e escondia o fornecedor real de uma banda menor.
        COALESCE(
            NULLIF(TRIM(VENDOR_NR_3500), ''), NULLIF(TRIM(VENDOR_NR_26000), ''), NULLIF(TRIM(VENDOR_NR_2600DSS), ''),
            NULLIF(TRIM(VENDOR_NR_2300), ''), NULLIF(TRIM(VENDOR_NR_2100DSS), ''), NULLIF(TRIM(VENDOR_NR_1800DSS), ''), NULLIF(TRIM(VENDOR_NR_700DSS), '')
        ) AS VENDOR_5G,
        -- Cascata 4G: 2600P > 2600 > 2600RS > 2300 > 2100 > 1800 > 850 > 700
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
            GROUP BY REF
            ORDER BY TO_DATE(REF, 'MM-YYYY') DESC
        )
        WHERE ROWNUM = 1
    )
)
SELECT
    COALESCE(vb.VENDOR_5G, vb.VENDOR_4G, vb.VENDOR_3G, vb.VENDOR_2G, 'NÃO INFORMADO') AS VENDOR,
    COUNT(*) AS qtd
FROM BASE b
LEFT JOIN GEO g ON g.IBGE = b.IBGE
LEFT JOIN VENDOR_BASE vb ON vb.END_ID = b.END_ID
WHERE 1=1
{regional_filter_site}
GROUP BY COALESCE(vb.VENDOR_5G, vb.VENDOR_4G, vb.VENDOR_3G, vb.VENDOR_2G, 'NÃO INFORMADO')
ORDER BY qtd DESC
"""

# ---------- Sites com coordenada — um ponto por site, com a tecnologia ----------
# máxima (mesma cascata 5G>4G>3G>2G) como cor. Alimenta os mapas (Brasil e
# múndi — a TIM tem site fora do território nacional). Descarta site sem
# lat/long (não dá pra plotar).
SITES_GEO_POINTS = """
SELECT
    END_ID, UF, MUNICIPIO,
    LATITUDE, LONGITUDE,
    CASE
        WHEN TECNOLOGIA LIKE '%5G%' THEN '5G'
        WHEN TECNOLOGIA LIKE '%4G%' THEN '4G'
        WHEN TECNOLOGIA LIKE '%3G%' THEN '3G'
        WHEN TECNOLOGIA LIKE '%2G%' THEN '2G'
    END AS MAX_TECH
FROM NTW_OP.TB_FT_BASE_UNICA_SITES
WHERE MES_REF = (
    SELECT MAX(MES_REF) FROM NTW_OP.TB_FT_BASE_UNICA_SITES
)
AND """ + MOBILE_SITES_WHERE + """
AND TECNOLOGIA <> '-'
AND LATITUDE IS NOT NULL
AND LONGITUDE IS NOT NULL
{uf_filter_site}
{municipio_filter_site}
"""

# ---------- Tipo de site — universo diferente das queries acima: aqui ----------
# NÃO filtra MOBILE_SITE = 'SIM' (é justamente uma das dimensões
# mostradas), só STATUS_END_ID = 'ATIVADO' e exclui roaming. Cruza
# MOBILE_SITE x TX_PROFILE (FLAG_TX_PROFILE_ENG) num 2x2.
SITES_TIPO = """
WITH BASE_TIPO AS (
    SELECT
        END_ID, IBGE, UF, MUNICIPIO,
        MOBILE_SITE,
        FLAG_TX_PROFILE_ENG
    FROM NTW_OP.TB_FT_BASE_UNICA_SITES
    WHERE MES_REF = (
        SELECT MAX(MES_REF) FROM NTW_OP.TB_FT_BASE_UNICA_SITES
    )
    AND STATUS_END_ID = 'ATIVADO'
    AND TIPO_SITE <> 'ROAMING VIVO'
    {uf_filter_site}
    {municipio_filter_site}
)
SELECT
    SUM(CASE WHEN MOBILE_SITE = 'SIM' AND FLAG_TX_PROFILE_ENG = 'SIM' THEN 1 ELSE 0 END) AS mobile_tx,
    SUM(CASE WHEN MOBILE_SITE = 'SIM' AND (FLAG_TX_PROFILE_ENG IS NULL OR FLAG_TX_PROFILE_ENG <> 'SIM') THEN 1 ELSE 0 END) AS mobile_no_tx,
    SUM(CASE WHEN (MOBILE_SITE IS NULL OR MOBILE_SITE <> 'SIM') AND FLAG_TX_PROFILE_ENG = 'SIM' THEN 1 ELSE 0 END) AS nonmobile_tx,
    SUM(CASE WHEN (MOBILE_SITE IS NULL OR MOBILE_SITE <> 'SIM') AND (FLAG_TX_PROFILE_ENG IS NULL OR FLAG_TX_PROFILE_ENG <> 'SIM') THEN 1 ELSE 0 END) AS nonmobile_no_tx,
    COUNT(*) AS total_sites
FROM BASE_TIPO
"""

# ---------- Árvore de composição de sites (Total de Sites Ativos) ----------
# Mesmo princípio de R1_SITES_HIERARCHY (summary/queries.py) — quebra o
# universo bruto de TB_FT_BASE_UNICA_SITES nas 5 categorias-folha da
# hierarquia (ver shared/site_universe.py), com as categorias
# intermediárias somadas em Python no service (nunca recalculadas em SQL,
# pra árvore sempre fechar por construção). Diferente do Resumo, aqui o
# recorte é o MES_REF mais recente (inventário atual desta aba), não o
# fechamento de dezembro — por isso o total normalmente NÃO bate com o da
# Raia 1 (ver CLAUDE.md: recorte de data depende da tela, não é bug).
SITES_HIERARCHY = """
WITH BASE AS (
    SELECT
        END_ID, IBGE,
        CASE WHEN """ + MACRO_WHERE + """ THEN 1 ELSE 0 END AS IS_MACRO,
        CASE WHEN """ + SMALL_CELL_MOVEL_SLS_WHERE + """ THEN 1 ELSE 0 END AS IS_SMALL_CELL_MOVEL_SLS,
        CASE WHEN """ + RAN_SHARING_WHERE + """ THEN 1 ELSE 0 END AS IS_RAN_SHARING,
        CASE WHEN """ + SEM_RF_WHERE + """ THEN 1 ELSE 0 END AS IS_SEM_RF,
        CASE WHEN """ + ROAMING_VIVO_WHERE + """ THEN 1 ELSE 0 END AS IS_ROAMING_VIVO
    FROM NTW_OP.TB_FT_BASE_UNICA_SITES
    WHERE MES_REF = (
        SELECT MAX(MES_REF) FROM NTW_OP.TB_FT_BASE_UNICA_SITES
    )
    {uf_filter_site}
    {municipio_filter_site}
),
GEO AS (
    SELECT IBGE, REGIONAL
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
LEFT JOIN GEO g ON g.IBGE = b.IBGE
WHERE 1=1
{regional_filter_site}
"""
