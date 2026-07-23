import oracledb

from config.settings import (
    ORACLE_USER,
    ORACLE_PASSWORD,
    ORACLE_DSN,
    ORACLE_CLIENT_LIB_DIR,
    POOL_MIN,
    POOL_MAX,
    POOL_INCREMENT,
)


if ORACLE_CLIENT_LIB_DIR:
    oracledb.init_oracle_client(
        lib_dir=ORACLE_CLIENT_LIB_DIR
    )


pool = oracledb.create_pool(
    user=ORACLE_USER,
    password=ORACLE_PASSWORD,
    dsn=ORACLE_DSN,
    min=POOL_MIN,
    max=POOL_MAX,
    increment=POOL_INCREMENT,
)


def execute_query(sql, params=None):
    params = params or {}

    with pool.acquire() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)

            columns = [
                col[0].lower()
                for col in cursor.description
            ]

            rows = cursor.fetchall()

            return [
                dict(zip(columns, row))
                for row in rows
            ]


def execute_write(sql, params=None):
    """INSERT/UPDATE/DELETE de uma linha só, com commit. Retorna o número
    de linhas afetadas."""
    params = params or {}

    with pool.acquire() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            rowcount = cursor.rowcount
            connection.commit()
            return rowcount


def execute_write_many(sql, params_list):
    """INSERT em lote (executemany) com um único commit — usado para colar/
    aplicar muitas linhas de uma vez na grid. Retorna o número de linhas."""
    if not params_list:
        return 0

    with pool.acquire() as connection:
        with connection.cursor() as cursor:
            cursor.executemany(sql, params_list)
            connection.commit()
            return len(params_list)