"""
Service layer da aba "Plano".
Todas as funções públicas seguem o contrato:
    (ufs, municipios, tecs, ano, include_closed, include_ops) -> dict|list
"""

from database.oracle import execute_query

from modules.mobile_access.shared.constants import (
    TECH_COLORS,
    TECH_ORDER,
    OPERATIONAL_PRIORITIES,
    DEFAULT_PLAN_YEAR,
)
from modules.mobile_access.plan.queries import (
    BASE_CTE_TEMPLATE,
    KPIS_TEMPLATE,
    COMPOSITION_TEMPLATE,
    BY_TECH_TEMPLATE,
    SUNBURST_TEMPLATE,
    TOP_MUNICIPIOS_TEMPLATE,
    TABLE_TEMPLATE,
    YEARS_QUERY,
    BY_UF_TEMPLATE
)


# ---------------------------------------------------------------------------
# Helpers de normalização e SQL dinâmico
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


def _build_status_clause(include_closed):
    if include_closed:
        return "AND r.STATUS_OC IN ('ACTIVATED', 'CLOSED')"
    return "AND r.STATUS_OC = 'ACTIVATED'"


def _build_ops_clause(include_ops, params):
    if include_ops:
        return ""
    placeholders = []
    for i, v in enumerate(OPERATIONAL_PRIORITIES):
        key = f"op_{i}"
        params[key] = v
        placeholders.append(f":{key}")
    return f"AND (r.PRIORIDADE IS NULL OR r.PRIORIDADE NOT IN ({', '.join(placeholders)}))"


def _build_tec_clause(tecs, params):
    if not tecs:
        return ""
    placeholders = []
    for i, v in enumerate(tecs):
        key = f"tec_{i}"
        # Normalizamos para o formato do BASE (UPPER, sem aspas)
        params[key] = v.upper().replace('"', "").replace("'", "")
        placeholders.append(f":{key}")
    return f"AND TECNOLOGIA IN ({', '.join(placeholders)})"


def _build_query(base_template, filters):
    """
    filters = {
        ufs: [...], municipios: [...], tecs: [...],
        ano: int, include_closed: bool, include_ops: bool
    }
    """
    params = {}

    # Ano (obrigatório)
    ano = filters.get("ano") or DEFAULT_PLAN_YEAR
    try:
        params["ano"] = int(ano)
    except (TypeError, ValueError):
        params["ano"] = DEFAULT_PLAN_YEAR
    ano_filter = "AND r.PLANO = :ano"

    # Status
    status_filter = _build_status_clause(filters.get("include_closed", False))

    # Operações
    ops_filter = _build_ops_clause(filters.get("include_ops", False), params)

    # UF (opera sobre a coluna UF vinda do dicionário)
    uf_filter = _build_in_clause("d.UF", _normalize_list(filters.get("ufs")), "uf", params)

    # Município
    mun_filter = _build_in_clause("d.MUNICIPIO", _normalize_list(filters.get("municipios")), "mun", params)

    # Tecnologia (opera sobre a coluna já normalizada na CTE, mas o filtro
    # é aplicado no WHERE da BASE, antes da normalização; então comparamos
    # com o valor bruto uppercase — funciona com ou sem aspas).
    tec_values = _normalize_list(filters.get("tecs"))
    tec_placeholders = []
    for i, v in enumerate(tec_values):
        key = f"tec_{i}"
        params[key] = v.upper()
        tec_placeholders.append(f":{key}")
    tec_filter = ""
    if tec_placeholders:
        tec_filter = (
            "AND UPPER(REPLACE(REPLACE(r.TECNOLOGIA, '\"', ''), '''', '')) "
            f"IN ({', '.join(tec_placeholders)})"
        )

    cte = BASE_CTE_TEMPLATE.format(
        ano_filter=ano_filter,
        status_filter=status_filter,
        ops_filter=ops_filter,
        uf_filter=uf_filter,
        municipio_filter=mun_filter,
        tec_filter=tec_filter,
    )

    return cte + base_template, params


def _pct(value, total):
    if not total:
        return 0.0
    return round((value / total) * 100, 2)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

def get_years():
    """Lista de anos distintos disponíveis no TB_ROLLOUT_ACESSO."""
    result = execute_query(YEARS_QUERY)
    return [int(r["ano"]) for r in result if r.get("ano") is not None]


def get_kpis(filters):
    sql, params = _build_query(KPIS_TEMPLATE, filters)
    result = execute_query(sql, params)
    row = result[0] if result else {}

    total = row.get("total_ocs", 0) or 0
    mun = row.get("municipios_impactados", 0) or 0
    ns = row.get("novos_sites", 0) or 0
    ce = row.get("casas_existentes", 0) or 0
    ocs_5g = row.get("ocs_5g_obrigacao", 0) or 0
    canceladas = row.get("canceladas", 0) or 0

    return {
        "total_ocs": total,
        "canceladas": canceladas,
        "cards": [
            {
                "label": "Total de OCs",
                "value": total,
                "hint": f"{canceladas} canceladas" if canceladas else "",
                "color": "#003399",
                "icon": "list-check",
            },
            {
                "label": "Municípios Impactados",
                "value": mun,
                "hint": "COD_IBGE distintos",
                "color": "#7DC242",
                "icon": "geo-alt",
            },
            {
                "label": "Novos Sites",
                "value": ns,
                "hint": f"{_pct(ns, total)}% do plano",
                "color": "#1E88E5",
                "icon": "building-add",
            },
            {
                "label": "Casas Existentes",
                "value": ce,
                "hint": f"{_pct(ce, total)}% do plano",
                "color": "#F5C518",
                "icon": "house-gear",
            },
            {
                "label": "5G Obrigação Anatel",
                "value": ocs_5g,
                "hint": f"{_pct(ocs_5g, total)}% do plano",
                "color": "#E53935",
                "icon": "shield-check",
            },
        ],
    }


def get_composition(filters):
    """Bar horizontal por PRIORIDADE."""
    sql, params = _build_query(COMPOSITION_TEMPLATE, filters)
    result = execute_query(sql, params)
    return [
        {
            "categoria": r["prioridade"],
            "value": r["qtd"] or 0,
        }
        for r in result
    ]


def get_by_tech(filters):
    """Donut 2G / 3G / 4G / 5G."""
    sql, params = _build_query(BY_TECH_TEMPLATE, filters)
    result = execute_query(sql, params)

    # Garante que todas as 4 tecs apareçam mesmo com valor 0
    counts = {t: 0 for t in TECH_ORDER}
    for r in result:
        tec = r["tecnologia"]
        if tec in counts:
            counts[tec] = r["qtd"] or 0

    return [
        {
            "label": tec,
            "value": counts[tec],
            "color": TECH_COLORS[tec],
        }
        for tec in TECH_ORDER
    ]


def get_sunburst(filters):
    """
    Sunburst 2 níveis: CLASSIFICACAO_CASA -> TECNOLOGIA.
    Formato pronto para ECharts sunburst.
    """
    sql, params = _build_query(SUNBURST_TEMPLATE, filters)
    result = execute_query(sql, params)

    # Agrupa por categoria
    grouped = {}
    for r in result:
        cat = r["categoria"] or "NÃO CLASSIFICADO"
        tec = r["tecnologia"]
        if tec not in TECH_ORDER:
            continue
        grouped.setdefault(cat, {t: 0 for t in TECH_ORDER})
        grouped[cat][tec] = r["qtd"] or 0

    data = []
    for cat, techs in sorted(grouped.items(), key=lambda x: -sum(x[1].values())):
        children = []
        for tec in TECH_ORDER:
            if techs[tec] > 0:
                children.append({
                    "name": tec,
                    "value": techs[tec],
                    "itemStyle": {"color": TECH_COLORS[tec]},
                })
        data.append({
            "name": cat,
            "children": children,
        })

    return data


def get_top_municipios(filters):
    """Top 20 municípios por número de OCs."""
    sql, params = _build_query(TOP_MUNICIPIOS_TEMPLATE, filters)
    result = execute_query(sql, params)
    return [
        {
            "cod_ibge": r["cod_ibge"],
            "municipio": r["municipio"] or f"IBGE {r['cod_ibge']}",
            "uf": r["uf"] or "-",
            "value": r["qtd"] or 0,
        }
        for r in result
    ]


def get_table(filters):
    """Tabela detalhada (até 2000 linhas)."""
    sql, params = _build_query(TABLE_TEMPLATE, filters)
    return execute_query(sql, params)

def get_by_uf(filters):
    """Distribuição por UF (para o mapa)."""
    sql, params = _build_query(BY_UF_TEMPLATE, filters)
    result = execute_query(sql, params)
    return [
        {
            "uf": r["uf"],
            "value": r["qtd"] or 0,
            "municipios": r.get("municipios", 0) or 0,
        }
        for r in result
    ]