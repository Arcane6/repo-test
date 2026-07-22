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
  definido"). **RanSharing NÃO é mídia**: mídia (FO/MW/...) e posse
  (ransharing) são dimensões diferentes — o antigo override que forçava
  mídia='RS' quando CLASSIFICACAO='RANSHARING' foi REMOVIDO a pedido do
  usuário (congelava 372 sites nas duas raias, delta 0 sempre, e escondia
  migrações reais tipo SAT→FO). Ransharing segue visível na aba
  Infraestrutura ("Camada de Rede", via CLASSIFICACAO).
- **Capacidade** = 2º token ∈ {10G, 1G, <1G}; outro → 'Outros'; sem 2º
  token → NULL (excluído do denominador de %10G).
- **TECNOLOGIA** é uma string multi-rádio ("2G/3G/4G/5G"); a presença de
  cada rádio é testada com INSTR (um site pode contar em vários).
"""

TABLE = "NTW_OP.REL_TX_PROFILE"

# 1º token (mídia): tudo que não for uma mídia física conhecida vira 'N/I';
# coluna em branco vira NULL.
_MEDIA_TOKENS = "('FO', 'MW', 'SAT', 'LL', 'SLS')"
_CAP_TOKENS = "('10G', '1G', '<1G')"


def _media_expr(col):
    """SQL que resolve a mídia física de uma coluna TIPO_TX."""
    tok = f"UPPER(REGEXP_SUBSTR(TRIM({col}), '[^[:space:]]+', 1, 1))"
    return (
        "CASE "
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


# ---------------------------------------------------------------------------
# Aba 3 — Infraestrutura & Fornecimento. Colunas próprias da REL_TX_PROFILE
# que ainda não usávamos; tudo agregado no Oracle (exceto o mapa, que por
# natureza é ponto-a-ponto).
# ---------------------------------------------------------------------------

def _dim_count_sql(dim_expr, filters, drop_null=True):
    """Query genérica 'GROUP BY <dim>, COUNT(*)' — a base de quase todos os
    cards de infraestrutura. `drop_null` tira quem tem a dimensão vazia."""
    extra = f" AND {dim_expr} IS NOT NULL" if drop_null else ""
    return f"""
SELECT {dim_expr} AS label, COUNT(*) AS n
FROM {TABLE}
WHERE 1 = 1 {filters}{extra}
GROUP BY {dim_expr}
"""


def por_solucao_sql(filters):
    """Solução técnica do enlace (FTTS CAP = fibra comprada, FTTS MAKE =
    própria, MW = microondas). Coluna 100% preenchida."""
    return _dim_count_sql("UPPER(TRIM(SOLUCAO))", filters)


def por_provedor_sql(filters):
    """Provedor do backhaul comprado (VTAL, GGNET, Desktop, Oi...) — de quem
    a TIM depende na fibra de terceiros. Só onde há provedor informado."""
    return _dim_count_sql("UPPER(TRIM(PROVEDOR))", filters)


def por_status_sql(filters):
    """Status do END_ID (Ativado / Remanejado / Desativado). 100% preenchido."""
    return _dim_count_sql("INITCAP(TRIM(STS_END_ID))", filters)


def por_classificacao_sql(filters):
    """Camada de rede do enlace (Acesso / Transporte / Core / RanSharing...)."""
    return _dim_count_sql("UPPER(TRIM(CLASSIFICACAO))", filters)


def por_rollout_sql(filters):
    """Ano de rollout do site de transporte — curva temporal de entrada.
    Só considera anos plausíveis (4 dígitos) pra descartar sujeira."""
    dim = "TRIM(ANO_ROLLOUT)"
    return f"""
SELECT {dim} AS label, COUNT(*) AS n
FROM {TABLE}
WHERE 1 = 1 {filters}
  AND REGEXP_LIKE(TRIM(ANO_ROLLOUT), '^[0-9]{{4}}$')
GROUP BY {dim}
ORDER BY {dim}
"""


# ---------------------------------------------------------------------------
# Aba 4 — Reconciliação REL_TX_PROFILE × Base Única de Sites.
# Único ponto do módulo que TOCA a Base Única: join por END_ID (o usuário
# confirmou que é o mesmo END_ID nas duas). A Base Única traz o TX "atual"
# (inventário no MES_REF mais recente) em 3 colunas — MEIO_TX_ATUAL (mídia
# já parseada), MEIO_TX_CAPACIDADE (<mídia> <capacidade>) e SOLUCAO_FO
# (MAKE/BUY). Aqui comparamos a MÍDIA: TX_PROFILE (Fech.26) × Base (atual).
# ---------------------------------------------------------------------------

BASE_UNICA = "NTW_OP.TB_FT_BASE_UNICA_SITES"


def _base_media_expr():
    """Mídia da Base Única (MEIO_TX_ATUAL). Vazio e '-' viram NULL — o
    service trata como 'Não definido' e NÃO conta como divergência (é dado
    faltando, não conflito de cadastro)."""
    col = "TRIM(b.MEIO_TX_ATUAL)"
    return f"CASE WHEN {col} IS NULL OR {col} = '-' THEN NULL ELSE UPPER({col}) END"


def reconciliacao_sql(filters_t):
    """Matriz mídia(TX_PROFILE Fech.26) × mídia(Base Única atual) pros sites
    presentes nas DUAS bases (inner join por END_ID, Base no MES_REF mais
    recente). A diagonal é concordância; o resto é divergência de cadastro.
    `filters_t` traz os filtros de UF/regional/município já qualificados
    com 't.' (lado do TX_PROFILE)."""
    media_tx = _media_expr("t.TIPO_TX_26")
    media_base = _base_media_expr()
    return f"""
SELECT
    {media_tx} AS media_tx,
    {media_base} AS media_base,
    COUNT(*) AS n
FROM {TABLE} t
JOIN {BASE_UNICA} b
  ON b.END_ID = t.END_ID
 AND b.MES_REF = (SELECT MAX(MES_REF) FROM {BASE_UNICA})
WHERE 1 = 1 {filters_t}
GROUP BY {media_tx}, {media_base}
"""


def reconciliacao_divergencias_sql(filters_t, limit=5000):
    """Lista site a site das divergências REAIS (mídia definida nas DUAS bases
    e diferente entre elas) — a worklist de correção. Traz o tipo bruto de
    cada base (TIPO_TX_26 × MEIO_TX_CAPACIDADE) e o IBGE pra localizar."""
    media_tx = _media_expr("t.TIPO_TX_26")
    media_base = _base_media_expr()
    return f"""
SELECT
    t.END_ID       AS end_id,
    t.IBGE_ID      AS ibge_id,
    t.UF           AS uf,
    t.MUNICIPIO    AS municipio,
    t.TIPO_TX_26   AS tipo_tx,
    b.MEIO_TX_CAPACIDADE AS tipo_base,
    {media_tx}  AS media_tx,
    {media_base} AS media_base
FROM {TABLE} t
JOIN {BASE_UNICA} b
  ON b.END_ID = t.END_ID
 AND b.MES_REF = (SELECT MAX(MES_REF) FROM {BASE_UNICA})
WHERE 1 = 1 {filters_t}
  AND {media_tx} IS NOT NULL
  AND {media_base} IS NOT NULL
  AND {media_tx} <> {media_base}
ORDER BY t.UF, t.MUNICIPIO, t.END_ID
FETCH FIRST {int(limit)} ROWS ONLY
"""


def total_tx_sql(filters_t):
    """Total de sites no TX_PROFILE (com os mesmos filtros) — pra medir
    quantos NÃO têm par na Base Única (só_no_tx = total − em_ambas)."""
    return f"""
SELECT COUNT(*) AS n
FROM {TABLE} t
WHERE 1 = 1 {filters_t}
"""


def geo_points_sql(filters):
    """Um ponto por site de transporte, colorido pela mídia (base 26). O
    mapa é ponto-a-ponto por natureza — não dá pra agregar sem perder a
    coordenada; descarta sites sem lat/long."""
    media = _media_expr("TIPO_TX_26")
    return f"""
SELECT
    END_ID, UF, MUNICIPIO,
    LATITUDE, LONGITUDE,
    {media} AS media
FROM {TABLE}
WHERE 1 = 1 {filters}
  AND LATITUDE IS NOT NULL
  AND LONGITUDE IS NOT NULL
"""
