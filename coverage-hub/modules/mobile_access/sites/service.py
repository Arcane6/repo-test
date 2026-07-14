"""
Service layer da aba "Sites" — inventário de sites físicos
(TB_FT_BASE_UNICA_SITES), separado do Resumo (que soma Sites + Plano de
rollout). Aqui só entra o que tem END_ID confiável — sem Casa Nova do
Plano 26 (TB_ROLLOUT_ACESSO não tem coluna de site físico único, ver
CLAUDE.md).
"""

import string as _string

from database.oracle import execute_query

from modules.mobile_access.shared.constants import TECH_COLORS, TECH_ORDER
from modules.mobile_access.sites.queries import (
    SITES_BY_MAX_TECH,
    SITES_BY_TECNOLOGIA,
    SITES_PIVOT,
    SITES_VENDORS,
    SITES_GEO_POINTS,
    SITES_TIPO,
)


# Mesma paleta de VENDOR_COLORS de summary/service.py — cada aba mantém
# sua própria cópia (ver nota acima sobre duplicação de helpers).
VENDOR_COLORS = {
    "NOKIA":     "#124191",
    "ERICSSON":  "#0082F0",
    "HUAWEI":    "#E60012",
    "ZTE":       "#3A67C1",
    "A DEFINIR": "#6c757d",
}


# ---------------------------------------------------------------------------
# Helpers (mesmo padrão de actual/service.py e summary/service.py — cada
# aba mantém sua própria cópia pequena em vez de compartilhar um util
# genérico entre módulos)
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


def _build_municipio_ibge_clause(values, prefix, params):
    """Resolve nome(s) de município pro IBGE via MUNICIPIOS_FECHAMENTO antes
    de filtrar — o nome de MUNICIPIO gravado em TB_FT_BASE_UNICA_SITES pode
    não bater caractere-a-caractere com o nome que vem do autocomplete do
    filtro (que busca em MUNICIPIOS_FECHAMENTO), então comparar direto por
    texto aqui deixava o filtro silenciosamente sem casar nada."""
    if not values:
        return ""
    placeholders = []
    for i, v in enumerate(values):
        key = f"{prefix}_{i}"
        params[key] = v
        placeholders.append(f":{key}")
    in_list = ", ".join(placeholders)
    return f"""AND IBGE IN (
        SELECT IBGE FROM NTW_OP.MUNICIPIOS_FECHAMENTO
        WHERE TRUNC(DT_CARGA) = (SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO)
        AND MUNICIPIO IN ({in_list})
    )"""


def _template_fields(sql_template):
    return {
        name
        for _, name, _, _ in _string.Formatter().parse(sql_template)
        if name
    }


def _apply_geo(sql_template, filters, params):
    """Injeta uf_filter_site/municipio_filter_site/regional_filter_site só
    nos placeholders que o template realmente tem — mesma lógica de
    _apply_geo_all (summary/service.py), adaptada pros nomes de campo
    desta aba (BASE.UF/BASE.MUNICIPIO, GEO.REGIONAL). Município usa a
    ponte por IBGE (_build_municipio_ibge_clause) em vez de comparar
    MUNICIPIO por texto direto."""
    fields = _template_fields(sql_template)
    spec = {
        "uf_filter_site": ("UF", _normalize_list(filters.get("ufs")), "uf"),
        "regional_filter_site": ("g.REGIONAL", _normalize_list(filters.get("regionais")), "reg"),
    }
    to_fill = {
        key: _build_in_clause(field, values, prefix, params)
        for key, (field, values, prefix) in spec.items()
        if key in fields
    }
    if "municipio_filter_site" in fields:
        to_fill["municipio_filter_site"] = _build_municipio_ibge_clause(
            _normalize_list(filters.get("municipios")), "mun", params
        )
    return sql_template.format(**to_fill)


def _tech_bars_payload(row, prefix="sites_"):
    return {
        "bars": [
            {"tec": t, "value": row.get(f"{prefix}{t.lower()}", 0) or 0, "color": TECH_COLORS[t]}
            for t in TECH_ORDER
        ],
        "total": row.get("total_sites", 0) or 0,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

def get_sites_by_max_tech(filters):
    """Cada site conta uma única vez, na tecnologia mais nova que tem
    (cascata 5G > 4G > 3G > 2G)."""
    params = {}
    sql = _apply_geo(SITES_BY_MAX_TECH, filters, params)
    row = (execute_query(sql, params) or [{}])[0]
    return _tech_bars_payload(row)


def get_sites_by_tecnologia(filters):
    """Contagem independente por tecnologia — um site multi-tech conta em
    cada uma das barras que tem, não é dedup."""
    params = {}
    sql = _apply_geo(SITES_BY_TECNOLOGIA, filters, params)
    row = (execute_query(sql, params) or [{}])[0]
    return _tech_bars_payload(row)


def get_sites_vendors(filters):
    """Fornecedor dominante por site (cascata NTW_MABE.BASE_TB_END_ID_NEW,
    maior banda primeiro dentro de cada tec) — join feito dentro do
    universo de sites já filtrado desta aba, pra bater com o total das
    outras visões da mesma tela."""
    params = {}
    sql = _apply_geo(SITES_VENDORS, filters, params)
    rows = execute_query(sql, params) or []
    result = []
    for r in rows:
        name = r.get("vendor", "A DEFINIR") or "A DEFINIR"
        value = r.get("qtd", 0) or 0
        result.append({
            "label": name,
            "value": value,
            "color": VENDOR_COLORS.get(name, "#888888"),
        })
    return result


def get_sites_pivot(filters):
    """Base linha-a-linha (Regional, UF, Município) com as duas métricas
    (max-tech e por-tecnologia) — a UI decide como agrupar/expandir."""
    params = {}
    sql = _apply_geo(SITES_PIVOT, filters, params)
    rows = execute_query(sql, params) or []
    return {
        "rows": [
            {
                "regional": r.get("regional"),
                "uf": r.get("uf"),
                "municipio": r.get("municipio"),
                "max_2g": r.get("max_2g", 0) or 0,
                "max_3g": r.get("max_3g", 0) or 0,
                "max_4g": r.get("max_4g", 0) or 0,
                "max_5g": r.get("max_5g", 0) or 0,
                "tec_2g": r.get("tec_2g", 0) or 0,
                "tec_3g": r.get("tec_3g", 0) or 0,
                "tec_4g": r.get("tec_4g", 0) or 0,
                "tec_5g": r.get("tec_5g", 0) or 0,
                "total_sites": r.get("total_sites", 0) or 0,
            }
            for r in rows
        ],
    }


def get_sites_geo_points(filters):
    """Um ponto por site (END_ID, lat/long, tecnologia máxima) — alimenta
    os mapas (Brasil e múndi). Ainda sem consumidor no frontend: falta
    decidir o asset de GeoJSON (contorno Brasil/mundo) antes de desenhar
    o mapa de verdade."""
    params = {}
    sql = _apply_geo(SITES_GEO_POINTS, filters, params)
    rows = execute_query(sql, params) or []
    return {
        "points": [
            {
                "end_id": r.get("end_id"),
                "uf": r.get("uf"),
                "municipio": r.get("municipio"),
                "lat": r.get("latitude"),
                "lon": r.get("longitude"),
                "tech": r.get("max_tech"),
                "color": TECH_COLORS.get(r.get("max_tech"), "#6c757d"),
            }
            for r in rows
        ],
    }


def get_sites_tipo(filters):
    """Cruza MOBILE_SITE x TX_PROFILE (FLAG_TX_PROFILE_ENG) — universo
    diferente das outras views desta aba: inclui site não-móvel também,
    só exige STATUS_END_ID='ATIVADO' e exclui roaming."""
    params = {}
    sql = _apply_geo(SITES_TIPO, filters, params)
    row = (execute_query(sql, params) or [{}])[0]
    return {
        "mobile_tx": row.get("mobile_tx", 0) or 0,
        "mobile_no_tx": row.get("mobile_no_tx", 0) or 0,
        "nonmobile_tx": row.get("nonmobile_tx", 0) or 0,
        "nonmobile_no_tx": row.get("nonmobile_no_tx", 0) or 0,
        "total_sites": row.get("total_sites", 0) or 0,
    }
