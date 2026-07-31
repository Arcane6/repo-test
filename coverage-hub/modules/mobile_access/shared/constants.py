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

# Cenário default de todo combo sobre VW_CAPEX_MASTER_FULL ("Endereço por
# Tecnologia" e "CAC por Projeto", Raia 2) — pedido explícito do usuário
# (jul/26, atualizado de "2026 FCST 6+6 V0" pra este). Nome de cenário
# muda por ciclo de planejamento — se um dia deixar de existir na view,
# o service cai pro primeiro cenário retornado.
DEFAULT_CAPEX_SCENARIO = "2026 CAC (26-28) V02"


# ---------------------------------------------------------------------------
# Filtro global "População Urbana" (jul/26) — faixas fixas, não intervalo
# livre (decisão do usuário): POPULACAO_URBANA é numérica em
# MUNICIPIOS_FECHAMENTO, mas o filtro na UI é um combo de faixas, não dois
# campos De/Até. Cada bucket é (mínimo inclusivo, máximo exclusivo);
# `None` = sem limite naquela ponta. Fonte única (backend monta a
# cláusula SQL, frontend monta as opções do combo) — mudar uma faixa muda
# nos dois lugares de uma vez só.
POP_URBANA_BUCKETS = {
    "ate_20k": (None, 20_000),
    "20k_100k": (20_000, 100_000),
    "100k_500k": (100_000, 500_000),
    "500k_mais": (500_000, None),
}

POP_URBANA_BUCKET_LABELS = {
    "ate_20k": "Até 20 mil",
    "20k_100k": "20 mil – 100 mil",
    "100k_500k": "100 mil – 500 mil",
    "500k_mais": "Acima de 500 mil",
}