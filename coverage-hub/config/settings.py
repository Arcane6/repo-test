import os
from dotenv import load_dotenv

load_dotenv()

ORACLE_USER = os.getenv("ORACLE_USER")
ORACLE_PASSWORD = os.getenv("ORACLE_PASSWORD")
ORACLE_DSN = os.getenv("ORACLE_DSN")
ORACLE_CLIENT_LIB_DIR = os.getenv("ORACLE_CLIENT_LIB_DIR")

POOL_MIN = 1
POOL_MAX = 5
POOL_INCREMENT = 1

# BigQuery — autenticação via Application Default Credentials (padrão do
# Google Cloud), não um usuário/senha próprio. GOOGLE_APPLICATION_CREDENTIALS
# (apontando pro JSON da service account) já é lido direto do ambiente
# pela lib do Google — só precisamos do projeto aqui.
BIGQUERY_PROJECT = os.getenv("BIGQUERY_PROJECT")