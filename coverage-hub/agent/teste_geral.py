try:
    from .excel_municipios import calcular_score_oportunidade_5g
except ImportError:
    from excel_municipios import calcular_score_oportunidade_5g


print(calcular_score_oportunidade_5g(uf="PR", limite=20))