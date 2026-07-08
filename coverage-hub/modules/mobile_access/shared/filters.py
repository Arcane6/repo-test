"""
Parser único de filtros para todas as abas.
Cada aba consome apenas os filtros que faz sentido para ela.
"""

from flask import request


def parse_filters():
    """
    Lê query params da request e devolve um dict normalizado com todos os
    filtros possíveis. Abas que não usam determinado filtro simplesmente
    ignoram a chave.

    Query params suportados:
        uf              (multi)  ex.: ?uf=RJ&uf=SP
        municipio       (multi)  ex.: ?municipio=Niteroi
        tecnologia      (multi)  ex.: ?tecnologia=5G
        ano             (single) ex.: ?ano=2026
        include_closed  (bool)   ex.: ?include_closed=1
        include_ops     (bool)   ex.: ?include_ops=1
    """
    return {
        "ufs": request.args.getlist("uf"),
        "municipios": request.args.getlist("municipio"),
        "tecs": request.args.getlist("tecnologia"),
        "ano": request.args.get("ano"),
        "include_closed": request.args.get("include_closed") in ("1", "true", "True"),
        "include_ops": request.args.get("include_ops") in ("1", "true", "True"),
    }