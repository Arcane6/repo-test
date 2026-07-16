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


# ---------- Planejado (WIDE) — por município × TIPO_TRAF, 12 meses ----------
PLANEJADO_WIDE = f"""
SELECT
    TIPO_TRAF,
    ESTADO,
    MUNICIPIO_NOME,
    MUNICIPIO_ID,
    {", ".join(MESES_WIDE)},
    ANO
FROM REL_TRAFEGO_CIDADES_WIDE
WHERE ANO = :ano
{{uf_filter}}
{{municipio_filter}}
"""


# ---------- Realizado — por município × operadora, snapshot mensal ----------
# S_MEGABYTE_TOTAL é o tráfego de dados total; as colunas por tecnologia
# somam ao total. DT_REFERENCIA é o mês de referência.
REALIZADO = """
SELECT
    ESTADO,
    MUNICIPIO_NOME,
    MUNICIPIO_ID,
    OPERADORA,
    EXTRACT(YEAR FROM DT_REFERENCIA) AS ANO,
    EXTRACT(MONTH FROM DT_REFERENCIA) AS MES,
    S_MEGABYTE_TOTAL,
    S_MEGABYTE_2G,
    S_MEGABYTE_3G,
    S_MEGABYTE_4G,
    S_MEGABYTE_5G_NSA,
    S_MEGABYTE_5G_SA
FROM REL_DS013_TRAFEGO_REALIZADO
WHERE 1 = 1
{periodo_filter}
{uf_filter}
{municipio_filter}
"""
