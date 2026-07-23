"""
Queries do módulo Tráfego (planejado × realizado).

Substituiu a volumetria da RAN (ALTAIA) — a fonte de tráfego mudou. Duas
tabelas Oracle, ambas por município:

- **REL_TRAFEGO_CIDADES_WIDE** (planejado): uma linha por
  (município, TIPO_TRAF), com os 12 meses do ano em COLUNAS
  (JANEIRO..DEZEMBRO). Existe também a REL_TRAFEGO_CIDADES_LONG (mesmo
  dado com mês em linha em vez de coluna) — aqui usamos a WIDE e
  desempilhamos os meses no Python (service), porque é a que temos o
  schema confirmado.
  - TIPO_TRAF ∈ {Consolidado, 2G/3G, 4G, 4G/5G, 5G}. **Consolidado é o
    total oficial** — NÃO é a soma das outras (as camadas se sobrepõem,
    ex.: "4G/5G" é uma camada combinada). Pra total, sempre filtrar
    TIPO_TRAF='Consolidado'.
  - Valores já vêm em **PB** (petabytes).
  - MUNICIPIO_ID é o IBGE de 6 dígitos (sem dígito verificador).

- **REL_DS013_TRAFEGO_REALIZADO** (realizado): uma linha por
  (município, OPERADORA), snapshot mensal (DT_REFERENCIA). Traz TIM e OI
  → dá pra calcular market share. Tráfego de dados em MB
  (S_MEGABYTE_*), aditivo por tecnologia (2G+3G+4G+5G_NSA+5G_SA = TOTAL,
  confirmado). Pra comparar com o planejado (PB), converter
  MB→PB dividindo por 1e9 (decimal: 1 PB = 1e9 MB) — feito no service.

Placeholders de filtro geográfico ({uf_filter}/{municipio_filter}) e de
tempo ({ano_filter}/{periodo_filter}) seguem o padrão introspectivo do
resto do portal (só injeta o que o template tem).
"""

# Ordem dos meses como aparecem na WIDE (colunas). O índice+1 é o número
# do mês — usado no service pra YTD (somar Jan..mês corrente).
MESES_WIDE = [
    "JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
]


# ---------- Planejado — AGREGADO no Oracle ----------
# A WIDE também é grande (município × TIPO_TRAF ≈ 28k linhas/ano). Mesma
# ideia do realizado: deixa o Oracle agregar e volta só o necessário. Os 12
# meses vêm em colunas, então cada SUM(mês) vira M01..M12 — série usada
# tal-qual na Curva Mensal (cada ponto já É a volumetria do próprio mês,
# nunca cumulativa). Os KPIs/rankings usam só o mês de corte (dezembro,
# sempre — o plano é conhecido pro ano inteiro), nunca a soma dos 12 — ver
# service.py (`_plan_por_camada` lê o índice de dezembro, não soma).
_SUM_MESES_COLS = ",\n    ".join(f"SUM({m}) AS M{i:02d}" for i, m in enumerate(MESES_WIDE, start=1))

# Por TIPO_TRAF (5 linhas), com os 12 meses somados nacionalmente. A linha
# 'Consolidado' dá a série mensal; as linhas {2G/3G,4G,5G} dão o split
# aditivo — mas só o valor de dezembro entra nos KPIs (ver acima).
PLANEJADO_POR_CAMADA = f"""
SELECT
    TIPO_TRAF,
    {_SUM_MESES_COLS}
FROM REL_TRAFEGO_CIDADES_WIDE
WHERE ANO = :ano
{{uf_filter}}
{{municipio_filter}}
GROUP BY TIPO_TRAF
"""

# Por UF (só Consolidado), com os 12 meses — o service soma Jan..mês corrente
# pra o YTD por UF. ~27 linhas.
PLANEJADO_POR_UF = f"""
SELECT
    ESTADO,
    {_SUM_MESES_COLS}
FROM REL_TRAFEGO_CIDADES_WIDE
WHERE ANO = :ano AND TIPO_TRAF = 'Consolidado'
{{uf_filter}}
{{municipio_filter}}
GROUP BY ESTADO
"""

# Top 15 municípios por tráfego planejado do MÊS DE CORTE (dez, sempre — o
# plano é conhecido pro ano inteiro, então o corte do "Plano 26" é sempre
# dezembro). Traço NÃO soma os 12 meses (tráfego é métrica mensal, não
# cumulativa) — só a coluna de dezembro.
PLANEJADO_TOP_MUNICIPIOS = """
SELECT * FROM (
    SELECT
        MUNICIPIO_NOME,
        SUM(DEZEMBRO) AS TOTAL_DEZ
    FROM REL_TRAFEGO_CIDADES_WIDE
    WHERE ANO = :ano AND TIPO_TRAF = 'Consolidado'
    {uf_filter}
    {municipio_filter}
    GROUP BY MUNICIPIO_NOME
    ORDER BY TOTAL_DEZ DESC
) WHERE ROWNUM <= 15
"""


# ---------- Realizado — AGREGADO no Oracle ----------
# A tabela crua é grande: município × operadora × mês ≈ 140k linhas no ano
# cheio. Em vez de puxar tudo e agregar no Python, deixamos o Oracle
# agregar (GROUP BY) e devolver só o que o dashboard precisa:
#
#  - REALIZADO_POR_MUNICIPIO: uma linha por município (soma dos meses do
#    período e de TODAS as operadoras — OI é da TIM, ver service), com o
#    total e o split por tecnologia. ~5,5k linhas em vez de 140k. Alimenta
#    total, mix por tecnologia, ranking de município e quebra por UF.
#  - REALIZADO_POR_MES: uma linha por mês (12), só o total. Alimenta a
#    curva de acompanhamento e descobre o mês corrente (YTD).
#
# Valores agregados voltam em MB (converter pra PB dividindo por 1e9 no
# service). O split por tecnologia é aditivo (2G+3G+4G+5G = total).
REALIZADO_POR_MUNICIPIO = """
SELECT
    ESTADO,
    MUNICIPIO_NOME,
    MUNICIPIO_ID,
    SUM(S_MEGABYTE_TOTAL) AS MB_TOTAL,
    SUM(S_MEGABYTE_2G) AS MB_2G,
    SUM(S_MEGABYTE_3G) AS MB_3G,
    SUM(S_MEGABYTE_4G) AS MB_4G,
    SUM(S_MEGABYTE_5G_NSA) + SUM(S_MEGABYTE_5G_SA) AS MB_5G
FROM REL_DS013_TRAFEGO_REALIZADO
WHERE 1 = 1
{periodo_filter}
{uf_filter}
{municipio_filter}
GROUP BY ESTADO, MUNICIPIO_NOME, MUNICIPIO_ID
"""

REALIZADO_POR_MES = """
SELECT
    EXTRACT(MONTH FROM DT_REFERENCIA) AS MES,
    SUM(S_MEGABYTE_TOTAL) AS MB_TOTAL
FROM REL_DS013_TRAFEGO_REALIZADO
WHERE EXTRACT(YEAR FROM DT_REFERENCIA) = :ano
{uf_filter}
{municipio_filter}
GROUP BY EXTRACT(MONTH FROM DT_REFERENCIA)
"""
