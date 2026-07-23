"""
Blueprint do módulo Controle Físico-Financeiro — API JSON pura, prefixo
/controle-fisico-financeiro. Camadas suportadas: acesso, transporte.
"""

from flask import Blueprint, jsonify, request

from modules.controle_fisico_financeiro import service


controle_fisico_financeiro_bp = Blueprint(
    "controle_fisico_financeiro",
    __name__,
    url_prefix="/controle-fisico-financeiro",
)


def _filters():
    return {
        "ufs": request.args.getlist("uf"),
        "municipios": request.args.getlist("municipio"),
        "regionais": request.args.getlist("regional"),
        "projetos": request.args.getlist("projeto"),
        "status": request.args.getlist("status"),
        "ano_plano": request.args.get("ano_plano"),
    }


def _camada_ou_404(camada):
    if not service.is_camada_valida(camada):
        return jsonify({"error": "camada inválida", "camada": camada}), 404
    return None


@controle_fisico_financeiro_bp.route("/api/camadas")
def api_camadas():
    """Metadados das camadas disponíveis (labels, dimensões, enums) — usado
    pelo front pra montar filtros/colunas da grid sem hardcode."""
    return jsonify(service.get_camadas())


@controle_fisico_financeiro_bp.route("/api/<camada>/atual")
def api_estado_atual(camada):
    """Estado atual (1 linha por item) — fonte de dados principal da grid."""
    erro = _camada_ou_404(camada)
    if erro:
        return erro
    return jsonify(service.get_estado_atual(camada, _filters()))


@controle_fisico_financeiro_bp.route("/api/<camada>/historico/<item_id>")
def api_historico(camada, item_id):
    """Histórico completo de eventos de um item — auditoria/trilha."""
    erro = _camada_ou_404(camada)
    if erro:
        return erro
    return jsonify(service.get_historico(camada, item_id))


@controle_fisico_financeiro_bp.route("/api/<camada>/opcoes")
def api_opcoes(camada):
    """Valores distintos por coluna, pra popular os filtros complexos da
    grid (multi-select por projeto/regional/uf/dimensões)."""
    erro = _camada_ou_404(camada)
    if erro:
        return erro
    return jsonify(service.get_opcoes(camada))


@controle_fisico_financeiro_bp.route("/api/<camada>/eventos", methods=["POST"])
def api_criar_eventos(camada):
    """Grava um lote de lançamentos (colar/editar em massa na grid). Cada
    linha do body vira um INSERT novo — nunca UPDATE."""
    erro = _camada_ou_404(camada)
    if erro:
        return erro

    body = request.get_json(silent=True) or {}
    eventos = body.get("eventos")
    usuario = body.get("usuario")

    if not isinstance(eventos, list) or not eventos:
        return jsonify({"error": "body precisa de 'eventos': lista não vazia"}), 400
    if not usuario:
        return jsonify({"error": "campo 'usuario' é obrigatório"}), 400

    try:
        resultado = service.create_eventos(camada, usuario, eventos)
    except service.ValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(resultado), 201
