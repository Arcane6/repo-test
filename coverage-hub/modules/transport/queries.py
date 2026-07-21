"""
Query do módulo Transporte (perfil de infraestrutura de TX).

Fonte: NTW_OP.REL_TX_PROFILE — 1 linha por site (END_ID), snapshot único. Tabela
pequena (~33k linhas) e com MUITOS cortes ortogonais (mídia, capacidade,
MAKE/BUY, tecnologia rádio, regional, migração 25→26). Por isso — ao
contrário do Tráfego, que multiplicava por ano×operadora×mês (~140k) — aqui
puxamos uma projeção enxuta UMA vez e agregamos no Python; é mais simples e
o volume não justifica um GROUP BY por corte.

Colunas-chave:
- TIPO_TX_25 / TIPO_TX_26 / TIPO_TX_PLAN: tipo de transporte "<MÍDIA>
  <CAPACIDADE>" (ex.: "FO 10G", "MW <1G", "SAT LEO"). MÍDIA ∈ {FO, MW,
  SAT, LL, SLS, N/I}. RS (RanSharing) NÃO está aqui — vem de CLASSIFICACAO.
- CLASSIFICACAO = 'RANSHARING' marca os sites de RanSharing (o service
  deriva mídia='RS' deles).
- TECNOLOGIA: rádio servido ("2G/3G/4G/5G") — cruzado com fiberização.
- METODO_CONSTRUTIVO_FO: MAKE (fibra própria) × BUY (comprada) × METIS...
- IBGE_ID: IBGE de 6 dígitos (ponte de filtro de município, como no Tráfego).
"""

TX_PROFILE = """
SELECT
    REGIONAL,
    UF,
    MUNICIPIO,
    IBGE_ID,
    TECNOLOGIA,
    METODO_CONSTRUTIVO_FO,
    TIPO_TX_25,
    TIPO_TX_26,
    TIPO_TX_PLAN,
    CLASSIFICACAO
FROM NTW_OP.REL_TX_PROFILE
WHERE 1 = 1
{uf_filter}
{municipio_filter}
{regional_filter}
"""
