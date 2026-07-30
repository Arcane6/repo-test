"""
Referência mais recente de cada tabela-fonte, exibida como badge nos
visuais ("de onde vem esse número e de quando é a carga").
"""

from database.oracle import execute_query
from modules.mobile_access.shared.constants import DEFAULT_PLAN_YEAR

REFS_QUERY = """
SELECT 'MUNICIPIOS_FECHAMENTO' AS tabela,
       TO_CHAR(MAX(DT_CARGA), 'DD/MM/YYYY') AS ref
FROM NTW_OP.MUNICIPIOS_FECHAMENTO

UNION ALL

SELECT 'TB_FT_BASE_UNICA_SITES',
       TO_CHAR(MAX(MES_REF), 'MM/YYYY')
FROM NTW_OP.TB_FT_BASE_UNICA_SITES

UNION ALL

-- Mesma data de referência da Base Única (TB_FT_BASE_UNICA_SITES), a
-- pedido do usuário — não a própria coluna REF de BASE_TB_END_ID_NEW.
SELECT 'BASE_TB_END_ID_NEW',
       TO_CHAR(MAX(MES_REF), 'MM/YYYY')
FROM NTW_OP.TB_FT_BASE_UNICA_SITES

UNION ALL

SELECT 'TB_ROLLOUT_ACESSO',
       'Plano ' || TO_CHAR(MAX(PLANO))
FROM NTW_OP.TB_ROLLOUT_ACESSO
"""

# Tabelas sem coluna de referência conhecida no banco — o badge mostra um
# texto estático (versão/ciclo de planejamento) em vez de uma data.
# VW_CAPEX_MASTER_FULL/TB_NEXUS_CN_CE: view/tabela via NEXUS sem coluna de
# carga própria — o "cenário" já cumpre esse papel de referência no card.
# TB_NEXUS_FINANCEIRO: ciclo "CAC v0.1" (pedido explícito do usuário).
# REL_CIDADES_PLANEJADO_26: sem MES_REF/DT_CARGA (lista fechada do plano,
# ver CLAUDE.md) — usa o ano do plano como referência.
STATIC_REFS = {
    "TB_NEXUS_CN_CE": None,
    "VW_CAPEX_MASTER_FULL": None,
    "TB_NEXUS_FINANCEIRO": "CAC v0.1",
    "REL_CIDADES_PLANEJADO_26": f"Plano {DEFAULT_PLAN_YEAR}",
}


def get_refs():
    rows = execute_query(REFS_QUERY)
    result = {r["tabela"]: r["ref"] for r in rows}
    for t, ref in STATIC_REFS.items():
        result.setdefault(t, ref)
    return result
