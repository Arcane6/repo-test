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
