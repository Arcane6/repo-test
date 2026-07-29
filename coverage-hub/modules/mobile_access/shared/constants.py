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

# Mesmas cores do front (SMALL_MULTIPLE_COLORS em optionBuilders.ts) —
# fonte única visual pra Casa Nova x Casa Existente em qualquer gráfico
# novo que precise colorir por essa dimensão.
CASA_COLORS = {"CN": "#26C281", "CE": "#1565C0"}


# Ano default do filtro "Ano" do Resumo
DEFAULT_PLAN_YEAR = 2026

# Cenário default do combo "Endereço por Tecnologia" (VW_CAPEX_MASTER_FULL) —
# mesmo cenário fixo já usado na query de referência do CLAUDE.md pra essa
# view. Nome de cenário muda por ciclo de planejamento (ver "Ainda em
# aberto" no CLAUDE.md) — se um dia "2026 CAC (26-28) V02" deixar de
# existir na view, o service cai pro primeiro cenário retornado.
DEFAULT_CAPEX_SCENARIO = "2026 CAC (26-28) V02"