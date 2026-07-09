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
        regional        (multi)  ex.: ?regional=TSP  (cross-filter do Resumo)
        projeto         (multi)  ex.: ?projeto=X    (PRIORIDADE do rollout)
        venn            (single) ex.: ?venn=only_2g (região exata do diagrama de Venn)
        ano             (single) ex.: ?ano=2026
    """
    return {
        "ufs": request.args.getlist("uf"),
        "municipios": request.args.getlist("municipio"),
        "tecs": request.args.getlist("tecnologia"),
        "regionais": request.args.getlist("regional"),
        "projetos": request.args.getlist("projeto"),
        "venn_region": request.args.get("venn"),
        "ano": request.args.get("ano"),
    }