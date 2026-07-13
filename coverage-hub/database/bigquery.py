"""
Conector para o Google BigQuery — mesmo espírito de database/oracle.py
(uma função execute_query(sql, params) que devolve list[dict]), pronto
pra uso futuro. Nenhuma feature do portal usa isso ainda.

Diferente do Oracle (dependência de runtime do app inteiro, pool criado
na importação do módulo), aqui o client é criado sob demanda (lazy) —
assim este módulo pode existir no repo sem exigir credencial de GCP
configurada e sem quebrar a inicialização do Flask enquanto nada o usa.

Autenticação via Application Default Credentials (ADC), o mecanismo
padrão do Google Cloud — não inventamos um esquema próprio:
    - Local/dev: aponte GOOGLE_APPLICATION_CREDENTIALS (no .env) pro
      arquivo JSON de uma service account.
    - Rodando dentro do GCP (Cloud Run, GKE, Compute Engine etc.): a
      identidade do próprio serviço já basta, sem variável nenhuma.
"""

from google.cloud import bigquery

from config.settings import BIGQUERY_PROJECT


_client = None


def _get_client():
    global _client
    if _client is None:
        _client = bigquery.Client(project=BIGQUERY_PROJECT) if BIGQUERY_PROJECT else bigquery.Client()
    return _client


def _to_query_parameter(name, value):
    """Infere o ScalarQueryParameter/ArrayQueryParameter certo pro tipo
    Python do valor — BigQuery exige o tipo declarado no parâmetro,
    diferente do bind solto do oracledb."""
    if isinstance(value, bool):
        return bigquery.ScalarQueryParameter(name, "BOOL", value)
    if isinstance(value, int):
        return bigquery.ScalarQueryParameter(name, "INT64", value)
    if isinstance(value, float):
        return bigquery.ScalarQueryParameter(name, "FLOAT64", value)
    if isinstance(value, (list, tuple)):
        if not value:
            raise ValueError(
                f"Parâmetro '{name}': lista vazia não permite inferir o tipo do array"
            )
        first = value[0]
        if isinstance(first, bool):
            elem_type = "BOOL"
        elif isinstance(first, int):
            elem_type = "INT64"
        elif isinstance(first, float):
            elem_type = "FLOAT64"
        else:
            elem_type = "STRING"
        return bigquery.ArrayQueryParameter(name, elem_type, list(value))
    return bigquery.ScalarQueryParameter(name, "STRING", value)


def execute_query(sql, params=None):
    """
    Roda uma query parametrizada e devolve list[dict] — mesmo formato
    de database/oracle.py.execute_query, pra um service novo não
    precisar aprender uma API diferente. `params` é um dict simples
    (ex.: {"uf": "SP", "anos": [2025, 2026]}); na query, os
    placeholders usam a sintaxe do BigQuery (`@uf`, `@anos`), não `:uf`
    como no Oracle.
    """
    params = params or {}
    job_config = bigquery.QueryJobConfig(
        query_parameters=[_to_query_parameter(k, v) for k, v in params.items()]
    )
    rows = _get_client().query(sql, job_config=job_config).result()
    columns = [field.name.lower() for field in rows.schema]
    return [dict(zip(columns, row.values())) for row in rows]
