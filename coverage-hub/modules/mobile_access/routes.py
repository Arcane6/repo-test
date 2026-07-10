"""
Blueprint do módulo Mobile Access — API JSON pura.
O front-end (React) mora em /frontend e consome essas rotas; a UI é
inteiramente renderizada no cliente, o Flask só serve dados.
"""

from flask import Blueprint
from flask import jsonify
from flask import request

from modules.mobile_access.shared.filters import parse_filters
from modules.mobile_access.shared.refs import get_refs
from modules.mobile_access.actual import service as actual
from modules.mobile_access.summary import service as summary
from modules.mobile_access.sites import service as sites


mobile_access_bp = Blueprint(
    "mobile_access",
    __name__,
    url_prefix="/mobile-access",
)


# ---------------------------------------------------------------------------
# API — referências das tabelas-fonte (badge "de onde vem esse número")
# ---------------------------------------------------------------------------

@mobile_access_bp.route("/api/refs")
def api_refs():
    return jsonify(get_refs())


# ---------------------------------------------------------------------------
# API — Cidades (rede hoje)
# ---------------------------------------------------------------------------

def _net_filters():
    f = parse_filters()
    return {
        "ufs": f["ufs"],
        "municipios": f["municipios"],
        "tecs": f["tecs"],
        "venn_region": f["venn_region"],
    }


@mobile_access_bp.route("/api/actual/kpis")
def api_actual_kpis():
    return jsonify(actual.get_kpis(**_net_filters()))


@mobile_access_bp.route("/api/actual/gauges")
def api_actual_gauges():
    return jsonify(actual.get_gauges(**_net_filters()))


@mobile_access_bp.route("/api/actual/venn")
def api_actual_venn():
    return jsonify(actual.get_venn(**_net_filters()))


@mobile_access_bp.route("/api/actual/table")
def api_actual_table():
    return jsonify(actual.get_table(**_net_filters()))


@mobile_access_bp.route("/api/actual/table/export")
def api_actual_table_export():
    """Base completa (última carga), sem filtro — o export sempre entrega
    a versão mais recente inteira, não o recorte filtrado na tela."""
    return jsonify(actual.get_full_base())


@mobile_access_bp.route("/api/actual/timeseries")
def api_actual_timeseries():
    return jsonify(actual.get_timeseries(**_net_filters()))


@mobile_access_bp.route("/api/actual/frequencies")
def api_actual_frequencies():
    return jsonify(actual.get_frequencies(**_net_filters()))


@mobile_access_bp.route("/api/actual/ufs")
def api_actual_ufs():
    return jsonify(actual.get_ufs())


@mobile_access_bp.route("/api/actual/municipios/search")
def api_actual_municipios_search():
    q = request.args.get("q", "")
    ufs = request.args.getlist("uf")
    return jsonify(actual.search_municipios(q=q, uf=ufs))


# ---------------------------------------------------------------------------
# API — Resumo
# ---------------------------------------------------------------------------

@mobile_access_bp.route("/api/summary/years")
def api_summary_years():
    return jsonify(summary.get_years())


# Raia 1 — Fechamento 25
@mobile_access_bp.route("/api/summary/r1/sites-venn")
def api_summary_r1_sites_venn():
    return jsonify(summary.get_r1_sites_venn(parse_filters()))

@mobile_access_bp.route("/api/summary/r1/cities-by-tech")
def api_summary_r1_cities():
    return jsonify(summary.get_r1_cities_by_tech(parse_filters()))

@mobile_access_bp.route("/api/summary/r1/vendors")
def api_summary_r1_vendors():
    return jsonify(summary.get_r1_vendors(parse_filters()))


# Raia 2 — Plano 26
@mobile_access_bp.route("/api/summary/r2/new-cities-by-anf")
def api_summary_r2_cities_anf():
    return jsonify(summary.get_r2_new_cities_by_anf(parse_filters()))

@mobile_access_bp.route("/api/summary/r2/vendors-new-sites")
def api_summary_r2_vendors():
    return jsonify(summary.get_r2_vendors_new_sites(parse_filters()))

@mobile_access_bp.route("/api/summary/r2/top-projects")
def api_summary_r2_projects():
    return jsonify(summary.get_r2_top_projects(parse_filters()))

@mobile_access_bp.route("/api/summary/r2/orcamento-por-tecnologia")
def api_summary_r2_orcamento():
    return jsonify(summary.get_r2_orcamento_por_tecnologia(parse_filters()))

@mobile_access_bp.route("/api/summary/r2/endereco-por-tecnologia")
def api_summary_r2_endereco():
    return jsonify(summary.get_r2_endereco_por_tecnologia(parse_filters()))

# Raia 3 — Fechamento 26
@mobile_access_bp.route("/api/summary/r3/new-cities-by-anf")
def api_summary_r3_cities_anf():
    return jsonify(summary.get_r3_new_cities_by_anf(parse_filters()))

@mobile_access_bp.route("/api/summary/r3/vendors")
def api_summary_r3_vendors():
    return jsonify(summary.get_r3_vendors(parse_filters()))

@mobile_access_bp.route("/api/summary/r3/top-projects")
def api_summary_r3_projects():
    return jsonify(summary.get_r3_top_projects(parse_filters()))


# ---------------------------------------------------------------------------
# API — Sites (inventário de sites físicos, TB_FT_BASE_UNICA_SITES)
# ---------------------------------------------------------------------------

def _sites_filters():
    f = parse_filters()
    return {
        "ufs": f["ufs"],
        "municipios": f["municipios"],
        "regionais": f["regionais"],
    }


@mobile_access_bp.route("/api/sites/by-max-tech")
def api_sites_by_max_tech():
    return jsonify(sites.get_sites_by_max_tech(_sites_filters()))


@mobile_access_bp.route("/api/sites/by-tecnologia")
def api_sites_by_tecnologia():
    return jsonify(sites.get_sites_by_tecnologia(_sites_filters()))


@mobile_access_bp.route("/api/sites/vendors")
def api_sites_vendors():
    return jsonify(sites.get_sites_vendors(_sites_filters()))


@mobile_access_bp.route("/api/sites/pivot")
def api_sites_pivot():
    return jsonify(sites.get_sites_pivot(_sites_filters()))


@mobile_access_bp.route("/api/sites/geo-points")
def api_sites_geo_points():
    return jsonify(sites.get_sites_geo_points(_sites_filters()))


@mobile_access_bp.route("/api/sites/tipo")
def api_sites_tipo():
    return jsonify(sites.get_sites_tipo(_sites_filters()))
