from datetime import date
from pathlib import Path
import pandas as pd
import re
import duckdb

try:
    from .dicionario_municipios import DICIONARIO_MUNICIPIOS, SINONIMOS_TECNOLOGIA
except ImportError:
    from dicionario_municipios import DICIONARIO_MUNICIPIOS, SINONIMOS_TECNOLOGIA

_DF_MUNICIPIOS_CACHE = None
_CONTEXTO_MUNICIPIOS_CACHE = None
_IBGES_PLANEJAMENTO_5G_2026_CACHE = None

EXCEL_PATH = Path(r"C:\Users\F8058485\OneDrive - TIM\Planning Integration - Documentos Compartilhados\General\2 - Operational Performance\Projetos\30_Data_Domain\01-Portal_Opex_Integration\Fontes de dados\Municípios TIM Brasil_Fechamento.xlsx")
SHEET_NAME = "Municípios"
HEADER_ROW = 8 # Cabeçalho na linha 9 do Excel

PLANO_5G_PATH = EXCEL_PATH.with_name("Municípios TIM Brasil_Fechamento - Plano Nominal 5G 2027.xlsx")
PLANO_5G_SHEET_NAME = "Plano Cidades"
PLANO_5G_HEADER_ROW = 6  # cabeçalho na linha 7 do Excel
PLANO_5G_COLUNA_IBGE = "IBGE"
PLANO_5G_COLUNA_STATUS = "Status Atual 5G na Cidade"
PLANO_5G_STATUS_ALVO = "Lançamento 5G 2026"
DATA_PLANEJAMENTO_LANCAMENTO_2026 = pd.Timestamp("2026-12-31")


def carregar_municipios(force_reload: bool = False) -> pd.DataFrame:
    """
    Carrega a aba Municípios do Excel e retorna um DataFrame padronizado.
    Usa cache em memória para evitar reler o Excel a cada pergunta.

    Regras:
    - Usa somente a aba Municípios.
    - Usa cabeçalho na linha 9.
    - Seleciona as colunas pela posição informada no dicionário.
    - Renomeia as colunas para os nomes padronizados.
    - Não depende dos nomes originais do Excel.
    """
    global _DF_MUNICIPIOS_CACHE

    if _DF_MUNICIPIOS_CACHE is not None and not force_reload:
        return _DF_MUNICIPIOS_CACHE

    df_original = pd.read_excel(
        EXCEL_PATH,
        sheet_name=SHEET_NAME,
        header=HEADER_ROW
    )

    colunas_originais = []
    nomes_padronizados = []

    for numero_coluna, campo in sorted(DICIONARIO_MUNICIPIOS.items()):
        indice_pandas = numero_coluna - 1

        if indice_pandas >= len(df_original.columns):
            raise ValueError(
                f"A coluna número {numero_coluna} não existe no Excel. "
                f"O arquivo possui apenas {len(df_original.columns)} colunas."
            )

        coluna_original = df_original.columns[indice_pandas]
        nome_padronizado = campo["nome"]

        colunas_originais.append(coluna_original)
        nomes_padronizados.append(nome_padronizado)

    df = df_original[colunas_originais].copy()
    df.columns = nomes_padronizados

    df = tratar_tipos_municipios(df)
    df = aplicar_planejamento_5g_2026(df)

    _DF_MUNICIPIOS_CACHE = df

    return _DF_MUNICIPIOS_CACHE


def carregar_ibges_planejamento_5g_2026(force_reload: bool = False) -> set:
    """
    Lê o arquivo de plano nominal 5G e retorna os IBGEs dos municípios
    com status 'Lançamento 5G 2026'.

    Usa cache em memória para evitar reler o Excel de planejamento
    a cada consulta.

    Esta função apenas identifica os municípios planejados.
    Ela ainda não altera a base principal.
    """

    global _IBGES_PLANEJAMENTO_5G_2026_CACHE

    if _IBGES_PLANEJAMENTO_5G_2026_CACHE is not None and not force_reload:
        return _IBGES_PLANEJAMENTO_5G_2026_CACHE

    df_plano = pd.read_excel(
        PLANO_5G_PATH,
        sheet_name=PLANO_5G_SHEET_NAME,
        header=PLANO_5G_HEADER_ROW,
    )

    df_plano.columns = (
        df_plano.columns
        .astype(str)
        .str.strip()
    )

    colunas_necessarias = [
        PLANO_5G_COLUNA_IBGE,
        PLANO_5G_COLUNA_STATUS,
    ]

    for coluna in colunas_necessarias:
        if coluna not in df_plano.columns:
            raise ValueError(
                f"Coluna obrigatória não encontrada no plano 5G: {coluna}. "
                f"Colunas disponíveis: {df_plano.columns.tolist()}"
            )

    filtro = (
        df_plano[PLANO_5G_COLUNA_STATUS]
        .astype("string")
        .str.strip()
        .eq(PLANO_5G_STATUS_ALVO)
    )

    ibges = (
        pd.to_numeric(
            df_plano.loc[filtro, PLANO_5G_COLUNA_IBGE],
            errors="coerce"
        )
        .dropna()
        .astype("Int64")
        .astype(int)
        .unique()
        .tolist()
    )

    _IBGES_PLANEJAMENTO_5G_2026_CACHE = set(ibges)

    return _IBGES_PLANEJAMENTO_5G_2026_CACHE


def aplicar_planejamento_5g_2026(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aplica o planejamento de lançamento 5G 2026 na base de municípios.

    Regras:
    - Considera os IBGEs do arquivo de plano nominal 5G com status
      'Lançamento 5G 2026'.
    - Para os IBGEs do plano:
        - se mes_div_5g estiver nula, preenche com 2026-12-31;
    - Para 5G:
        - se a data de divulgação for maior que hoje, a presença correspondente deve ser 0.
    - Não altera datas já existentes.
    - Não altera presença quando a data é menor ou igual a hoje.
    """

    df = df.copy()

    data_hoje = pd.Timestamp.today().normalize()

    ibges_planejamento = carregar_ibges_planejamento_5g_2026()

    if not ibges_planejamento:
        return df

    if "ibge" not in df.columns:
        raise ValueError("Coluna ibge não encontrada na base de municípios.")

    pares_planejamento = [
        {
            "coluna_data": "mes_div_5g",
            "coluna_presenca": "presenca_5g",
        },
    ]

    for par in pares_planejamento:
        coluna_data = par["coluna_data"]
        coluna_presenca = par["coluna_presenca"]

        if coluna_data not in df.columns:
            raise ValueError(f"Coluna {coluna_data} não encontrada na base de municípios.")

        if coluna_presenca not in df.columns:
            raise ValueError(f"Coluna {coluna_presenca} não encontrada na base de municípios.")

    mask_planejamento = df["ibge"].isin(ibges_planejamento)

    for par in pares_planejamento:
        coluna_data = par["coluna_data"]
        coluna_presenca = par["coluna_presenca"]

        # 1. Para os municípios do plano, se a data estiver vazia,
        #    preenche com a data planejada de final de 2026.
        mask_data_vazia_no_plano = mask_planejamento & df[coluna_data].isna()

        df.loc[
            mask_data_vazia_no_plano,
            coluna_data
        ] = DATA_PLANEJAMENTO_LANCAMENTO_2026

        # 2. Para qualquer município com data futura nessa tecnologia,
        #    marca a presença como 0, porque ainda é planejamento.
        mask_data_futura = (
            df[coluna_data].notna()
            & (df[coluna_data] > data_hoje)
        )

        df.loc[
            mask_data_futura,
            coluna_presenca
        ] = 0

    return df


def executar_sql_municipios(sql: str) -> str:
    """
    Executa uma consulta SQL somente leitura sobre a base padronizada de municípios.

    A tabela disponível para consulta se chama: municipios.

    Regras:
    - Aceita apenas SELECT ou WITH.
    - Bloqueia comandos de alteração de dados.
    - Retorna a SQL executada junto com o resultado para facilitar auditoria.
    """

    sql_original = sql.strip()
    sql_validacao = sql_original.lower()

    comandos_bloqueados = [
        "insert",
        "update",
        "delete",
        "drop",
        "alter",
        "create",
        "truncate",
        "merge",
        "grant",
        "revoke",
        "replace",
    ]

    if not (
        sql_validacao.startswith("select")
        or sql_validacao.startswith("with")
    ):
        return "Erro: somente consultas SELECT ou WITH são permitidas."

    for comando in comandos_bloqueados:
        if re.search(rf"\b{comando}\b", sql_validacao):
            return f"Erro: comando bloqueado detectado: {comando}"

    df = carregar_municipios()

    con = duckdb.connect(database=":memory:")

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


_CONTEXTO_MUNICIPIOS_CACHE = None


def obter_contexto_municipios() -> str:
    """
    Monta o contexto mínimo da base para o agente.

    Esta função apenas transforma o dicionário externo em texto.
    Não contém regras de comportamento, regras SQL ou regras de resposta.
    """

    global _CONTEXTO_MUNICIPIOS_CACHE

    if _CONTEXTO_MUNICIPIOS_CACHE is not None:
        return _CONTEXTO_MUNICIPIOS_CACHE

    linhas = []

    linhas.append("Tabela SQL: municipios")
    linhas.append("Granularidade: cada linha representa um município.")
    linhas.append("")
    linhas.append("Colunas disponíveis:")

    for numero_coluna, campo in sorted(DICIONARIO_MUNICIPIOS.items()):
        linhas.append(
            f"- {campo['nome']} | "
            f"coluna_excel={numero_coluna} | "
            f"tipo={campo['tipo_esperado']} | "
            f"descricao={campo['descricao']}"
        )

    linhas.append("")
    linhas.append("Sinônimos de tecnologia:")

    for sinonimo, tecnologia in SINONIMOS_TECNOLOGIA.items():
        linhas.append(f"- {sinonimo} => {tecnologia}")

    _CONTEXTO_MUNICIPIOS_CACHE = "\n".join(linhas)

    return _CONTEXTO_MUNICIPIOS_CACHE


def tratar_tipos_municipios(df: pd.DataFrame) -> pd.DataFrame:
    """
    Trata valores inválidos e converte colunas conforme o tipo esperado
    definido no dicionário de municípios.

    Principal regra:
    - Em colunas de data, valores como "-", "", "nan" e similares viram nulo.
    - Depois, as colunas de data são convertidas para datetime.
    """

    df = df.copy()

    valores_nulos = [
        "-",
        "",
        " ",
        "nan",
        "NaN",
        "NAN",
        "null",
        "NULL",
        "None",
        "none",
    ]

    for _, campo in sorted(DICIONARIO_MUNICIPIOS.items()):
        nome_coluna = campo["nome"]
        tipo_esperado = campo["tipo_esperado"]

        if nome_coluna not in df.columns:
            continue

        if tipo_esperado == "data":
            df[nome_coluna] = df[nome_coluna].replace(valores_nulos, pd.NA)

            df[nome_coluna] = pd.to_datetime(
                df[nome_coluna],
                errors="coerce",
                dayfirst=True
            )

        elif tipo_esperado in ["numero", "inteiro"]:
            df[nome_coluna] = df[nome_coluna].replace(valores_nulos, pd.NA)

            df[nome_coluna] = pd.to_numeric(
                df[nome_coluna],
                errors="coerce"
            )

        elif tipo_esperado in ["texto", "texto_multivalor"]:
            df[nome_coluna] = df[nome_coluna].replace(valores_nulos, pd.NA)

            df[nome_coluna] = (
                df[nome_coluna]
                .astype("string")
                .str.strip()
            )

            df[nome_coluna] = df[nome_coluna].replace(
                {
                    "": pd.NA,
                    "-": pd.NA,
                    "nan": pd.NA,
                    "NaN": pd.NA,
                    "None": pd.NA,
                    "NULL": pd.NA,
                    "null": pd.NA,
                }
            )

    return df


def calcular_score_oportunidade_5g(
    uf: str = "",
    limite: int = 50
) -> str:
    """
    Calcula o score preliminar de oportunidade municipal para lançamento 5G.

    O score vai de 0 a 100 e considera:
    - população;
    - gap 5G;
    - prontidão 4G, priorizando alta frequência;
    - planejamento/projeto;
    - qualidade dos dados;
    - conurbação/proximidade com município que já possui 5G atual.

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
    data_final_2026 = "2026-12-31"

    sql = f"""
WITH candidatos AS (
    SELECT
        ibge,
        uf,
        regional,
        municipio,
        populacao_total,
        projeto,
        presenca_4g,
        banda_4g_mhz,
        mes_div_4g,
        presenca_5g,
        mes_div_5g,
        latitude_municipio,
        longitude_municipio
    FROM municipios
    WHERE (mes_div_5g IS NULL OR mes_div_5g > DATE '{data_hoje}')
      {filtro_uf}
),

base_score AS (
    SELECT
        *,
        MAX(populacao_total) OVER () AS max_populacao
    FROM candidatos
),

score_parcial AS (
    SELECT
        ibge,
        uf,
        regional,
        municipio,
        populacao_total,
        projeto,
        presenca_4g,
        banda_4g_mhz,
        mes_div_4g,
        presenca_5g,
        mes_div_5g,
        latitude_municipio,
        longitude_municipio,

        CASE
            WHEN max_populacao IS NOT NULL
             AND max_populacao > 0
            THEN ROUND((populacao_total / max_populacao) * 25, 2)
            ELSE 0
        END AS score_populacao,

        CASE
            WHEN mes_div_5g IS NULL
            THEN 25

            WHEN mes_div_5g > DATE '{data_hoje}'
             AND mes_div_5g <= DATE '{data_final_2026}'
            THEN 12

            ELSE 0
        END AS score_gap_5g,

        CASE
            WHEN presenca_4g = 1
             AND (
                regexp_matches(CAST(banda_4g_mhz AS VARCHAR), '(^|[^0-9])1800([^0-9]|$)')
                OR regexp_matches(CAST(banda_4g_mhz AS VARCHAR), '(^|[^0-9])2100([^0-9]|$)')
                OR regexp_matches(CAST(banda_4g_mhz AS VARCHAR), '(^|[^0-9])2600([^0-9]|$)')
             )
            THEN 15

            WHEN presenca_4g = 1
             AND (
                regexp_matches(CAST(banda_4g_mhz AS VARCHAR), '(^|[^0-9])700([^0-9]|$)')
                OR regexp_matches(CAST(banda_4g_mhz AS VARCHAR), '(^|[^0-9])850([^0-9]|$)')
             )
            THEN 8

            WHEN presenca_4g = 1
            THEN 5

            ELSE 0
        END AS score_prontidao_4g,

        CASE
            WHEN mes_div_5g IS NOT NULL
             AND mes_div_5g > DATE '{data_hoje}'
             AND mes_div_5g <= DATE '{data_final_2026}'
            THEN 10

            WHEN projeto IS NOT NULL
             AND TRIM(CAST(projeto AS VARCHAR)) <> ''
             AND TRIM(CAST(projeto AS VARCHAR)) <> '-'
            THEN 10

            ELSE 0
        END AS score_planejamento,

        CASE
            WHEN ibge IS NOT NULL
             AND populacao_total IS NOT NULL
             AND latitude_municipio IS NOT NULL
             AND longitude_municipio IS NOT NULL
            THEN 5

            ELSE 0
        END AS score_qualidade

    FROM base_score
),

referencias_5g AS (
    SELECT
        ibge,
        municipio,
        latitude_municipio,
        longitude_municipio
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
    JOIN referencias_5g r
      ON c.ibge <> r.ibge

    WHERE c.latitude_municipio IS NOT NULL
      AND c.longitude_municipio IS NOT NULL
      AND ABS(c.latitude_municipio - r.latitude_municipio) <= 0.10
      AND ABS(c.longitude_municipio - r.longitude_municipio) <= 0.10
),

menor_distancia AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY ibge_candidato
            ORDER BY distancia_km ASC
        ) AS rn
    FROM pares_proximidade
    WHERE distancia_km < 5
),

score_conurbacao AS (
    SELECT
        ibge_candidato,
        municipio_5g_mais_proximo,
        distancia_km,
        20 AS score_conurbacao
    FROM menor_distancia
    WHERE rn = 1
),

score_final_base AS (
    SELECT
        sp.ibge,
        sp.uf,
        sp.regional,
        sp.municipio,
        sp.populacao_total,
        sp.projeto,
        sp.presenca_4g,
        sp.banda_4g_mhz,
        sp.presenca_5g,
        sp.mes_div_5g,

        sp.score_populacao,
        sp.score_gap_5g,
        sp.score_prontidao_4g,
        sp.score_planejamento,
        sp.score_qualidade,

        COALESCE(sc.score_conurbacao, 0) AS score_conurbacao,
        sc.municipio_5g_mais_proximo,
        ROUND(sc.distancia_km, 2) AS distancia_5g_mais_proximo_km,

        ROUND(
            sp.score_populacao
            + sp.score_gap_5g
            + sp.score_prontidao_4g
            + sp.score_planejamento
            + sp.score_qualidade
            + COALESCE(sc.score_conurbacao, 0),
            2
        ) AS score_oportunidade_5g

    FROM score_parcial sp
    LEFT JOIN score_conurbacao sc
      ON sp.ibge = sc.ibge_candidato
),

score_final AS (
    SELECT
        *,
        CASE
            WHEN score_oportunidade_5g >= 80
            THEN 'Alta prioridade'

            WHEN score_oportunidade_5g >= 60
            THEN 'Boa oportunidade'

            WHEN score_oportunidade_5g >= 40
            THEN 'Oportunidade média'

            ELSE 'Baixa prioridade preliminar'
        END AS faixa_oportunidade
    FROM score_final_base
)

SELECT
    ibge,
    uf,
    regional,
    municipio,
    populacao_total,
    presenca_4g,
    banda_4g_mhz,
    presenca_5g,
    mes_div_5g,
    score_populacao,
    score_gap_5g,
    score_prontidao_4g,
    score_planejamento,
    score_qualidade,
    score_conurbacao,
    municipio_5g_mais_proximo,
    distancia_5g_mais_proximo_km,
    score_oportunidade_5g,
    faixa_oportunidade
FROM score_final
ORDER BY
    score_oportunidade_5g DESC,
    populacao_total DESC
LIMIT {limite}
"""

    return executar_sql_municipios(sql)