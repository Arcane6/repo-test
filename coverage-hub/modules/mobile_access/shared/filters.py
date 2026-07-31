"""
Parser único de filtros para todas as abas.
Cada aba consome apenas os filtros que faz sentido para ela.
"""

from flask import request

from modules.mobile_access.shared.constants import POP_URBANA_BUCKETS


def parse_filters():
    """
    Lê query params da request e devolve um dict normalizado com todos os
    filtros possíveis. Abas que não usam determinado filtro simplesmente
    ignoram a chave.

    Query params suportados:
        uf              (multi)  ex.: ?uf=RJ&uf=SP
        municipio       (multi)  ex.: ?municipio=Niteroi
        tecnologia      (multi)  ex.: ?tecnologia=5G
        regional        (multi)  ex.: ?regional=TSP  (filtro global — também cross-filter do Resumo)
        anf             (multi)  ex.: ?anf=11        (Área de Numeração Fechada/DDD)
        pop_urbana      (multi)  ex.: ?pop_urbana=ate_20k (chave de POP_URBANA_BUCKETS)
        projeto         (multi)  ex.: ?projeto=X    (PRIORIDADE do rollout)
        venn            (single) ex.: ?venn=only_2g (região exata do Venn de Presença — Cidades)
        sitevenn        (single) ex.: ?sitevenn=i_2345 (região exata do Venn de Sites — Resumo R1)
        ano             (single) ex.: ?ano=2026
    """
    return {
        "ufs": request.args.getlist("uf"),
        "municipios": request.args.getlist("municipio"),
        "tecs": request.args.getlist("tecnologia"),
        "regionais": request.args.getlist("regional"),
        "anfs": request.args.getlist("anf"),
        "pop_urbana": request.args.getlist("pop_urbana"),
        "projetos": request.args.getlist("projeto"),
        "venn_region": request.args.get("venn"),
        "site_venn_region": request.args.get("sitevenn"),
        "ano": request.args.get("ano"),
    }


def build_pop_urbana_clause(field, bucket_keys, params, prefix="pop"):
    """
    Cláusula OR de faixas de população urbana — cada bucket vira um par de
    binds (mínimo/máximo), só os buckets pedidos entram na cláusula (nunca
    o valor bruto do usuário: bucket_keys é validado contra o whitelist
    POP_URBANA_BUCKETS, mesmo princípio de VENN_REGION_CLAUSES). `field` é
    a coluna/expressão POPULACAO_URBANA já qualificada pelo chamador
    (ex.: "g.POPULACAO_URBANA").
    """
    valid = [b for b in (bucket_keys or []) if b in POP_URBANA_BUCKETS]
    if not valid:
        return ""
    parts = []
    for i, key in enumerate(valid):
        lo, hi = POP_URBANA_BUCKETS[key]
        conds = []
        if lo is not None:
            params[f"{prefix}_{i}_lo"] = lo
            conds.append(f"{field} >= :{prefix}_{i}_lo")
        if hi is not None:
            params[f"{prefix}_{i}_hi"] = hi
            conds.append(f"{field} < :{prefix}_{i}_hi")
        parts.append("(" + " AND ".join(conds) + ")")
    return "AND (" + " OR ".join(parts) + ")"