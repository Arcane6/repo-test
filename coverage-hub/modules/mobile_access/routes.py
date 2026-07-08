"""
Blueprint principal do módulo Mobile Access.
Orquestra as 3 abas: rede, plano e consolidado.
"""

from flask import Blueprint
from flask import jsonify
from flask import redirect
from flask import render_template
from flask import request

from modules.mobile_access.shared.filters import parse_filters
from modules.mobile_access.actual import service as actual
from modules.mobile_access.plan import service as plan
from modules.mobile_access.consolidated import service as consolidated
from modules.mobile_access.summary import service as summary


mobile_access_bp = Blueprint(
    "mobile_access",
    __name__,
    url_prefix="/mobile-access",
)


# ---------------------------------------------------------------------------
# Páginas (HTML)
# ---------------------------------------------------------------------------

@mobile_access_bp.route("/")
def index():
    return redirect("/mobile-access/consolidated/")


@mobile_access_bp.route("/actual/")
def page_actual():
    return render_template("mobile_access/dashboard.html", active_tab="actual")


@mobile_access_bp.route("/plan/")
def page_plan():
    return render_template("mobile_access/dashboard.html", active_tab="plan")


@mobile_access_bp.route("/consolidated/")
def page_consolidated():
    return render_template("mobile_access/dashboard.html", active_tab="consolidated")


# ---------------------------------------------------------------------------
# API — Rede Hoje
# ---------------------------------------------------------------------------

def _net_filters():
    f = parse_filters()
    return {"ufs": f["ufs"], "municipios": f["municipios"], "tecs": f["tecs"]}


@mobile_access_bp.route("/api/actual/kpis")
def api_actual_kpis():
    return jsonify(actual.get_kpis(**_net_filters()))


@mobile_access_bp.route("/api/actual/venn")
def api_actual_venn():
    return jsonify(actual.get_venn(**_net_filters()))


@mobile_access_bp.route("/api/actual/table")
def api_actual_table():
    return jsonify(actual.get_table(**_net_filters()))


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
# API — Plano
# ---------------------------------------------------------------------------

@mobile_access_bp.route("/api/plan/years")
def api_plan_years():
    return jsonify(plan.get_years())


@mobile_access_bp.route("/api/plan/kpis")
def api_plan_kpis():
    return jsonify(plan.get_kpis(parse_filters()))


@mobile_access_bp.route("/api/plan/composition")
def api_plan_composition():
    return jsonify(plan.get_composition(parse_filters()))


@mobile_access_bp.route("/api/plan/by-tech")
def api_plan_by_tech():
    return jsonify(plan.get_by_tech(parse_filters()))


@mobile_access_bp.route("/api/plan/sunburst")
def api_plan_sunburst():
    return jsonify(plan.get_sunburst(parse_filters()))


@mobile_access_bp.route("/api/plan/top-municipios")
def api_plan_top_municipios():
    return jsonify(plan.get_top_municipios(parse_filters()))


@mobile_access_bp.route("/api/plan/table")
def api_plan_table():
    return jsonify(plan.get_table(parse_filters()))


@mobile_access_bp.route("/api/plan/by-uf")
def api_plan_by_uf():
    return jsonify(plan.get_by_uf(parse_filters()))

# ---------------------------------------------------------------------------
# API — Consolidado
# ---------------------------------------------------------------------------

@mobile_access_bp.route("/api/consolidated/summary")
def api_consolidated_summary():
    return jsonify(consolidated.get_summary(parse_filters()))


@mobile_access_bp.route("/api/consolidated/gap")
def api_consolidated_gap():
    return jsonify(consolidated.get_gap(parse_filters()))


@mobile_access_bp.route("/api/consolidated/delta-by-uf")
def api_consolidated_delta_by_uf():
    return jsonify(consolidated.get_delta_by_uf(parse_filters()))


@mobile_access_bp.route("/api/consolidated/timeline")
def api_consolidated_timeline():
    return jsonify(consolidated.get_projected_timeline(parse_filters()))


@mobile_access_bp.route("/api/consolidated/gauges")
def api_consolidated_gauges():
    return jsonify(consolidated.get_gauges(parse_filters()))

# ---------------------------------------------------------------------------
# Página do Summary
# ---------------------------------------------------------------------------

@mobile_access_bp.route("/summary/")
def page_summary():
    return render_template("mobile_access/dashboard.html", active_tab="summary")


# ---------------------------------------------------------------------------
# API — Summary
# ---------------------------------------------------------------------------

# Raia 1 — Fechamento 25
@mobile_access_bp.route("/api/summary/r1/sites-by-tech")
def api_summary_r1_sites():
    return jsonify(summary.get_r1_sites_by_tech(parse_filters()))

@mobile_access_bp.route("/api/summary/r1/cities-by-tech")
def api_summary_r1_cities():
    return jsonify(summary.get_r1_cities_by_tech(parse_filters()))

@mobile_access_bp.route("/api/summary/r1/vendors")
def api_summary_r1_vendors():
    return jsonify(summary.get_r1_vendors(parse_filters()))


# Raia 2 — Plano 26
@mobile_access_bp.route("/api/summary/r2/sites-by-tech")
def api_summary_r2_sites():
    return jsonify(summary.get_r2_sites_by_tech(parse_filters()))

@mobile_access_bp.route("/api/summary/r2/new-cities-by-anf")
def api_summary_r2_cities_anf():
    return jsonify(summary.get_r2_new_cities_by_anf(parse_filters()))

@mobile_access_bp.route("/api/summary/r2/vendors-new-sites")
def api_summary_r2_vendors():
    return jsonify(summary.get_r2_vendors_new_sites(parse_filters()))

@mobile_access_bp.route("/api/summary/r2/top-projects")
def api_summary_r2_projects():
    return jsonify(summary.get_r2_top_projects(parse_filters()))


# Raia 3 — Fechamento 26
@mobile_access_bp.route("/api/summary/r3/sites-by-tech")
def api_summary_r3_sites():
    return jsonify(summary.get_r3_sites_by_tech(parse_filters()))

@mobile_access_bp.route("/api/summary/r3/cities-by-tech")
def api_summary_r3_cities():
    return jsonify(summary.get_r3_cities_by_tech(parse_filters()))

@mobile_access_bp.route("/api/summary/r3/new-cities-by-anf")
def api_summary_r3_cities_anf():
    return jsonify(summary.get_r3_new_cities_by_anf(parse_filters()))

@mobile_access_bp.route("/api/summary/r3/vendors")
def api_summary_r3_vendors():
    return jsonify(summary.get_r3_vendors(parse_filters()))

@mobile_access_bp.route("/api/summary/r3/top-projects")
def api_summary_r3_projects():
    return jsonify(summary.get_r3_top_projects(parse_filters()))