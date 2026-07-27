"""
Universo "site" de NTW_OP.TB_FT_BASE_UNICA_SITES — hierarquia confirmada
pelo usuário (árvore "Total de Sites Ativos"), fonte única pra qualquer
gráfico que precise contar sites por essa classificação:

    Total Sites Ativos = Total Sites TIM (RF + TX) + Roaming Vivo
      Total Sites TIM (RF + TX) = Sites TX/DC/PI (sem RF) + Mobile Sites
        Mobile Sites = TIM + Ran Sharing
          TIM = Macro + (Small Cell + Móvel + SLS)

Cada categoria é definida por STATUS_END_ID/TIPO_SITE/MOBILE_SITE — NUNCA
por TECNOLOGIA (dimensão ortogonal: "qual rádio o site tem", não "o que
o site é"). Regras confirmadas explicitamente pelo usuário:
  - Macro: só STATUS_END_ID='ATIVADO' + TIPO_SITE='MACRO_SITE' — SEM
    MOBILE_SITE='SIM' (proposital: site macro pode não ter essa flag).
  - Small Cell/Móvel/SLS e Ran Sharing: MOBILE_SITE='SIM' + TIPO_SITE
    IN (...) — é OR entre os 3 tipos, não AND (um site só tem 1 TIPO_SITE).
  - Sem RF (TX/DC/PI): STATUS_END_ID='ATIVADO' aplicado aos 4 tipos
    juntos (não só ao primeiro — cuidado que a fonte original tinha
    ambiguidade de precedência AND/OR aqui, resolvida com o usuário).

"Mobile Sites" é o universo usado pelos gráficos de site do portal
(Total de Sites por Tecnologia, Fornecedor por Site, Sites por
Tecnologia, Pivot, mapa) — a única exceção documentada é "Tipo de Site"
(aba Sites), que é DELIBERADAMENTE outro universo (mostra a própria
dimensão MOBILE_SITE, não filtra por ela — ver sites/queries.py).
"""

MACRO_WHERE = "(STATUS_END_ID = 'ATIVADO' AND TIPO_SITE = 'MACRO_SITE')"

SMALL_CELL_MOVEL_SLS_WHERE = (
    "(MOBILE_SITE = 'SIM' AND TIPO_SITE IN ('MOVEL', 'SLS', 'SMALL_CELL'))"
)

TIM_WHERE = f"({MACRO_WHERE} OR {SMALL_CELL_MOVEL_SLS_WHERE})"

RAN_SHARING_WHERE = "(MOBILE_SITE = 'SIM' AND TIPO_SITE = 'RAN SHARING')"

# Universo usado pelos gráficos de site do portal (ver docstring acima).
MOBILE_SITES_WHERE = f"({TIM_WHERE} OR {RAN_SHARING_WHERE})"

SEM_RF_WHERE = (
    "(STATUS_END_ID = 'ATIVADO' AND TIPO_SITE IN "
    "('SITE_TRANSPORTE', 'MACRO_SITE_REMAN', 'PREDIO_INDUSTRIAL', 'DATA CENTER'))"
)

TOTAL_SITES_TIM_WHERE = f"({SEM_RF_WHERE} OR {MOBILE_SITES_WHERE})"

ROAMING_VIVO_WHERE = "(MOBILE_SITE = 'SIM' AND TIPO_SITE = 'ROAMING VIVO')"

TOTAL_SITES_ATIVOS_WHERE = f"({TOTAL_SITES_TIM_WHERE} OR {ROAMING_VIVO_WHERE})"
