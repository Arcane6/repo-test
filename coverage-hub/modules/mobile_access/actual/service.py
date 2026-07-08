"""
Service layer da aba "Rede Hoje" do módulo Mobile Access.
"""

from database.oracle import execute_query

from modules.mobile_access.shared.constants import (
    TECH_COLORS,
    TECH_ORDER,
    TIM_BRAND_COLOR,
)
from modules.mobile_access.actual.queries import (
    BASE_CTE_TEMPLATE,
    KPIS_TEMPLATE,
    VENN_TEMPLATE,
    TABLE_TEMPLATE,
    UFS_QUERY,
    MUNICIPIOS_SEARCH_QUERY,
    FREQUENCIES_TEMPLATE,
    TIMESERIES_TEMPLATE,
)


# ---------------------------------------------------------------------------
# Helpers de normalização
# ---------------------------------------------------------------------------

def _normalize_list(value):
    """Converte lista, string com vírgulas ou None em lista limpa."""
    if not value:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()]


# ---------------------------------------------------------------------------
# Helpers de montagem de SQL dinâmico
# ---------------------------------------------------------------------------

def _build_in_clause(field, values, prefix, params):
    if not values:
        return ""
    placeholders = []
    for i, v in enumerate(values):
        key = f"{prefix}_{i}"
        params[key] = v
        placeholders.append(f":{key}")
    return f"AND {field} IN ({', '.join(placeholders)})"


def _build_tec_clause(tecs, params):
    if not tecs:
        return ""
    conditions = []
    for tec in tecs:
        tec_upper = tec.upper()
        if tec_upper in TECH_ORDER:
            conditions.append(f"PRESENCA_{tec_upper} = 1")
    if not conditions:
        return ""
    return "AND (" + " OR ".join(conditions) + ")"


def _build_query(base_template, ufs, municipios, tecs):
    params = {}

    uf_clause = _build_in_clause("UF", ufs, "uf", params)
    mun_clause = _build_in_clause("MUNICIPIO", municipios, "mun", params)
    tec_clause = _build_tec_clause(tecs, params)

    cte = BASE_CTE_TEMPLATE.format(
        uf_filter=uf_clause,
        municipio_filter=mun_clause,
        tecnologia_filter=tec_clause,
    )
    return cte + base_template, params


def _prepare(ufs, municipios, tecs):
    return (
        _normalize_list(ufs),
        _normalize_list(municipios),
        _normalize_list(tecs),
    )


def _pct(value, total):
    if not total:
        return 0.0
    return round((value / total) * 100, 2)


# ---------------------------------------------------------------------------
# Endpoints de dados de apoio
# ---------------------------------------------------------------------------

def get_ufs():
    """UFs distintas da última carga (para dropdown)."""
    return [row["uf"] for row in execute_query(UFS_QUERY)]


def search_municipios(q="", uf=None):
    """Busca municípios por prefixo, opcionalmente restringido por UF."""
    q = (q or "").strip()
    like = f"%{q}%" if q else "%"

    params = {"q": like}
    uf_clause = ""

    ufs = _normalize_list(uf)
    if ufs:
        placeholders = []
        for i, v in enumerate(ufs):
            key = f"uf_{i}"
            params[key] = v
            placeholders.append(f":{key}")
        uf_clause = f"AND UF IN ({', '.join(placeholders)})"

    sql = MUNICIPIOS_SEARCH_QUERY.format(uf_filter=uf_clause)
    return execute_query(sql, params)


# ---------------------------------------------------------------------------
# Endpoints de visualização
# ---------------------------------------------------------------------------

def get_kpis(ufs=None, municipios=None, tecs=None):
    ufs, municipios, tecs = _prepare(ufs, municipios, tecs)

    sql, params = _build_query(KPIS_TEMPLATE, ufs, municipios, tecs)
    result = execute_query(sql, params)
    row = result[0] if result else {}

    total = row.get("total_municipios", 0) or 0
    cobertos = row.get("municipios_cobertos", 0) or 0
    m_5g = row.get("municipios_5g", 0) or 0
    m_4g = row.get("municipios_4g", 0) or 0
    m_3g = row.get("municipios_3g", 0) or 0
    m_2g = row.get("municipios_2g", 0) or 0

    return {
        "total_municipios": total,
        "cards": [
            {"label": "Municípios TIM", "value": cobertos, "percent": _pct(cobertos, total), "color": TIM_BRAND_COLOR},
            {"label": "5G", "value": m_5g, "percent": _pct(m_5g, total), "color": TECH_COLORS["5G"]},
            {"label": "4G", "value": m_4g, "percent": _pct(m_4g, total), "color": TECH_COLORS["4G"]},
            {"label": "3G", "value": m_3g, "percent": _pct(m_3g, total), "color": TECH_COLORS["3G"]},
            {"label": "2G", "value": m_2g, "percent": _pct(m_2g, total), "color": TECH_COLORS["2G"]},
        ],
    }


def get_venn(ufs=None, municipios=None, tecs=None):
    ufs, municipios, tecs = _prepare(ufs, municipios, tecs)

    sql, params = _build_query(VENN_TEMPLATE, ufs, municipios, tecs)
    result = execute_query(sql, params)
    row = result[0] if result else {}

    total = row.get("total_municipios", 0) or 0
    total_2g = row.get("total_2g", 0) or 0
    total_3g = row.get("total_3g", 0) or 0
    total_5g = row.get("total_5g", 0) or 0

    return {
        "legend": [
            {"label": "2G", "value": total_2g, "percent": _pct(total_2g, total), "color": TECH_COLORS["2G"]},
            {"label": "3G", "value": total_3g, "percent": _pct(total_3g, total), "color": TECH_COLORS["3G"]},
            {"label": "5G", "value": total_5g, "percent": _pct(total_5g, total), "color": TECH_COLORS["5G"]},
        ],
        "regions": {
            "only_2g": row.get("only_2g", 0) or 0,
            "only_3g": row.get("only_3g", 0) or 0,
            "only_5g": row.get("only_5g", 0) or 0,
            "inter_2g_3g": row.get("inter_2g_3g", 0) or 0,
            "inter_2g_5g": row.get("inter_2g_5g", 0) or 0,
            "inter_3g_5g": row.get("inter_3g_5g", 0) or 0,
            "inter_all": row.get("inter_all", 0) or 0,
        },
        "total_municipios": total,
    }


def get_table(ufs=None, municipios=None, tecs=None):
    ufs, municipios, tecs = _prepare(ufs, municipios, tecs)
    sql, params = _build_query(TABLE_TEMPLATE, ufs, municipios, tecs)
    return execute_query(sql, params)


def get_frequencies(ufs=None, municipios=None, tecs=None):
    ufs, municipios, tecs = _prepare(ufs, municipios, tecs)

    sql, params = _build_query(FREQUENCIES_TEMPLATE, ufs, municipios, tecs)
    result = execute_query(sql, params)

    bars = []
    groups_map = {}
    for row in result:
        tec = row["tec"]
        banda = row["banda"]
        qtd = row["qtd"] or 0
        bars.append({
            "tec": tec,
            "banda": banda,
            "value": qtd,
            "color": TECH_COLORS.get(tec, "#888"),
        })
        if tec not in groups_map:
            groups_map[tec] = {
                "tec": tec,
                "color": TECH_COLORS.get(tec, "#888"),
                "start": len(bars) - 1,
                "end": len(bars) - 1,
            }
        else:
            groups_map[tec]["end"] = len(bars) - 1

    groups = [groups_map[t] for t in TECH_ORDER if t in groups_map]
    return {"bars": bars, "groups": groups}


def get_timeseries(ufs=None, municipios=None, tecs=None):
    ufs, municipios, tecs = _prepare(ufs, municipios, tecs)

    sql, params = _build_query(TIMESERIES_TEMPLATE, ufs, municipios, tecs)
    result = execute_query(sql, params)

    active_tecs = [t.upper() for t in tecs] if tecs else TECH_ORDER

    by_tec = {t: {} for t in TECH_ORDER}
    all_periods = set()

    for row in result:
        tec = row["tec"]
        periodo = row["periodo"]
        qtd = row["qtd"] or 0
        if tec not in by_tec:
            continue

        if hasattr(periodo, "strftime"):
            key = periodo.strftime("%Y-%m-01")
        else:
            key = str(periodo)[:10]

        by_tec[tec][key] = by_tec[tec].get(key, 0) + qtd
        all_periods.add(key)

    periods = sorted(all_periods)

    series = []
    for tec in TECH_ORDER:
        if tec not in active_tecs:
            continue
        running = 0
        values = []
        for p in periods:
            running += by_tec[tec].get(p, 0)
            values.append(running)
        series.append({
            "tec": tec,
            "color": TECH_COLORS[tec],
            "values": values,
        })

    return {"periods": periods, "series": series}