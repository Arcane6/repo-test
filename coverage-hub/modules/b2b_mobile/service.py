"""
Service layer do módulo B2B Mobile.
"""

from flask import request

from database.oracle import execute_query
from modules.b2b_mobile.queries import (
    BASE_CTE_TEMPLATE,
    KPIS_TEMPLATE,
    TOP_CLIENTES_TEMPLATE,
    BY_VERTICAL_TEMPLATE,
    BY_TECH_TEMPLATE,
    BY_UF_TEMPLATE,
    TABLE_TEMPLATE,
    VERTICAIS_QUERY,
    CLIENTES_SEARCH_QUERY,
    ANOS_QUERY,
)


DEFAULT_YEAR = 2026

TECH_COLORS = {
    "2G": "#1E88E5",
    "3G": "#E53935",
    "4G": "#F5C518",
    "5G": "#7DC242",
}

VERTICAL_COLORS = {
    "Agronegócio":    "#7DC242",
    "Logística":      "#F5C518",
    "Indústria":      "#E53935",
    "Mineração":      "#795548",
    "Corporate Top":  "#003399",
    "Genérico":       "#6c757d",
}


# ---------------------------------------------------------------------------
# Helpers de normalização
# ---------------------------------------------------------------------------

def _normalize_list(value):
    if not value:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()]


def _build_in_clause(field, values, prefix, params):
    if not values:
        return ""
    placeholders = []
    for i, v in enumerate(values):
        key = f"{prefix}_{i}"
        params[key] = v
        placeholders.append(f":{key}")
    return f"AND {field} IN ({', '.join(placeholders)})"


def _build_query(base_body, filters):
    """
    Monta CTE + corpo aplicando todos os filtros.
    """
    params = {}

    # Ano
    ano = filters.get("ano") or DEFAULT_YEAR
    try:
        params["ano"] = int(ano)
    except (TypeError, ValueError):
        params["ano"] = DEFAULT_YEAR
    ano_filter = "AND r.PLANO = :ano"

    # Status
    if filters.get("include_closed"):
        status_filter = "AND r.STATUS_OC IN ('ACTIVATED', 'CLOSED')"
    else:
        status_filter = "AND r.STATUS_OC = 'ACTIVATED'"

    # Filtros pós-CTE
    ufs = _normalize_list(filters.get("ufs"))
    muns = _normalize_list(filters.get("municipios"))
    verticais = _normalize_list(filters.get("verticais"))
    clientes = _normalize_list(filters.get("clientes"))
    tecs = _normalize_list(filters.get("tecs"))

    uf_filter = _build_in_clause("d.UF", ufs, "uf", params)
    mun_filter = _build_in_clause("d.MUNICIPIO", muns, "mun", params)
    vertical_filter = _build_in_clause("b.VERTICAL", verticais, "vert", params)
    cliente_filter = _build_in_clause("b.CLIENTE", [c.upper() for c in clientes], "cli", params)

    tec_filter = ""
    if tecs:
        placeholders = []
        for i, t in enumerate(tecs):
            key = f"tec_{i}"
            params[key] = t.upper()
            placeholders.append(f":{key}")
        tec_filter = f"AND b.TECNOLOGIA IN ({', '.join(placeholders)})"

    cte = BASE_CTE_TEMPLATE.format(
        ano_filter=ano_filter,
        status_filter=status_filter,
        uf_filter=uf_filter,
        mun_filter=mun_filter,
        vertical_filter=vertical_filter,
        cliente_filter=cliente_filter,
        tec_filter=tec_filter,
    )
    return cte + base_body, params


def _pct(v, t):
    if not t:
        return 0.0
    return round((v / t) * 100, 2)


# ---------------------------------------------------------------------------
# Parser de filtros da request
# ---------------------------------------------------------------------------

def parse_filters():
    return {
        "ufs": request.args.getlist("uf"),
        "municipios": request.args.getlist("municipio"),
        "verticais": request.args.getlist("vertical"),
        "clientes": request.args.getlist("cliente"),
        "tecs": request.args.getlist("tecnologia"),
        "ano": request.args.get("ano"),
        "include_closed": request.args.get("include_closed") in ("1", "true", "True"),
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

def get_years():
    return [int(r["ano"]) for r in execute_query(ANOS_QUERY) if r.get("ano") is not None]


def get_verticais():
    return [r["vertical"] for r in execute_query(VERTICAIS_QUERY) if r.get("vertical")]


def search_clientes(q=""):
    like = f"%{(q or '').strip()}%" if q else "%"
    return [r["cliente"] for r in execute_query(CLIENTES_SEARCH_QUERY, {"q": like})]


def get_kpis(filters):
    sql, params = _build_query(KPIS_TEMPLATE, filters)
    result = execute_query(sql, params)
    row = result[0] if result else {}

    total = row.get("total_ocs", 0) or 0
    ativas = row.get("ativas", 0) or 0
    canceladas = row.get("canceladas", 0) or 0
    clientes = row.get("clientes_distintos", 0) or 0
    mun = row.get("municipios", 0) or 0
    ocs_5g = row.get("ocs_5g", 0) or 0

    return {
        "total_ocs": total,
        "cards": [
            {
                "label": "Total de OCs",
                "value": total,
                "hint": f"{ativas} ativas · {canceladas} canceladas",
                "color": "#7B1FA2",
                "icon": "briefcase",
            },
            {
                "label": "Clientes Distintos",
                "value": clientes,
                "hint": "grandes clientes atendidos",
                "color": "#003399",
                "icon": "people-fill",
            },
            {
                "label": "Municípios Impactados",
                "value": mun,
                "hint": "COD_IBGE distintos",
                "color": "#7DC242",
                "icon": "geo-alt",
            },
            {
                "label": "OCs 5G B2B",
                "value": ocs_5g,
                "hint": f"{_pct(ocs_5g, total)}% do plano",
                "color": TECH_COLORS["5G"],
                "icon": "broadcast-pin",
            },
            {
                "label": "% Executando",
                "value": ativas,
                "hint": f"{_pct(ativas, total)}% das OCs",
                "color": "#28a745",
                "icon": "check-circle",
            },
        ],
    }


def get_top_clientes(filters):
    sql, params = _build_query(TOP_CLIENTES_TEMPLATE, filters)
    result = execute_query(sql, params)
    return [
        {
            "cliente": r["cliente"],
            "vertical": r["vertical"],
            "value": r["qtd"] or 0,
            "municipios": r["municipios"] or 0,
            "color": VERTICAL_COLORS.get(r["vertical"], "#6c757d"),
        }
        for r in result
    ]


def get_by_vertical(filters):
    sql, params = _build_query(BY_VERTICAL_TEMPLATE, filters)
    result = execute_query(sql, params)
    return [
        {
            "label": r["vertical"],
            "value": r["qtd"] or 0,
            "color": VERTICAL_COLORS.get(r["vertical"], "#6c757d"),
        }
        for r in result
    ]


def get_by_tech(filters):
    sql, params = _build_query(BY_TECH_TEMPLATE, filters)
    result = execute_query(sql, params)
    counts = {t: 0 for t in ["2G", "3G", "4G", "5G"]}
    for r in result:
        if r["tecnologia"] in counts:
            counts[r["tecnologia"]] = r["qtd"] or 0
    return [
        {"label": t, "value": counts[t], "color": TECH_COLORS[t]}
        for t in ["2G", "3G", "4G", "5G"]
    ]


def get_by_uf(filters):
    sql, params = _build_query(BY_UF_TEMPLATE, filters)
    result = execute_query(sql, params)
    return [
        {
            "uf": r["uf"],
            "value": r["qtd"] or 0,
            "municipios": r["municipios"] or 0,
            "clientes": r["clientes"] or 0,
        }
        for r in result
    ]


def get_table(filters):
    sql, params = _build_query(TABLE_TEMPLATE, filters)
    return execute_query(sql, params)