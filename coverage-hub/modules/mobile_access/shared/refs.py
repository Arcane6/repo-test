"""
Referência mais recente de cada tabela-fonte, exibida como badge nos
visuais ("de onde vem esse número e de quando é a carga").
"""

from database.oracle import execute_query

REFS_QUERY = """
SELECT 'MUNICIPIOS_FECHAMENTO' AS tabela,
       TO_CHAR(MAX(DT_CARGA), 'DD/MM/YYYY') AS ref
FROM NTW_OP.MUNICIPIOS_FECHAMENTO

UNION ALL

SELECT 'TB_FT_BASE_UNICA_SITES',
       TO_CHAR(MAX(MES_REF), 'MM/YYYY')
FROM NTW_OP.TB_FT_BASE_UNICA_SITES

UNION ALL

SELECT 'BASE_TB_END_ID_NEW',
       (SELECT REF FROM (
            SELECT REF
            FROM NTW_MABE.BASE_TB_END_ID_NEW
            GROUP BY REF
            ORDER BY TO_DATE(REF, 'MM-YYYY') DESC
        ) WHERE ROWNUM = 1)
FROM DUAL

UNION ALL

SELECT 'TB_ROLLOUT_ACESSO',
       'Plano ' || TO_CHAR(MAX(PLANO))
FROM NTW_OP.TB_ROLLOUT_ACESSO
"""

# Tabelas sem coluna de referência conhecida — o badge mostra só o nome.
# VW_CAPEX_MASTER_FULL: view via DB link (NEXUS_LINK), sem coluna de
# carga própria — o "cenário" já cumpre esse papel de referência no card.
STATIC_TABLES = ["TB_NEXUS_FINANCEIRO", "TB_NEXUS_CN_CE", "VW_CAPEX_MASTER_FULL"]


def get_refs():
    rows = execute_query(REFS_QUERY)
    result = {r["tabela"]: r["ref"] for r in rows}
    for t in STATIC_TABLES:
        result.setdefault(t, None)
    return result
