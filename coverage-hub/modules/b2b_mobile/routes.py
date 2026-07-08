"""
Blueprint do módulo B2B Mobile.
"""

from flask import Blueprint
from flask import jsonify
from flask import render_template

from modules.b2b_mobile import service as b2b


b2b_mobile_bp = Blueprint(
    "b2b_mobile",
    __name__,
    url_prefix="/b2b-mobile",
)


@b2b_mobile_bp.route("/")
def dashboard():
    return render_template("b2b_mobile/dashboard.html")


@b2b_mobile_bp.route("/api/years")
def api_years():
    return jsonify(b2b.get_years())


@b2b_mobile_bp.route("/api/verticais")
def api_verticais():
    return jsonify(b2b.get_verticais())


@b2b_mobile_bp.route("/api/clientes/search")
def api_clientes_search():
    from flask import request
    q = request.args.get("q", "")
    return jsonify(b2b.search_clientes(q=q))


@b2b_mobile_bp.route("/api/kpis")
def api_kpis():
    return jsonify(b2b.get_kpis(b2b.parse_filters()))


@b2b_mobile_bp.route("/api/top-clientes")
def api_top_clientes():
    return jsonify(b2b.get_top_clientes(b2b.parse_filters()))


@b2b_mobile_bp.route("/api/by-vertical")
def api_by_vertical():
    return jsonify(b2b.get_by_vertical(b2b.parse_filters()))


@b2b_mobile_bp.route("/api/by-tech")
def api_by_tech():
    return jsonify(b2b.get_by_tech(b2b.parse_filters()))


@b2b_mobile_bp.route("/api/by-uf")
def api_by_uf():
    return jsonify(b2b.get_by_uf(b2b.parse_filters()))


@b2b_mobile_bp.route("/api/table")
def api_table():
    return jsonify(b2b.get_table(b2b.parse_filters()))