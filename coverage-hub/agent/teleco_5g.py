import pandas as pd
import requests
from io import StringIO


URL_TELECO_5G = "https://teleco.com.br/5g_cobertura.asp"

_INDICE_TABELA_5G = 3

_TELECO_5G_CACHE = None


def limpar_numero_municipios(valor):
    """
    Corrige valores lidos da página da Teleco.

    Exemplos esperados:
    1.094 -> 1094
    1.674 -> 1674
    942.000 -> 942
    637.000 -> 637
    33.000 -> 33
    """

    if pd.isna(valor):
        return None

    # Caso o pandas já tenha convertido para número
    if isinstance(valor, (int, float)):
        numero = float(valor)

        # Exemplo: 1.094 significa 1094, não 1
        if not numero.is_integer() and numero < 10:
            return int(round(numero * 1000))

        return int(round(numero))

    texto = str(valor).strip()

    if texto in ["", "-", "nan", "NaN", "None"]:
        return None

    # Remove espaços
    texto = texto.replace(" ", "")

    # Caso tipo "1.094", "1.674", "2.305"
    # Na Teleco, o ponto representa milhar.
    if "." in texto and "," not in texto:
        partes = texto.split(".")

        if len(partes[-1]) == 3:
            texto = texto.replace(".", "")

    # Caso venha com vírgula decimal, normaliza.
    texto = texto.replace(",", ".")

    try:
        numero = float(texto)

        # Segurança extra: 1.094 ainda deve virar 1094
        if not numero.is_integer() and numero < 10:
            return int(round(numero * 1000))

        return int(round(numero))

    except ValueError:
        return None

    
def carregar_tabela_teleco_5g(force_reload: bool = False) -> pd.DataFrame:
    """
    Acessa a página da Teleco e retorna a tabela de municípios 5G por operadora.

    Regras:
    - Usa a tabela de índice configurado em _INDICE_TABELA_5G.
    - Não trava nomes de colunas de períodos, como 2024, 2025, Mai/26, Jun/26.
    - Identifica automaticamente a coluna de operadora.
    - Identifica automaticamente colunas numéricas/períodos.
    - Usa cache em memória para evitar acessar o site a cada pergunta.
    """

    global _TELECO_5G_CACHE

    if _TELECO_5G_CACHE is not None and not force_reload:
        return _TELECO_5G_CACHE.copy()

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    response = requests.get(
        URL_TELECO_5G,
        headers=headers,
        timeout=30
    )

    response.raise_for_status()

    tabelas = pd.read_html(StringIO(response.text))

    if len(tabelas) <= _INDICE_TABELA_5G:
        raise ValueError(
            f"Tabela índice {_INDICE_TABELA_5G} não encontrada. "
            f"Quantidade de tabelas encontradas: {len(tabelas)}"
        )

    df = tabelas[_INDICE_TABELA_5G].copy()

    df.columns = [
        str(coluna).strip()
        for coluna in df.columns
    ]

    # Identifica coluna de operadora de forma flexível
    colunas_operadora = [
        coluna for coluna in df.columns
        if "operadora" in coluna.lower()
    ]

    if not colunas_operadora:
        raise ValueError(
            "Não foi possível identificar a coluna de operadora. "
            f"Colunas disponíveis: {df.columns.tolist()}"
        )

    coluna_operadora = colunas_operadora[0]

    # Padroniza o nome da coluna de operadora
    if coluna_operadora != "Operadora":
        df = df.rename(columns={coluna_operadora: "Operadora"})

    df["Operadora"] = df["Operadora"].astype("string").str.strip()

    # Remove linhas sem operadora
    df = df[df["Operadora"].notna()].copy()

    # Identifica colunas numéricas/períodos sem travar nomes
    colunas_valores = [
        coluna for coluna in df.columns
        if coluna != "Operadora"
    ]

    for coluna in colunas_valores:
        df[coluna] = df[coluna].apply(limpar_numero_municipios).astype("Int64")

    _TELECO_5G_CACHE = df.copy()

    return df


def obter_coluna_periodo_mais_recente(df: pd.DataFrame) -> str:
    """
    Identifica a coluna de período mais recente na tabela da Teleco.

    A lógica é:
    - ignora a coluna Operadora;
    - ignora colunas como Novos Municípios;
    - usa a última coluna de período disponível na tabela.
    """

    colunas_candidatas = []

    for coluna in df.columns:
        nome = str(coluna).strip()
        nome_lower = nome.lower()

        if nome == "Operadora":
            continue

        if "novo" in nome_lower:
            continue

        colunas_candidatas.append(nome)

    if not colunas_candidatas:
        raise ValueError(
            "Não foi possível identificar colunas de período na tabela."
        )

    return colunas_candidatas[-1]


def consultar_municipios_5g_teleco(
    operadora: str = "",
    periodo: str = ""
) -> str:
    """
    Consulta a tabela da Teleco com número reportado de municípios 5G por operadora.

    Parâmetros:
    - operadora: nome da operadora desejada. Exemplo: TIM, Vivo, Claro, Brisanet.
      Se vazio, retorna todas as operadoras.
    - periodo: período desejado. Exemplo: 2024, 2025, Mai/26, Jun/26.
      Se vazio, usa o período mais recente identificado.
    """

    df = carregar_tabela_teleco_5g()

    periodos_disponiveis = [
        str(coluna).strip()
        for coluna in df.columns
        if str(coluna).strip() != "Operadora"
        and "novo" not in str(coluna).strip().lower()
    ]

    if not periodos_disponiveis:
        raise ValueError("Nenhum período disponível foi identificado na tabela.")

    periodo = str(periodo).strip()
    operadora = str(operadora).strip()

    if periodo == "":
        coluna_periodo = obter_coluna_periodo_mais_recente(df)
    else:
        periodo_normalizado = periodo.lower()

        candidatos = [
            coluna for coluna in periodos_disponiveis
            if str(coluna).strip().lower() == periodo_normalizado
        ]

        if not candidatos:
            return (
                f"Período '{periodo}' não encontrado na tabela da Teleco.\n"
                f"Períodos disponíveis: {', '.join(periodos_disponiveis)}"
            )

        coluna_periodo = candidatos[0]

    df_consulta = df.copy()

    if operadora != "":
        operadora_normalizada = operadora.lower()

        df_consulta = df_consulta[
            df_consulta["Operadora"]
            .astype("string")
            .str.strip()
            .str.lower()
            .eq(operadora_normalizada)
        ].copy()

        if df_consulta.empty:
            operadoras_disponiveis = (
                df["Operadora"]
                .dropna()
                .astype(str)
                .tolist()
            )

            return (
                f"Operadora '{operadora}' não encontrada na tabela da Teleco.\n"
                f"Operadoras disponíveis: {', '.join(operadoras_disponiveis)}"
            )

    linhas = []

    linhas.append("Número reportado de municípios com 5G por operadora.")
    linhas.append(f"Fonte: Teleco - {URL_TELECO_5G}")
    linhas.append(f"Período consultado: {coluna_periodo}")
    linhas.append("")
    linhas.append("Resultado:")

    for _, linha in df_consulta.iterrows():
        linhas.append(f"- {linha['Operadora']}: {linha[coluna_periodo]}")

    return "\n".join(linhas)