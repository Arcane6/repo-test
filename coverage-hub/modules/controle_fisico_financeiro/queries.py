"""
Queries do módulo Controle Físico-Financeiro.

Fonte: NTW_OP.CTRL_ACESSO_EVENTOS / NTW_OP.CTRL_TRANSPORTE_EVENTOS (ver
ddl.sql) — tabelas EVENT LOG (append-only, nunca UPDATE). Cada linha é um
lançamento; o "estado atual" de um ITEM_ID é a linha de maior ID_EVENTO,
resolvida pela view NTW_OP.VW_CONTROLE_ATUAL (ROW_NUMBER() OVER PARTITION
BY CAMADA, ITEM_ID ORDER BY ID_EVENTO DESC = 1). O histórico completo (pra
auditoria) sai de NTW_OP.VW_CONTROLE_FISICO_FINANCEIRO, sem o filtro de
"último evento".

Camada Core foi explicitamente deixada de fora por pedido do usuário
("ESQUECE CORE POR AGORA, NAO CRIE TABELA PARA ELE POR AGORA") — só
ACESSO e TRANSPORTE existem hoje.
"""

TABLE_MAP = {
    "acesso": "NTW_OP.CTRL_ACESSO_EVENTOS",
    "transporte": "NTW_OP.CTRL_TRANSPORTE_EVENTOS",
}

# Nome real das colunas de dimensão específica de cada camada, mapeadas
# pros genéricos DIMENSAO_1/DIMENSAO_2 usados nas views unificadas.
DIM_COLUMNS = {
    "acesso": ("TECNOLOGIA", "CLASSIFICACAO_CASA"),
    "transporte": ("MIDIA", "CAPACIDADE"),
}

STATUS_OPTIONS = ["PLANEJADO", "EM_EXECUCAO", "CONCLUIDO", "CANCELADO"]
TIPO_EVENTO_OPTIONS = [
    "PLANEJAMENTO", "ATUALIZACAO_STATUS", "REALIZACAO", "REVISAO_FINANCEIRA", "CANCELAMENTO",
]

# Colunas simples (não-dimensão) que fazem sentido como opção de filtro.
FILTER_COLUMNS = ["PROJETO", "REGIONAL", "UF"]


def estado_atual_sql(where_clause):
    """Estado atual (1 linha por ITEM_ID) de uma camada, via VW_CONTROLE_ATUAL."""
    return f"""
        SELECT ID_EVENTO AS id_evento, ITEM_ID AS item_id, PROJETO AS projeto,
               ANO_PLANO AS ano_plano, IBGE_ID AS ibge_id, UF AS uf,
               MUNICIPIO AS municipio, REGIONAL AS regional,
               DIMENSAO_1 AS dimensao_1, DIMENSAO_2 AS dimensao_2,
               STATUS AS status, DATA_PLANEJADA AS data_planejada,
               DATA_REALIZADA AS data_realizada, VALOR_PLANEJADO AS valor_planejado,
               VALOR_REALIZADO AS valor_realizado, MOEDA AS moeda,
               TIPO_EVENTO AS tipo_evento, DATA_EVENTO AS data_evento,
               USUARIO_LANCAMENTO AS usuario_lancamento, OBSERVACAO AS observacao
        FROM NTW_OP.VW_CONTROLE_ATUAL
        WHERE CAMADA = :camada
        {where_clause}
        ORDER BY MUNICIPIO, ITEM_ID
    """


def historico_item_sql():
    """Todos os eventos de um ITEM_ID (auditoria completa), do mais antigo
    pro mais novo."""
    return """
        SELECT ID_EVENTO AS id_evento, ITEM_ID AS item_id, PROJETO AS projeto,
               ANO_PLANO AS ano_plano, IBGE_ID AS ibge_id, UF AS uf,
               MUNICIPIO AS municipio, REGIONAL AS regional,
               DIMENSAO_1 AS dimensao_1, DIMENSAO_2 AS dimensao_2,
               STATUS AS status, DATA_PLANEJADA AS data_planejada,
               DATA_REALIZADA AS data_realizada, VALOR_PLANEJADO AS valor_planejado,
               VALOR_REALIZADO AS valor_realizado, MOEDA AS moeda,
               TIPO_EVENTO AS tipo_evento, DATA_EVENTO AS data_evento,
               USUARIO_LANCAMENTO AS usuario_lancamento, OBSERVACAO AS observacao
        FROM NTW_OP.VW_CONTROLE_FISICO_FINANCEIRO
        WHERE CAMADA = :camada AND ITEM_ID = :item_id
        ORDER BY ID_EVENTO ASC
    """


def opcoes_sql(camada, column):
    """Valores distintos de uma coluna (pra popular dropdown de filtro).
    `column` só pode vir de um allowlist fixo (FILTER_COLUMNS ou as
    DIM_COLUMNS da própria camada) — nunca de input livre do usuário."""
    table = TABLE_MAP[camada]
    return f"""
        SELECT DISTINCT {column} AS label
        FROM {table}
        WHERE {column} IS NOT NULL
        ORDER BY 1
    """


def insert_evento_sql(camada):
    """INSERT de um novo evento/lançamento na camada. Sempre um INSERT puro
    — o "estado atual" muda só porque este novo evento passa a ser o de
    maior ID_EVENTO pro ITEM_ID; a linha anterior nunca é tocada."""
    table = TABLE_MAP[camada]
    dim1, dim2 = DIM_COLUMNS[camada]
    return f"""
        INSERT INTO {table} (
            ITEM_ID, PROJETO, ANO_PLANO, IBGE_ID, UF, MUNICIPIO, REGIONAL,
            {dim1}, {dim2}, STATUS, DATA_PLANEJADA, DATA_REALIZADA,
            VALOR_PLANEJADO, VALOR_REALIZADO, MOEDA, TIPO_EVENTO,
            USUARIO_LANCAMENTO, OBSERVACAO
        ) VALUES (
            :item_id, :projeto, :ano_plano, :ibge_id, :uf, :municipio, :regional,
            :dim1, :dim2, :status, :data_planejada, :data_realizada,
            :valor_planejado, :valor_realizado, :moeda, :tipo_evento,
            :usuario_lancamento, :observacao
        )
    """
