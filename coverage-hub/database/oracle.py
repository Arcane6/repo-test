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