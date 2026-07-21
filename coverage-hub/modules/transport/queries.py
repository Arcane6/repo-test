"""
Queries do módulo Transporte (perfil de infraestrutura de TX + migração).

Fonte: NTW_OP.REL_TX_PROFILE — 1 linha por site (END_ID), snapshot único
(~33k linhas).

**Agregação no banco (Oracle), não no servidor.** A taxonomia
`TIPO_TX = "<MÍDIA> <CAPACIDADE>"` (ex.: "FO 10G", "MW <1G") é decodificada
em SQL com `REGEXP_SUBSTR`, e todas as contagens saem de `GROUP BY` no
Oracle — o Python só reformata os poucos grupos que voltam pra JSON. Assim
nunca trafegamos as 33k linhas cruas pela rede; cada endpoint faz um punhado
de agregações que retornam ≤ ~64 linhas cada.

Expressões-chave (montadas por `_media_expr` / `_cap_expr`):
- **Mídia** = 1º token do TIPO_TX ∈ {FO, MW, SAT, LL, SLS}; token
  desconhecido → 'N/I'; coluna vazia → NULL (o service mapeia p/ "Não
  definido"). **RanSharing** (CLASSIFICACAO='RANSHARING') sobrescreve a
  mídia pra 'RS' — RS não existe no TIPO_TX, veio desse override.
- **Capacidade** = 2º token ∈ {10G, 1G, <1G}; outro → 'Outros'; sem 2º
  token → NULL (excluído do denominador de %10G).
- **TECNOLOGIA** é uma string multi-rádio ("2G/3G/4G/5G"); a presença de
  cada rádio é testada com INSTR (um site pode contar em vários).
"""

TABLE = "NTW_OP.REL_TX_PROFILE"

# 1º token (mídia): tudo que não for uma mídia física conhecida vira 'N/I';
# coluna em branco vira NULL. O override de RanSharing vem antes de tudo.
_MEDIA_TOKENS = "('FO', 'MW', 'SAT', 'LL', 'SLS')"
_CAP_TOKENS = "('10G', '1G', '<1G')"


def _media_expr(col):
    """SQL que resolve a mídia de uma coluna TIPO_TX (com override de RS)."""
    tok = f"UPPER(REGEXP_SUBSTR(TRIM({col}), '[^[:space:]]+', 1, 1))"
    return (
        "CASE "
        "WHEN UPPER(TRIM(CLASSIFICACAO)) = 'RANSHARING' THEN 'RS' "
        f"WHEN TRIM({col}) IS NULL THEN NULL "
        f"WHEN {tok} IN {_MEDIA_TOKENS} THEN {tok} "
        "ELSE 'N/I' END"
    )


def _cap_expr(col):
    """SQL que resolve a capacidade (2º token) de uma coluna TIPO_TX."""
    tok = f"UPPER(REGEXP_SUBSTR(TRIM({col}), '[^[:space:]]+', 1, 2))"
    return (
        "CASE "
        f"WHEN {tok} IS NULL THEN NULL "
        f"WHEN {tok} IN {_CAP_TOKENS} THEN {tok} "
        "ELSE 'Outros' END"
    )


# ---------------------------------------------------------------------------
# Builders de query — cada um agrega no Oracle e devolve poucas linhas.
# `filters` é a cláusula "AND ..." já montada pelo service (UF/regional/mun).
# ---------------------------------------------------------------------------

def media_transition_sql(filters):
    """Matriz de transição de mídia 25→26 (GROUP BY mídia25, mídia26).

    Uma única query serve VÁRIOS números: totais por mídia em 25 (soma por
    `de`), em 26 (soma por `para`), a variação 25→26 e os fluxos de migração
    (linhas com de≠para)."""
    de = _media_expr("TIPO_TX_25")
    para = _media_expr("TIPO_TX_26")
    return f"""
SELECT {de} AS de, {para} AS para, COUNT(*) AS n
FROM {TABLE}
WHERE 1 = 1 {filters}
GROUP BY {de}, {para}
"""


def cap_transition_sql(filters):
    """Capacidade 25 × 26 (GROUP BY cap25, cap26) — dá os totais de
    capacidade de cada raia num só GROUP BY (p/ o % de Alta Capacidade 10G)."""
    c25 = _cap_expr("TIPO_TX_25")
    c26 = _cap_expr("TIPO_TX_26")
    return f"""
SELECT {c25} AS c25, {c26} AS c26, COUNT(*) AS n
FROM {TABLE}
WHERE 1 = 1 {filters}
GROUP BY {c25}, {c26}
"""


def plano_profile_sql(filters):
    """Perfil da raia Plano 26 (só sites com TIPO_TX_PLAN preenchido):
    mídia × capacidade do plano, agregado no banco."""
    media = _media_expr("TIPO_TX_PLAN")
    cap = _cap_expr("TIPO_TX_PLAN")
    return f"""
SELECT {media} AS media, {cap} AS capac, COUNT(*) AS n
FROM {TABLE}
WHERE 1 = 1 {filters}
  AND TRIM(TIPO_TX_PLAN) IS NOT NULL
GROUP BY {media}, {cap}
"""


def make_buy_sql(filters):
    """MAKE × BUY (estratégia de construção de fibra) — GROUP BY método,
    já excluindo os nulos no banco."""
    return f"""
SELECT TRIM(METODO_CONSTRUTIVO_FO) AS metodo, COUNT(*) AS n
FROM {TABLE}
WHERE 1 = 1 {filters}
  AND TRIM(METODO_CONSTRUTIVO_FO) IS NOT NULL
GROUP BY TRIM(METODO_CONSTRUTIVO_FO)
"""


def fiber_por_regional_sql(filters):
    """Fiberização por regional (base 26): GROUP BY regional × mídia26. O
    service divide FO ÷ definidos por regional."""
    media = _media_expr("TIPO_TX_26")
    return f"""
SELECT NVL(TRIM(REGIONAL), 'N/D') AS regional, {media} AS media, COUNT(*) AS n
FROM {TABLE}
WHERE 1 = 1 {filters}
GROUP BY NVL(TRIM(REGIONAL), 'N/D'), {media}
"""


def fiber_por_tecnologia_sql(filters):
    """Fiberização por rádio servido (base 26). TECNOLOGIA é multi-valor
    ("2G/3G/4G/5G"), então usamos agregação condicional (INSTR) — 1 linha
    com total e total-em-FO de cada rádio."""
    fo = f"({_media_expr('TIPO_TX_26')} = 'FO')"
    cols = []
    for t in ("2G", "3G", "4G", "5G"):
        has = f"INSTR(TECNOLOGIA, '{t}') > 0"
        cols.append(f"SUM(CASE WHEN {has} THEN 1 ELSE 0 END) AS tot_{t[0]}g")
        cols.append(
            f"SUM(CASE WHEN {has} AND {fo} THEN 1 ELSE 0 END) AS fo_{t[0]}g"
        )
    select = ",\n    ".join(cols)
    return f"""
SELECT
    {select}
FROM {TABLE}
WHERE 1 = 1 {filters}
"""
