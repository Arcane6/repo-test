"""
Queries SQL para a aba "Sites" (fonte: NTW_OP.TB_FT_BASE_UNICA_SITES).

Mesma base e mesmas regras de negócio do combo de Sites já usado no Resumo
(R1_SITES_VENN): último MES_REF, exclui roaming (TIPO_SITE <> 'ROAMING
VIVO'), só site móvel (MOBILE_SITE = 'SIM'), tecnologia informada
(TECNOLOGIA <> '-'). Diferente do Resumo, aqui o join com
MUNICIPIOS_FECHAMENTO (pra pegar REGIONAL) é feito por IBGE — a tabela
de sites tem essa coluna — em vez de UF+MUNICIPIO por string, que é mais
frágil (acentuação, abreviação, etc.).
"""

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
    AND TIPO_SITE <> 'ROAMING VIVO'
    AND MOBILE_SITE = 'SIM'
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
AND TIPO_SITE <> 'ROAMING VIVO'
AND MOBILE_SITE = 'SIM'
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
