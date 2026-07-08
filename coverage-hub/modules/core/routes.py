"""
Endpoints de core do portal — hoje só a lista de módulos, consumida pela
Home (React) pra montar o menu e os cards (incluindo os desabilitados,
mostrados como "Em breve").
"""

from flask import Blueprint, jsonify

from config.modules import MODULES

core_bp = Blueprint(
    "core",
    __name__,
    url_prefix="/api",
)


@core_bp.route("/modules")
def api_modules():
    return jsonify(MODULES)
