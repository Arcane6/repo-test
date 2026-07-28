try:
    from .excel_municipios import (
        carregar_municipios,
        executar_sql_municipios,
    )
except ImportError:
    from excel_municipios import (
        carregar_municipios,
        executar_sql_municipios,
    )


# Opcional: força recarregar a base e reaplicar os tratamentos/planejamento.
# Se quiser usar cache normal, pode comentar esta linha.
carregar_municipios(force_reload=True)


sql = """
SELECT
    CASE
        WHEN mes_div_4g IS NULL THEN '4G sem data'
        WHEN mes_div_4g <= DATE '2026-07-23' THEN '4G atual'
        WHEN mes_div_4g > DATE '2026-07-23' THEN '4G futuro'
    END AS situacao_4g,
    COUNT(DISTINCT ibge) AS qtd_cidades
FROM municipios
WHERE mes_div_5g IS NOT NULL
  AND mes_div_5g > DATE '2026-07-23'
  AND mes_div_5g <= DATE '2026-12-31'
GROUP BY
    CASE
        WHEN mes_div_4g IS NULL THEN '4G sem data'
        WHEN mes_div_4g <= DATE '2026-07-23' THEN '4G atual'
        WHEN mes_div_4g > DATE '2026-07-23' THEN '4G futuro'
    END
ORDER BY situacao_4g
"""
print(executar_sql_municipios(sql))