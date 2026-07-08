"""
Constantes compartilhadas por todas as abas do módulo Mobile Access.
"""

# ---------------------------------------------------------------------------
# Cores e ordem canônica
# ---------------------------------------------------------------------------

TECH_COLORS = {
    "2G": "#1E88E5",
    "3G": "#E53935",
    "4G": "#F5C518",
    "5G": "#7DC242",
}

TECH_ORDER = ["2G", "3G", "4G", "5G"]

TIM_BRAND_COLOR = "#003399"


# ---------------------------------------------------------------------------
# Regras de negócio do PLANO
# ---------------------------------------------------------------------------

# PRIORIDADEs consideradas como "operacionais" — excluídas por default do plano
# estratégico. Se quiser incluir, o usuário marca "Incluir operações" no filtro.
OPERATIONAL_PRIORITIES = [
    "SWAP ANF11",
    "SWAP ANF11 - 2G",
    "SWAP 2026 NOKIA",
    "PROJETO CRESCIMENTO IHS",
    "PROJETO CRESCIMENTO SBA",
    "PROJETO CRESCIMENTO HIGHLINE",
    "PROJETO CRESCIMENTO WINITY",
    "PROJETO CRESCIMENTO INCA",
    "PROJETO CRESCIMENTO TBSA",
]

# Categorias de CLASSIFICACAO_CASA
NEW_SITE = "NEW SITE"
CASA_EXISTENTE = "CASA EXISTENTE"
CO_SITE_CASA_NOVA = "CO SITE CASA NOVA"

# Ano default
DEFAULT_PLAN_YEAR = 2026