"""
Service do módulo Transporte (perfil de infraestrutura de TX + migração).

**Toda a agregação acontece no Oracle** (ver queries.py): as contagens por
mídia, capacidade, migração, MAKE/BUY e fiberização saem de `GROUP BY` no
banco. Aqui a gente só monta a cláusula de filtro, dispara as queries e
reformata os poucos grupos que voltam pro shape de JSON que o front espera.

Regras de negócio (implementadas em SQL, documentadas aqui):
- **Mídia** = 1º token do TIPO_TX (FO/MW/SAT/LL/SLS); token desconhecido →
  'N/I'; coluna vazia → NULL, que aqui vira "Não definido". **RanSharing**
  (CLASSIFICACAO='RANSHARING') sobrescreve a mídia pra 'RS'.
- **Capacidade** = 2º token (10G/1G/<1G) ou "Outros"; sem 2º token → fora do
  denominador de %10G.
- **Fiberização** = FO ÷ sites com mídia definida (exclui "Não definido").
- **% 10G** = sites 10G ÷ sites com capacidade conhecida.
- **Raias**: Fechamento 2025 = TIPO_TX_25 · Plano 26 = TIPO_TX_PLAN (só os
  sites com plano explícito) · Fechamento 26 = TIPO_TX_26.
"""

from database.oracle import execute_query

from modules.transport import queries as q

MEDIA_ORDER = ["FO", "MW", "RS", "SAT", "LL", "SLS", "N/I", "Não definido"]
CAP_ORDER = ["10G", "1G", "<1G", "Outros"]
TECS = ["2G", "3G", "4G", "5G"]
UNDEF = "Não definido"


# ---------------------------------------------------------------------------
# Filtros (UF direto, Regional direto, Município via ponte IBGE — igual Tráfego)
# ---------------------------------------------------------------------------

def _normalize_list(value):
    if not value:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()]


def _build_uf_clause(values, params):
    if not values:
        return ""
    ph = []
    for i, v in enumerate(values):
        key = f"uf_{i}"
        params[key] = v.upper()
        ph.append(f":{key}")
    return f" AND UPPER(TRIM(UF)) IN ({', '.join(ph)})"


def _build_regional_clause(values, params):
    if not values:
        return ""
    ph = []
    for i, v in enumerate(values):
        key = f"reg_{i}"
        params[key] = v.upper()
        ph.append(f":{key}")
    return f" AND UPPER(TRIM(REGIONAL)) IN ({', '.join(ph)})"


def _build_municipio_clause(values, params):
    """Ponte por IBGE (mesma de Tráfego/sites): resolve nome → IBGE via
    MUNICIPIOS_FECHAMENTO e filtra IBGE_ID (6 dígitos)."""
    if not values:
        return ""
    ph = []
    for i, v in enumerate(values):
        key = f"mun_{i}"
        params[key] = v
        ph.append(f":{key}")
    in_list = ", ".join(ph)
    return f""" AND TO_CHAR(IBGE_ID) IN (
        SELECT SUBSTR(TO_CHAR(IBGE), 1, 6)
        FROM NTW_OP.MUNICIPIOS_FECHAMENTO
        WHERE TRUNC(DT_CARGA) = (SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO)
        AND MUNICIPIO IN ({in_list})
    )"""


def _filters(filters):
    """Monta a cláusula única 'AND ...' compartilhada por todas as queries."""
    params = {}
    clause = (
        _build_uf_clause(_normalize_list(filters.get("ufs")), params)
        + _build_municipio_clause(_normalize_list(filters.get("municipios")), params)
        + _build_regional_clause(_normalize_list(filters.get("regionais")), params)
    )
    return clause, params


# ---------------------------------------------------------------------------
# Helpers de reformatação (os grupos já vêm agregados do banco)
# ---------------------------------------------------------------------------

def _media_label(value):
    """NULL do banco (coluna vazia) → 'Não definido'; o resto vem pronto."""
    return value if value else UNDEF


def _ordered_media(counts):
    known = [m for m in MEDIA_ORDER if counts.get(m)]
    extra = [m for m in counts if m not in MEDIA_ORDER and counts.get(m)]
    return known + sorted(extra)


def _collapse(rows, key):
    """Colapsa a matriz de transição numa contagem 1-D por mídia/capacidade."""
    out = {}
    for r in rows:
        label = _media_label(r.get(key))
        out[label] = out.get(label, 0) + int(r.get("n") or 0)
    return out


def _collapse_cap(rows, key):
    out = {}
    for r in rows:
        c = r.get(key)
        if not c:  # sem 2º token → fora do denominador de %10G
            continue
        out[c] = out.get(c, 0) + int(r.get("n") or 0)
    return out


def _perfil(media_counts, cap_counts):
    total = sum(media_counts.values())
    definidos = total - media_counts.get(UNDEF, 0)
    fo = media_counts.get("FO", 0)
    cap_total = sum(cap_counts.values())
    return {
        "total_sites": total,
        "definidos": definidos,
        "pct_fibra": round(fo / definidos * 100, 1) if definidos else None,
        "pct_10g": round(cap_counts.get("10G", 0) / cap_total * 100, 1) if cap_total else None,
        "por_midia": [{"label": m, "value": media_counts[m]} for m in _ordered_media(media_counts)],
        "por_capacidade": [{"label": c, "value": cap_counts[c]} for c in CAP_ORDER if cap_counts.get(c)],
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

def get_resumo_executivo(filters):
    """3 raias: Fechamento 2025 (TX_25) · Plano 26 (TX_PLAN) · Fechamento 26
    (TX_26). Tudo agregado no Oracle: 3 queries (transição de mídia,
    transição de capacidade e perfil do plano)."""
    clause, params = _filters(filters)

    trans = execute_query(q.media_transition_sql(clause), params) or []
    cap = execute_query(q.cap_transition_sql(clause), params) or []
    plano = execute_query(q.plano_profile_sql(clause), params) or []

    m25 = _collapse(trans, "de")
    m26 = _collapse(trans, "para")
    c25 = _collapse_cap(cap, "c25")
    c26 = _collapse_cap(cap, "c26")

    fechamento_2025 = _perfil(m25, c25)
    fechamento_26 = _perfil(m26, c26)
    plano_26 = _perfil(_collapse(plano, "media"), _collapse_cap(plano, "capac"))

    # Variação de mídia 25→26 (destaque da raia Fechamento 26).
    medias = _ordered_media({**m25, **m26})
    fechamento_26["variacao"] = [
        {"label": m, "delta": m26.get(m, 0) - m25.get(m, 0)}
        for m in medias if m != UNDEF
    ]

    return {
        "fechamento_2025": fechamento_2025,
        "plano_26": plano_26,
        "fechamento_26": fechamento_26,
    }


def get_composicao(filters):
    """Aba 2 — Composição & Migração 25×26. Agregado no Oracle: matriz de
    transição (serve composição + migração), MAKE/BUY e fiberização por
    regional/tecnologia."""
    clause, params = _filters(filters)

    trans = execute_query(q.media_transition_sql(clause), params) or []
    make_buy_rows = execute_query(q.make_buy_sql(clause), params) or []
    reg_rows = execute_query(q.fiber_por_regional_sql(clause), params) or []
    tec_rows = execute_query(q.fiber_por_tecnologia_sql(clause), params) or []

    m25 = _collapse(trans, "de")
    m26 = _collapse(trans, "para")

    # Barras 25×26 por mídia (a "variação de composição por tipo" pedida).
    medias = [m for m in _ordered_media({**m25, **m26}) if m != UNDEF]
    por_midia = [
        {"midia": m, "c25": m25.get(m, 0), "c26": m26.get(m, 0), "delta": m26.get(m, 0) - m25.get(m, 0)}
        for m in medias
    ]

    # Fluxos de migração 25→26 (só quem mudou de mídia; exclui "Não definido").
    migracao = sorted(
        (
            {"de": _media_label(r.get("de")), "para": _media_label(r.get("para")),
             "value": int(r.get("n") or 0)}
            for r in trans
            if _media_label(r.get("de")) != _media_label(r.get("para"))
            and UNDEF not in (_media_label(r.get("de")), _media_label(r.get("para")))
        ),
        key=lambda x: x["value"], reverse=True,
    )[:10]

    # MAKE × BUY (estratégia de construção de fibra) — nulos já saíram no SQL.
    make_buy = sorted(
        ({"label": r.get("metodo"), "value": int(r.get("n") or 0)} for r in make_buy_rows),
        key=lambda x: x["value"], reverse=True,
    )

    # Fiberização por regional (base 26): FO ÷ definidos por regional.
    reg = {}
    for r in reg_rows:
        rg = r.get("regional") or "N/D"
        d = reg.setdefault(rg, {"total": 0, "definidos": 0, "fo": 0})
        media = _media_label(r.get("media"))
        n = int(r.get("n") or 0)
        d["total"] += n
        if media != UNDEF:
            d["definidos"] += n
        if media == "FO":
            d["fo"] += n
    por_regional = sorted(
        [
            {"regional": k, "total": v["total"],
             "pct_fibra": round(v["fo"] / v["definidos"] * 100, 1) if v["definidos"] else 0.0}
            for k, v in reg.items()
        ],
        key=lambda x: x["pct_fibra"], reverse=True,
    )

    # Fiberização por tecnologia de rádio (base 26) — 1 linha de agregação
    # condicional (um site multi-rádio conta em cada tecnologia servida).
    tr = tec_rows[0] if tec_rows else {}
    por_tecnologia = []
    for t in TECS:
        total = int(tr.get(f"tot_{t[0].lower()}g") or 0)
        fo = int(tr.get(f"fo_{t[0].lower()}g") or 0)
        por_tecnologia.append({
            "tec": t, "total": total,
            "pct_fibra": round(fo / total * 100, 1) if total else 0.0,
        })

    return {
        "por_midia": por_midia,
        "migracao": migracao,
        "make_buy": make_buy,
        "por_regional": por_regional,
        "por_tecnologia": por_tecnologia,
    }


# ---------------------------------------------------------------------------
# Aba 3 — Infraestrutura & Fornecimento
# ---------------------------------------------------------------------------

def _labeled(rows, top=None):
    """[{label, value}] ordenado desc; opcionalmente só o top-N."""
    out = sorted(
        ({"label": r.get("label"), "value": int(r.get("n") or 0)} for r in rows if r.get("label")),
        key=lambda x: x["value"], reverse=True,
    )
    return out[:top] if top else out


def get_infraestrutura(filters):
    """Aba 3 — perfil de infra/fornecimento a partir de colunas próprias da
    REL_TX_PROFILE (solução, provedor, status, classificação, rollout).
    Tudo agregado no Oracle."""
    clause, params = _filters(filters)

    solucao = execute_query(q.por_solucao_sql(clause), params) or []
    provedor = execute_query(q.por_provedor_sql(clause), params) or []
    status = execute_query(q.por_status_sql(clause), params) or []
    classif = execute_query(q.por_classificacao_sql(clause), params) or []
    rollout = execute_query(q.por_rollout_sql(clause), params) or []

    return {
        "por_solucao": _labeled(solucao),
        "por_provedor": _labeled(provedor, top=10),
        "por_status": _labeled(status),
        "por_classificacao": _labeled(classif),
        # rollout já vem ordenado por ano no SQL; mantém a ordem cronológica.
        "por_rollout": [
            {"ano": r.get("label"), "value": int(r.get("n") or 0)}
            for r in rollout if r.get("label")
        ],
    }


# Paleta de mídia no backend (espelha TRANSPORT_COLORS do front) — o mapa
# precisa da cor pronta em cada ponto, como faz o mapa de Sites.
_MEDIA_COLORS = {
    "FO": "#2E9E5B", "MW": "#F5A623", "RS": "#00ACC1", "SAT": "#7B1FA2",
    "LL": "#607D8B", "SLS": "#EC407A", "N/I": "#B0BEC5",
}
_MEDIA_UNDEF_COLOR = "#CFD8DC"


def get_geo_points(filters):
    """Um ponto por site de transporte (END_ID, lat/long, mídia+cor) — o
    mapa é ponto-a-ponto (não agregável sem perder a coordenada)."""
    clause, params = _filters(filters)
    rows = execute_query(q.geo_points_sql(clause), params) or []
    points = []
    for r in rows:
        try:
            lat = float(r.get("latitude"))
            lon = float(r.get("longitude"))
        except (TypeError, ValueError):
            continue
        media = _media_label(r.get("media"))
        points.append({
            "end_id": r.get("end_id"),
            "uf": r.get("uf"),
            "municipio": r.get("municipio"),
            "lat": lat,
            "lon": lon,
            "media": media,
            "color": _MEDIA_COLORS.get(media, _MEDIA_UNDEF_COLOR),
        })
    return {"points": points}
