"""
Queries de Volumetria de Tráfego da RAN (rede núcleo) — módulo Core.

Fonte: NTW_MABE.ALTAIA_PM_MES_4G/5G (contador mensal por RAN_NODE), sem
segmentação por aplicativo (isso não existe nesse dado — é medição de
rede, não DPI). RAN_NODE é resolvido pra município via
NTW_MABE.MOBILESITE (nome do node) e depois pra UF/Regional via
NTW_OP.TB_AUX_INFO_MUNICIPIOS (join por IBGE — bridge numérico, não por
nome, então não sofre do mesmo risco de descasamento de string que já
corrigimos em outras abas).

O parsing de VOLUME_DADOS_DLUL_ALLOP_4G/VOLUME_TOTAL_DL_TIM_5G (string
com separador de milhar "." e decimal ",", às vezes sem separador de
milhar) é exatamente o que o time de Core validou — só acrescentamos
placeholders de filtro geográfico, sem tocar nessa lógica.
"""

# ---------- Cascata de parsing comum aos dois volumes-string ----------
# (mantida idêntica à query original, só parametrizada pela coluna)

def _volume_parse_case(column: str) -> str:
    return f"""
            CASE
                WHEN INSTR({column}, ',') > 0
                 AND TRANSLATE({column}, 'X0123456789.,', 'X') IS NULL
                THEN TO_NUMBER(
                    REPLACE(
                        REPLACE({column}, '.', ''),
                        ',',
                        '.'
                    )
                )
                WHEN INSTR({column}, ',') = 0
                 AND TRANSLATE({column}, 'X0123456789.', 'X') IS NULL
                THEN TO_NUMBER({column})
            END"""


# ---------- Volumetria por município — último mês disponível ----------
# Mesma query validada pelo time de Core, com {uf_filter}/{municipio_filter}
# (via IBGE)/{regional_filter} aplicados depois do join com
# TB_AUX_INFO_MUNICIPIOS (mesma tabela que resolve UF/Município/Regional,
# então filtrar nela não tem risco de descasamento de nome).
VOLUMETRIA_SNAPSHOT = f"""
WITH VOLUMETRIA_RAN AS (
    SELECT
        RAN_NODE,
        SUM({_volume_parse_case('VOLUME_DADOS_DLUL_ALLOP_4G')}) AS VOLUMETRIA_KB
    FROM NTW_MABE.ALTAIA_PM_MES_4G
    WHERE MES = (SELECT MAX(MES) FROM NTW_MABE.ALTAIA_PM_MES_4G)
    GROUP BY RAN_NODE

    UNION ALL

    SELECT
        RAN_NODE,
        SUM({_volume_parse_case('VOLUME_TOTAL_DL_TIM_5G')}) AS VOLUMETRIA_KB
    FROM NTW_MABE.ALTAIA_PM_MES_5G
    WHERE MES = (SELECT MAX(MES) FROM NTW_MABE.ALTAIA_PM_MES_5G)
    GROUP BY RAN_NODE
),
VOLUMETRIA_COM_IBGE AS (
    SELECT
        V.RAN_NODE,
        M.IBGE_ID,
        V.VOLUMETRIA_KB
    FROM VOLUMETRIA_RAN V
    LEFT JOIN NTW_MABE.MOBILESITE M
        ON UPPER(TRIM(M.NAME)) = UPPER(TRIM(V.RAN_NODE))
)
SELECT
    MUN.IBGE,
    MUN.REGIONAL,
    MUN.UF,
    MUN.MUNICIPIO,
    ROUND(SUM(VCI.VOLUMETRIA_KB) / POWER(1000, 2), 2) AS VOLUMETRIA_GB,
    ROUND(SUM(VCI.VOLUMETRIA_KB) / POWER(1000, 3), 2) AS VOLUMETRIA_TB,
    ROUND(SUM(VCI.VOLUMETRIA_KB) / POWER(1000, 4), 6) AS VOLUMETRIA_PB
FROM VOLUMETRIA_COM_IBGE VCI
LEFT JOIN NTW_OP.TB_AUX_INFO_MUNICIPIOS MUN
    ON MUN.IBGE = VCI.IBGE_ID
WHERE VCI.IBGE_ID IS NOT NULL
{{uf_filter}}
{{municipio_filter}}
{{regional_filter}}
GROUP BY MUN.IBGE, MUN.REGIONAL, MUN.UF, MUN.MUNICIPIO
ORDER BY VOLUMETRIA_PB DESC
"""


# ---------- Volumetria por município — últimos 12 meses ----------
# Janela enxuta de 12 meses (a pedido: reduz o full-scan da série e o peso
# do payload). ADD_MONTHS(..., -11) sobre o MAX(MES) dá 12 pontos
# inclusive o mês corrente. Cada branch (4G/5G) usa seu próprio MAX(MES)
# como referência — evita cortar dado se um dos dois atrasar a carga do
# mês corrente. Sem 13º mês de base: o primeiro ponto da série simplesmente
# não exibe variação MoM (não há mês anterior a ele na janela), e os KPIs
# não têm mais comparação YoY (precisaria do mês de 1 ano atrás).
VOLUMETRIA_HISTORICO_12M = f"""
WITH VOLUMETRIA_RAN AS (
    SELECT
        MES,
        RAN_NODE,
        SUM({_volume_parse_case('VOLUME_DADOS_DLUL_ALLOP_4G')}) AS VOLUMETRIA_KB
    FROM NTW_MABE.ALTAIA_PM_MES_4G
    WHERE MES >= TO_CHAR(
        ADD_MONTHS(TO_DATE((SELECT MAX(MES) FROM NTW_MABE.ALTAIA_PM_MES_4G), 'YYYYMM'), -11),
        'YYYYMM'
    )
    GROUP BY MES, RAN_NODE

    UNION ALL

    SELECT
        MES,
        RAN_NODE,
        SUM({_volume_parse_case('VOLUME_TOTAL_DL_TIM_5G')}) AS VOLUMETRIA_KB
    FROM NTW_MABE.ALTAIA_PM_MES_5G
    WHERE MES >= TO_CHAR(
        ADD_MONTHS(TO_DATE((SELECT MAX(MES) FROM NTW_MABE.ALTAIA_PM_MES_5G), 'YYYYMM'), -11),
        'YYYYMM'
    )
    GROUP BY MES, RAN_NODE
),
VOLUMETRIA_COM_IBGE AS (
    SELECT
        V.MES,
        V.RAN_NODE,
        M.IBGE_ID,
        V.VOLUMETRIA_KB
    FROM VOLUMETRIA_RAN V
    LEFT JOIN NTW_MABE.MOBILESITE M
        ON UPPER(TRIM(M.NAME)) = UPPER(TRIM(V.RAN_NODE))
)
SELECT
    VCI.MES,
    MUN.IBGE,
    MUN.REGIONAL,
    MUN.UF,
    MUN.MUNICIPIO,
    ROUND(SUM(VCI.VOLUMETRIA_KB) / POWER(1000, 4), 6) AS VOLUMETRIA_PB
FROM VOLUMETRIA_COM_IBGE VCI
LEFT JOIN NTW_OP.TB_AUX_INFO_MUNICIPIOS MUN
    ON MUN.IBGE = VCI.IBGE_ID
WHERE VCI.IBGE_ID IS NOT NULL
{{uf_filter}}
{{municipio_filter}}
{{regional_filter}}
GROUP BY VCI.MES, MUN.IBGE, MUN.REGIONAL, MUN.UF, MUN.MUNICIPIO
ORDER BY VCI.MES, VOLUMETRIA_PB DESC
"""
