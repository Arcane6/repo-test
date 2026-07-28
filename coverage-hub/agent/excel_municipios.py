"""
Base de municípios do agente — fonte real é NTW_OP.MUNICIPIOS_FECHAMENTO
(Oracle), lida via database.oracle.execute_query, a mesma tabela e o
mesmo helper que o resto do portal usa (não é um Excel separado; o Excel
"Municípios TIM Brasil_Fechamento.xlsx" que alimentava a versão anterior
deste módulo era, na verdade, um export direto dessa tabela — confirmado
pelo usuário).

O nome do arquivo ficou "excel_municipios" por histórico (era o nome
original, quando lia Excel de verdade) — as funções que `agent.py` importa
(obter_contexto_municipios, executar_sql_municipios,
calcular_score_oportunidade_5g) continuam com a mesma assinatura, só o
miolo mudou.

Regra de presença atual (mesma de modules/mobile_access/actual/queries.py,
usada pela aba "Cidades"): PRESENCA_xG da tabela fica 1 assim que o site
entra em rollout, mesmo antes de divulgado. "Presença atual" tem que
refletir o que já foi de fato divulgado — por isso presença é sempre
recalculada a partir de MES_DIV_xG <= hoje, nunca lida direto da flag
crua da tabela. Aplicado às 4 tecnologias aqui (a versão anterior baseada
em Excel só corrigia isso pra 5G).

Planejamento 5G: municípios listados em NTW_OP.REL_CIDADES_PLANEJADO_26
(lista fechada de cidades do plano do ano corrente — mesma tabela usada
em R2_NEW_CITIES_BY_ANF, summary/queries.py) sem mes_div_5g preenchida
recebem 31/dez do ano do plano (DEFAULT_PLAN_YEAR), sinalizando
planejamento futuro sem lançamento real ainda.
"""

from datetime import date

import re
import pandas as pd
import duckdb

from database.oracle import execute_query
from modules.mobile_access.shared.constants import DEFAULT_PLAN_YEAR

try:
    from .dicionario_municipios import COLUNAS_MUNICIPIOS, SINONIMOS_TECNOLOGIA
except ImportError:
    from dicionario_municipios import COLUNAS_MUNICIPIOS, SINONIMOS_TECNOLOGIA

_DF_MUNICIPIOS_CACHE = None
_CONTEXTO_MUNICIPIOS_CACHE = None
_IBGES_PLANEJAMENTO_5G_CACHE = None

DATA_PLANEJAMENTO_LANCAMENTO = pd.Timestamp(date(DEFAULT_PLAN_YEAR, 12, 31))

# Colunas trazidas direto da tabela (sem recálculo) — nome Oracle == nome
# padronizado em maiúsculo, então nem precisa de alias no SELECT; o
# execute_query já devolve as chaves em minúsculo.
_COLUNAS_DIRETAS = [
    nome_oracle
    for nome_oracle in COLUNAS_MUNICIPIOS
    if not nome_oracle.startswith("PRESENCA")
]

_MUNICIPIOS_QUERY = f"""
SELECT
    {', '.join(_COLUNAS_DIRETAS)},
    CASE WHEN MES_DIV_2G IS NOT NULL AND MES_DIV_2G <= TRUNC(SYSDATE) THEN 1 ELSE 0 END AS PRESENCA_2G,
    CASE WHEN MES_DIV_3G IS NOT NULL AND MES_DIV_3G <= TRUNC(SYSDATE) THEN 1 ELSE 0 END AS PRESENCA_3G,
    CASE WHEN MES_DIV_4G IS NOT NULL AND MES_DIV_4G <= TRUNC(SYSDATE) THEN 1 ELSE 0 END AS PRESENCA_4G,
    CASE WHEN MES_DIV_5G IS NOT NULL AND MES_DIV_5G <= TRUNC(SYSDATE) THEN 1 ELSE 0 END AS PRESENCA_5G
FROM NTW_OP.MUNICIPIOS_FECHAMENTO
WHERE TRUNC(DT_CARGA) = (
    SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO
)
"""

_IBGES_PLANEJAMENTO_QUERY = "SELECT DISTINCT IBGE FROM NTW_OP.REL_CIDADES_PLANEJADO_26"


def carregar_ibges_planejamento_5g(force_reload: bool = False) -> set:
    """
    IBGEs das cidades do plano de lançamento do ano corrente
    (NTW_OP.REL_CIDADES_PLANEJADO_26) — lista fechada, sem coluna de
    status: toda linha dessa tabela já É uma cidade planejada.
    """
    global _IBGES_PLANEJAMENTO_5G_CACHE

    if _IBGES_PLANEJAMENTO_5G_CACHE is not None and not force_reload:
        return _IBGES_PLANEJAMENTO_5G_CACHE

    rows = execute_query(_IBGES_PLANEJAMENTO_QUERY)
    _IBGES_PLANEJAMENTO_5G_CACHE = {int(r["ibge"]) for r in rows if r.get("ibge") is not None}

    return _IBGES_PLANEJAMENTO_5G_CACHE


def aplicar_planejamento_5g(df: pd.DataFrame) -> pd.DataFrame:
    """
    Para os IBGEs do plano do ano corrente sem mes_div_5g preenchida,
    preenche com 31/dez do ano do plano (DEFAULT_PLAN_YEAR) e marca
    presenca_5g = 0 (é planejamento futuro, não presença já realizada).
    Não mexe em datas já existentes.
    """
    df = df.copy()

    ibges_planejamento = carregar_ibges_planejamento_5g()

    if not ibges_planejamento:
        return df

    mask_planejamento = df["ibge"].isin(ibges_planejamento)
    mask_data_vazia = mask_planejamento & df["mes_div_5g"].isna()

    df.loc[mask_data_vazia, "mes_div_5g"] = DATA_PLANEJAMENTO_LANCAMENTO

    mask_data_futura = df["mes_div_5g"].notna() & (df["mes_div_5g"] > pd.Timestamp.today().normalize())
    df.loc[mask_data_futura, "presenca_5g"] = 0

    return df


def _tratar_tipos(df: pd.DataFrame) -> pd.DataFrame:
    """Ajustes leves — o Oracle já entrega tipo consistente (diferente do
    Excel, sem "-"/vazio/texto solto pra tratar); só garante numérico em
    ibge/população e datetime nas colunas de data."""
    df = df.copy()

    for coluna in ("ibge", "populacao_urbana", "populacao_total"):
        if coluna in df.columns:
            df[coluna] = pd.to_numeric(df[coluna], errors="coerce")

    for campo in COLUNAS_MUNICIPIOS.values():
        nome_coluna = campo["nome"]
        if campo["tipo_esperado"] == "data" and nome_coluna in df.columns:
            df[nome_coluna] = pd.to_datetime(df[nome_coluna], errors="coerce")

    return df


def carregar_municipios(force_reload: bool = False) -> pd.DataFrame:
    """
    Carrega a base de municípios do Oracle e retorna um DataFrame
    padronizado. Cache em memória do processo (mesmo princípio das
    outras fontes deste agente) — evita reconsultar o banco a cada
    pergunta do chat.
    """
    global _DF_MUNICIPIOS_CACHE

    if _DF_MUNICIPIOS_CACHE is not None and not force_reload:
        return _DF_MUNICIPIOS_CACHE

    rows = execute_query(_MUNICIPIOS_QUERY)
    df = pd.DataFrame(rows)

    df = _tratar_tipos(df)
    df = aplicar_planejamento_5g(df)

    df["presenca"] = (
        (df["presenca_2g"] == 1)
        | (df["presenca_3g"] == 1)
        | (df["presenca_4g"] == 1)
        | (df["presenca_5g"] == 1)
    ).astype(int)

    _DF_MUNICIPIOS_CACHE = df

    return _DF_MUNICIPIOS_CACHE


def executar_sql_municipios(sql: str) -> str:
    """
    Executa uma consulta SQL somente leitura sobre a base padronizada de
    municípios (DuckDB em memória, isolado do Oracle real — o SQL gerado
    pelo agente nunca chega perto da conexão de produção).

    A tabela disponível para consulta se chama: municipios.
    """

    sql_original = sql.strip()
    sql_validacao = sql_original.lower()

    comandos_bloqueados = [
        "insert", "update", "delete", "drop", "alter", "create",
        "truncate", "merge", "grant", "revoke", "replace",
    ]

    if not (sql_validacao.startswith("select") or sql_validacao.startswith("with")):
        return "Erro: somente consultas SELECT ou WITH são permitidas."

    for comando in comandos_bloqueados:
        if re.search(rf"\b{comando}\b", sql_validacao):
            return f"Erro: comando bloqueado detectado: {comando}"

    df = carregar_municipios()

    # enable_external_access=False trava funções de tabela do DuckDB que
    # leem arquivo/rede (read_csv, httpfs etc.) — sem isso, nada impedia
    # um SQL gerado tentar algo como "SELECT * FROM read_csv_auto(...)"
    # e ler arquivo do servidor. O bloqueio de palavra-chave acima só
    # cobre DML/DDL, não isso.
    con = duckdb.connect(database=":memory:", config={"enable_external_access": False})

    try:
        con.register("municipios", df)

        resultado = con.execute(sql_original).fetchdf()

        if resultado.empty:
            return (
                "SQL executada:\n"
                f"```sql\n{sql_original}\n```\n\n"
                "Resultado:\n"
                "Consulta executada com sucesso, mas não retornou registros."
            )

        if len(resultado) > 100:
            retorno = (
                "SQL executada:\n"
                f"```sql\n{sql_original}\n```\n\n"
                "Resultado:\n"
                f"{resultado.head(100).to_markdown(index=False)}"
            )
            retorno += (
                f"\n\nResultado limitado aos 100 primeiros registros "
                f"de {len(resultado)} linhas retornadas."
            )
            return retorno

        return (
            "SQL executada:\n"
            f"```sql\n{sql_original}\n```\n\n"
            "Resultado:\n"
            f"{resultado.to_markdown(index=False)}"
        )

    except Exception as e:
        return (
            "SQL executada:\n"
            f"```sql\n{sql_original}\n```\n\n"
            f"Erro ao executar SQL: {e}"
        )

    finally:
        con.close()


def obter_contexto_municipios() -> str:
    """Monta o contexto mínimo da base para o agente — só transforma o
    dicionário externo em texto, sem regra de comportamento."""

    global _CONTEXTO_MUNICIPIOS_CACHE

    if _CONTEXTO_MUNICIPIOS_CACHE is not None:
        return _CONTEXTO_MUNICIPIOS_CACHE

    linhas = []
    linhas.append("Tabela SQL: municipios")
    linhas.append("Granularidade: cada linha representa um município.")
    linhas.append("")
    linhas.append("Colunas disponíveis:")

    for campo in COLUNAS_MUNICIPIOS.values():
        linhas.append(
            f"- {campo['nome']} | tipo={campo['tipo_esperado']} | descricao={campo['descricao']}"
        )

    linhas.append("")
    linhas.append("Sinônimos de tecnologia:")

    for sinonimo, tecnologia in SINONIMOS_TECNOLOGIA.items():
        linhas.append(f"- {sinonimo} => {tecnologia}")

    _CONTEXTO_MUNICIPIOS_CACHE = "\n".join(linhas)

    return _CONTEXTO_MUNICIPIOS_CACHE


def calcular_score_oportunidade_5g(uf: str = "", limite: int = 50) -> str:
    """
    Calcula o score preliminar de oportunidade municipal para lançamento 5G.

    O score vai de 0 a 100 e considera: população, gap 5G, prontidão 4G
    (priorizando alta frequência), planejamento/projeto, qualidade dos
    dados e conurbação/proximidade com município que já possui 5G atual.

    Parâmetros:
    - uf: UF opcional para filtrar o ranking. Exemplo: "PR".
    - limite: quantidade máxima de municípios retornados.
    """

    uf = str(uf).strip().upper()

    try:
        limite = int(limite)
    except Exception:
        limite = 50

    if limite <= 0:
        limite = 50
    if limite > 200:
        limite = 200

    filtro_uf = ""
    if uf:
        if len(uf) != 2 or not uf.isalpha():
            return "Erro: informe uma UF válida com 2 letras. Exemplo: PR, SP, RJ."
        filtro_uf = f"AND uf = '{uf}'"

    data_hoje = date.today().isoformat()
    data_final_plano = f"{DEFAULT_PLAN_YEAR}-12-31"

    sql = f"""
WITH candidatos AS (
    SELECT
        ibge, uf, regional, municipio, populacao_total, projeto,
        presenca_4g, banda_4g_mhz, mes_div_4g,
        presenca_5g, mes_div_5g,
        latitude_municipio, longitude_municipio
    FROM municipios
    WHERE (mes_div_5g IS NULL OR mes_div_5g > DATE '{data_hoje}')
      {filtro_uf}
),

base_score AS (
    SELECT *, MAX(populacao_total) OVER () AS max_populacao
    FROM candidatos
),

score_parcial AS (
    SELECT
        ibge, uf, regional, municipio, populacao_total, projeto,
        presenca_4g, banda_4g_mhz, mes_div_4g,
        presenca_5g, mes_div_5g,
        latitude_municipio, longitude_municipio,

        CASE
            WHEN max_populacao IS NOT NULL AND max_populacao > 0
            THEN ROUND((populacao_total / max_populacao) * 25, 2)
            ELSE 0
        END AS score_populacao,

        CASE
            WHEN mes_div_5g IS NULL THEN 25
            WHEN mes_div_5g > DATE '{data_hoje}' AND mes_div_5g <= DATE '{data_final_plano}' THEN 12
            ELSE 0
        END AS score_gap_5g,

        CASE
            WHEN presenca_4g = 1 AND (
                regexp_matches(CAST(banda_4g_mhz AS VARCHAR), '(^|[^0-9])1800([^0-9]|$)')
                OR regexp_matches(CAST(banda_4g_mhz AS VARCHAR), '(^|[^0-9])2100([^0-9]|$)')
                OR regexp_matches(CAST(banda_4g_mhz AS VARCHAR), '(^|[^0-9])2600([^0-9]|$)')
            ) THEN 15
            WHEN presenca_4g = 1 AND (
                regexp_matches(CAST(banda_4g_mhz AS VARCHAR), '(^|[^0-9])700([^0-9]|$)')
                OR regexp_matches(CAST(banda_4g_mhz AS VARCHAR), '(^|[^0-9])850([^0-9]|$)')
            ) THEN 8
            WHEN presenca_4g = 1 THEN 5
            ELSE 0
        END AS score_prontidao_4g,

        CASE
            WHEN mes_div_5g IS NOT NULL AND mes_div_5g > DATE '{data_hoje}' AND mes_div_5g <= DATE '{data_final_plano}'
            THEN 10
            WHEN projeto IS NOT NULL AND TRIM(CAST(projeto AS VARCHAR)) <> '' AND TRIM(CAST(projeto AS VARCHAR)) <> '-'
            THEN 10
            ELSE 0
        END AS score_planejamento,

        CASE
            WHEN ibge IS NOT NULL AND populacao_total IS NOT NULL
             AND latitude_municipio IS NOT NULL AND longitude_municipio IS NOT NULL
            THEN 5
            ELSE 0
        END AS score_qualidade

    FROM base_score
),

referencias_5g AS (
    SELECT ibge, municipio, latitude_municipio, longitude_municipio
    FROM municipios
    WHERE mes_div_5g IS NOT NULL
      AND mes_div_5g <= DATE '{data_hoje}'
      AND latitude_municipio IS NOT NULL
      AND longitude_municipio IS NOT NULL
),

pares_proximidade AS (
    SELECT
        c.ibge AS ibge_candidato,
        r.ibge AS ibge_referencia,
        r.municipio AS municipio_5g_mais_proximo,
        6371 * 2 * ASIN(
            SQRT(
                POWER(SIN(((r.latitude_municipio - c.latitude_municipio) * PI() / 180) / 2), 2)
                + COS(c.latitude_municipio * PI() / 180)
                * COS(r.latitude_municipio * PI() / 180)
                * POWER(SIN(((r.longitude_municipio - c.longitude_municipio) * PI() / 180) / 2), 2)
            )
        ) AS distancia_km
    FROM candidatos c
    JOIN referencias_5g r ON c.ibge <> r.ibge
    WHERE c.latitude_municipio IS NOT NULL
      AND c.longitude_municipio IS NOT NULL
      AND ABS(c.latitude_municipio - r.latitude_municipio) <= 0.10
      AND ABS(c.longitude_municipio - r.longitude_municipio) <= 0.10
),

menor_distancia AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY ibge_candidato ORDER BY distancia_km ASC) AS rn
    FROM pares_proximidade
    WHERE distancia_km < 5
),

score_conurbacao AS (
    SELECT ibge_candidato, municipio_5g_mais_proximo, distancia_km, 20 AS score_conurbacao
    FROM menor_distancia
    WHERE rn = 1
),

score_final_base AS (
    SELECT
        sp.ibge, sp.uf, sp.regional, sp.municipio, sp.populacao_total, sp.projeto,
        sp.presenca_4g, sp.banda_4g_mhz, sp.presenca_5g, sp.mes_div_5g,
        sp.score_populacao, sp.score_gap_5g, sp.score_prontidao_4g,
        sp.score_planejamento, sp.score_qualidade,
        COALESCE(sc.score_conurbacao, 0) AS score_conurbacao,
        sc.municipio_5g_mais_proximo,
        ROUND(sc.distancia_km, 2) AS distancia_5g_mais_proximo_km,
        ROUND(
            sp.score_populacao + sp.score_gap_5g + sp.score_prontidao_4g
            + sp.score_planejamento + sp.score_qualidade
            + COALESCE(sc.score_conurbacao, 0),
            2
        ) AS score_oportunidade_5g
    FROM score_parcial sp
    LEFT JOIN score_conurbacao sc ON sp.ibge = sc.ibge_candidato
),

score_final AS (
    SELECT *,
        CASE
            WHEN score_oportunidade_5g >= 80 THEN 'Alta prioridade'
            WHEN score_oportunidade_5g >= 60 THEN 'Boa oportunidade'
            WHEN score_oportunidade_5g >= 40 THEN 'Oportunidade média'
            ELSE 'Baixa prioridade preliminar'
        END AS faixa_oportunidade
    FROM score_final_base
)

SELECT
    ibge, uf, regional, municipio, populacao_total,
    presenca_4g, banda_4g_mhz, presenca_5g, mes_div_5g,
    score_populacao, score_gap_5g, score_prontidao_4g, score_planejamento, score_qualidade,
    score_conurbacao, municipio_5g_mais_proximo, distancia_5g_mais_proximo_km,
    score_oportunidade_5g, faixa_oportunidade
FROM score_final
ORDER BY score_oportunidade_5g DESC, populacao_total DESC
LIMIT {limite}
"""

    return executar_sql_municipios(sql)
