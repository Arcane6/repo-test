"""
Blueprint do módulo Core (volumetria de tráfego da RAN) — API JSON pura,
mesmo padrão do mobile_access.
"""

from flask import Blueprint, jsonify

from modules.mobile_access.shared.filters import parse_filters
from modules.network_core import service


network_core_bp = Blueprint(
    "network_core",
    __name__,
    url_prefix="/core",
)


def _geo_filters():
    f = parse_filters()
    return {
        "ufs": f["ufs"],
        "municipios": f["municipios"],
        "regionais": f["regionais"],
    }


@network_core_bp.route("/api/overview")
def api_overview():
    """TUDO do dashboard numa chamada só — evita disparar 8 execuções das
    queries pesadas em paralelo (ver get_overview). É o único endpoint que
    o frontend usa; os granulares abaixo ficam pra debug/REST direto."""
    return jsonify(service.get_overview(_geo_filters()))


@network_core_bp.route("/api/kpis")
def api_kpis():
    return jsonify(service.get_kpis(_geo_filters()))


@network_core_bp.route("/api/historico-mensal")
def api_historico_mensal():
    return jsonify(service.get_historico_mensal(_geo_filters()))


@network_core_bp.route("/api/destaques-variacao")
def api_destaques_variacao():
    return jsonify(service.get_destaques_variacao(_geo_filters()))


@network_core_bp.route("/api/ranking/municipios")
def api_ranking_municipios():
    return jsonify(service.get_ranking_municipios(_geo_filters()))


@network_core_bp.route("/api/ranking/ufs")
def api_ranking_ufs():
    return jsonify(service.get_ranking_ufs(_geo_filters()))


@network_core_bp.route("/api/ranking/regionais")
def api_ranking_regionais():
    return jsonify(service.get_ranking_regionais(_geo_filters()))


@network_core_bp.route("/api/tabela-municipios")
def api_tabela_municipios():
    return jsonify(service.get_tabela_municipios(_geo_filters()))
