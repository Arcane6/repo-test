"""
Blueprint do módulo Transporte — API JSON pura, prefixo /transport.
"""

from flask import Blueprint, jsonify

from modules.mobile_access.shared.filters import parse_filters
from modules.transport import service


transport_bp = Blueprint(
    "transport",
    __name__,
    url_prefix="/transport",
)


def _geo_filters():
    f = parse_filters()
    return {
        "ufs": f["ufs"],
        "municipios": f["municipios"],
        "regionais": f["regionais"],
    }


@transport_bp.route("/api/resumo-executivo")
def api_resumo_executivo():
    """3 raias: Fechamento 2025 · Plano 26 · Fechamento 26."""
    return jsonify(service.get_resumo_executivo(_geo_filters()))


@transport_bp.route("/api/composicao")
def api_composicao():
    """Composição & migração 25×26 (aba 2)."""
    return jsonify(service.get_composicao(_geo_filters()))


@transport_bp.route("/api/infraestrutura")
def api_infraestrutura():
    """Perfil de infra/fornecimento — solução, provedor, status,
    classificação, rollout (aba 3)."""
    return jsonify(service.get_infraestrutura(_geo_filters()))


@transport_bp.route("/api/geo-points")
def api_geo_points():
    """Pontos dos sites de transporte pro mapa (colorido por mídia)."""
    return jsonify(service.get_geo_points(_geo_filters()))


@transport_bp.route("/api/reconciliacao")
def api_reconciliacao():
    """Comparação REL_TX_PROFILE × Base Única de Sites por END_ID (aba 4)."""
    return jsonify(service.get_reconciliacao(_geo_filters()))


@transport_bp.route("/api/reconciliacao/divergencias")
def api_reconciliacao_divergencias():
    """Worklist de correção: sites com mídia divergente entre as bases."""
    return jsonify(service.get_reconciliacao_divergencias(_geo_filters()))
