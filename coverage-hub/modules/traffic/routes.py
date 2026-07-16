"""
Blueprint do módulo Tráfego (planejado × realizado) — API JSON pura,
mesmo padrão do resto do portal. Prefixo /trafego.
"""

from flask import Blueprint, jsonify

from modules.mobile_access.shared.filters import parse_filters
from modules.traffic import service


traffic_bp = Blueprint(
    "traffic",
    __name__,
    url_prefix="/trafego",
)


def _geo_filters():
    f = parse_filters()
    return {
        "ufs": f["ufs"],
        "municipios": f["municipios"],
    }


@traffic_bp.route("/api/resumo-executivo")
def api_resumo_executivo():
    """3 raias numa chamada só: Fechamento 2025 · Plano 26 · Fechamento 26."""
    return jsonify(service.get_resumo_executivo(_geo_filters()))


@traffic_bp.route("/api/ytd")
def api_ytd():
    """Tráfego YTD: planejado × realizado acumulado + aderência ao plano."""
    return jsonify(service.get_ytd(_geo_filters()))
