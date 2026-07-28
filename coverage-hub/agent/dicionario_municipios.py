"""
Dicionário de colunas da base de municípios do agente — fonte real é
NTW_OP.MUNICIPIOS_FECHAMENTO (Oracle), não mais um Excel. Antes cada campo
era localizado por posição de coluna do Excel (a planilha era um export
direto dessa mesma tabela); agora a chave é o nome real da coluna Oracle,
o que elimina a fragilidade de "se a posição da coluna no Excel mudar,
tudo quebra".
"""

COLUNAS_MUNICIPIOS = {
    "IBGE": {
        "nome": "ibge",
        "descricao": "Código IBGE do município, usado como chave primária para identificação.",
        "tipo_esperado": "inteiro",
    },
    "REGIONAL": {
        "nome": "regional",
        "descricao": "Regional TIM à qual pertence o município.",
        "tipo_esperado": "texto",
    },
    "UF": {
        "nome": "uf",
        "descricao": "Unidade Federativa, Estado ao qual pertence o município.",
        "tipo_esperado": "texto",
    },
    "MUNICIPIO": {
        "nome": "municipio",
        "descricao": "Nome do município.",
        "tipo_esperado": "texto",
    },
    "ANF": {
        "nome": "anf",
        "descricao": "Área de Numeração Fechada, DDD ao qual pertence o município.",
        "tipo_esperado": "texto",
    },
    "POPULACAO_URBANA": {
        "nome": "populacao_urbana",
        "descricao": "População urbana considerada para o município.",
        "tipo_esperado": "numero",
    },
    "POPULACAO_TOTAL": {
        "nome": "populacao_total",
        "descricao": "População total considerada para o município.",
        "tipo_esperado": "numero",
    },
    "PRESENCA": {
        "nome": "presenca",
        "descricao": "Indicador de presença TIM no município, considerando qualquer tecnologia. Valores: 1 = presente/atendido; 0 = não presente/não atendido. Recalculado a partir das datas de divulgação por tecnologia, não é a flag crua da tabela — ver regra de presença atual.",
        "tipo_esperado": "indicador",
    },
    "PRESENCA_5G": {
        "nome": "presenca_5g",
        "descricao": "Indicador de presença TIM 5G no município. Valores: 1 = atende com 5G; 0 = não atende com 5G. Recalculado a partir de mes_div_5g <= hoje.",
        "tipo_esperado": "indicador",
    },
    "PRESENCA_4G": {
        "nome": "presenca_4g",
        "descricao": "Indicador de presença TIM 4G no município, também chamada de LTE. Valores: 1 = atende com 4G/LTE; 0 = não atende com 4G/LTE. Recalculado a partir de mes_div_4g <= hoje.",
        "tipo_esperado": "indicador",
    },
    "PRESENCA_3G": {
        "nome": "presenca_3g",
        "descricao": "Indicador de presença TIM 3G no município, também chamada de UMTS ou WCDMA. Valores: 1 = atende com 3G; 0 = não atende com 3G. Recalculado a partir de mes_div_3g <= hoje.",
        "tipo_esperado": "indicador",
    },
    "PRESENCA_2G": {
        "nome": "presenca_2g",
        "descricao": "Indicador de presença TIM 2G no município, também chamada de GSM. Valores: 1 = atende com 2G/GSM; 0 = não atende com 2G/GSM. Recalculado a partir de mes_div_2g <= hoje.",
        "tipo_esperado": "indicador",
    },
    "STATUS_PRESENCA": {
        "nome": "status_presenca",
        "descricao": "Status atual da presença da TIM no município, considerando qualquer tecnologia.",
        "tipo_esperado": "texto",
    },
    "MES_DIV_PRESENCA": {
        "nome": "mes_div_presenca",
        "descricao": "Data de divulgação da presença da TIM no município, considerando qualquer tecnologia.",
        "tipo_esperado": "data",
    },
    "STATUS_5G": {
        "nome": "status_5g",
        "descricao": "Status atual da presença no município com tecnologia 5G.",
        "tipo_esperado": "texto",
        "tecnologia": "5G",
    },
    "BANDA_5G_MHZ": {
        "nome": "banda_5g_mhz",
        "descricao": "Banda ou frequência de atendimento da tecnologia 5G no município. Pode conter uma ou mais bandas/frequências. Para filtrar uma frequência específica, use busca parcial segura, não igualdade exata.",
        "tipo_esperado": "texto_multivalor",
        "tecnologia": "5G",
    },
    "MES_DIV_5G": {
        "nome": "mes_div_5g",
        "descricao": "Data de divulgação da presença no município com tecnologia 5G. Municípios do plano de lançamento 5G ainda sem data real recebem 31/dez do ano do plano corrente (ver regra de planejamento 5G).",
        "tipo_esperado": "data",
        "tecnologia": "5G",
    },
    "COBERTURA_5G_100_BAIRROS": {
        "nome": "cobertura_5g_100_bairros",
        "descricao": "Status atual da presença de 5G em todos os bairros do município.",
        "tipo_esperado": "texto",
        "tecnologia": "5G",
    },
    "MES_DIV_100_BAIRROS_5G": {
        "nome": "mes_div_100_bairros_5g",
        "descricao": "Data da divulgação da presença de 5G em todos os bairros do município.",
        "tipo_esperado": "data",
        "tecnologia": "5G",
    },
    "STATUS_4G": {
        "nome": "status_4g",
        "descricao": "Status atual da presença no município com tecnologia 4G.",
        "tipo_esperado": "texto",
        "tecnologia": "4G",
    },
    "BANDA_4G_MHZ": {
        "nome": "banda_4g_mhz",
        "descricao": "Banda ou frequência de atendimento da tecnologia 4G no município. Pode conter uma ou mais bandas/frequências. Para filtrar uma frequência específica, use busca parcial segura, não igualdade exata.",
        "tipo_esperado": "texto_multivalor",
        "tecnologia": "4G",
    },
    "MES_DIV_4G": {
        "nome": "mes_div_4g",
        "descricao": "Data de divulgação da presença no município com tecnologia 4G.",
        "tipo_esperado": "data",
        "tecnologia": "4G",
    },
    "MES_DIV_700MHZ": {
        "nome": "mes_div_700mhz",
        "descricao": "Data de divulgação da presença no município com tecnologia 4G em 700 MHz.",
        "tipo_esperado": "data",
        "tecnologia": "4G",
    },
    "MES_DIV_LOW_FREQ_700_850MHZ": {
        "nome": "mes_div_low_freq_700_850mhz",
        "descricao": "Data de divulgação da presença no município com tecnologia 4G em baixas frequências, 700 ou 850 MHz.",
        "tipo_esperado": "data",
        "tecnologia": "4G",
    },
    "VOLTE": {
        "nome": "volte",
        "descricao": "Data de divulgação da presença no município com tecnologia 4G VoLTE.",
        "tipo_esperado": "data",
        "tecnologia": "4G",
    },
    "CARRIER_AGGREGATION": {
        "nome": "carrier_aggregation",
        "descricao": "Data de divulgação da presença no município com tecnologia 4G Carrier Aggregation.",
        "tipo_esperado": "data",
        "tecnologia": "4G",
    },
    "NB_IOT": {
        "nome": "nb_iot",
        "descricao": "Data de divulgação da presença no município com tecnologia NB-IoT.",
        "tipo_esperado": "data",
        "tecnologia": "NB-IoT",
    },
    "WTTX": {
        "nome": "wttx",
        "descricao": "Status atual da presença no município com tecnologia 4G WTTX.",
        "tipo_esperado": "texto",
        "tecnologia": "4G",
    },
    "STATUS_3G": {
        "nome": "status_3g",
        "descricao": "Status atual da presença no município com tecnologia 3G.",
        "tipo_esperado": "texto",
        "tecnologia": "3G",
    },
    "BANDA_3G_MHZ": {
        "nome": "banda_3g_mhz",
        "descricao": "Banda ou frequência de atendimento da tecnologia 3G no município. Pode conter uma ou mais bandas/frequências. Para filtrar uma frequência específica, use busca parcial segura, não igualdade exata.",
        "tipo_esperado": "texto_multivalor",
        "tecnologia": "3G",
    },
    "MES_DIV_3G": {
        "nome": "mes_div_3g",
        "descricao": "Data de divulgação da presença no município com tecnologia 3G.",
        "tipo_esperado": "data",
        "tecnologia": "3G",
    },
    "STATUS_2G": {
        "nome": "status_2g",
        "descricao": "Status atual da presença no município com tecnologia 2G.",
        "tipo_esperado": "texto",
        "tecnologia": "2G",
    },
    "BANDA_2G_MHZ": {
        "nome": "banda_2g_mhz",
        "descricao": "Banda ou frequência de atendimento da tecnologia 2G no município. Pode conter uma ou mais bandas/frequências. Para filtrar uma frequência específica, use busca parcial segura, não igualdade exata.",
        "tipo_esperado": "texto_multivalor",
        "tecnologia": "2G",
    },
    "MES_DIV_2G": {
        "nome": "mes_div_2g",
        "descricao": "Data de divulgação da presença no município com tecnologia 2G.",
        "tipo_esperado": "data",
        "tecnologia": "2G",
    },
    "LATITUDE_MUNICIPIO": {
        "nome": "latitude_municipio",
        "descricao": "Latitude considerada para o município em graus decimais.",
        "tipo_esperado": "numero",
    },
    "LONGITUDE_MUNICIPIO": {
        "nome": "longitude_municipio",
        "descricao": "Longitude considerada para o município em graus decimais.",
        "tipo_esperado": "numero",
    },
    "COBERTURA_5G_POP_URBANA": {
        "nome": "cobertura_5g_pop_urbana",
        "descricao": "Percentual da população urbana do município coberta por 5G.",
        "tipo_esperado": "numero",
        "tecnologia": "5G",
    },
    "COBERTURA_4G_POP_URBANA": {
        "nome": "cobertura_4g_pop_urbana",
        "descricao": "Percentual da população urbana do município coberta por 4G.",
        "tipo_esperado": "numero",
        "tecnologia": "4G",
    },
    "COBERTURA_3G_POP_URBANA": {
        "nome": "cobertura_3g_pop_urbana",
        "descricao": "Percentual da população urbana do município coberta por 3G.",
        "tipo_esperado": "numero",
        "tecnologia": "3G",
    },
    "COBERTURA_2G_POP_URBANA": {
        "nome": "cobertura_2g_pop_urbana",
        "descricao": "Percentual da população urbana do município coberta por 2G.",
        "tipo_esperado": "numero",
        "tecnologia": "2G",
    },
    "COBERTURA_5G_POP_TOTAL": {
        "nome": "cobertura_5g_pop_total",
        "descricao": "Percentual da população total do município coberta por 5G.",
        "tipo_esperado": "numero",
        "tecnologia": "5G",
    },
    "COBERTURA_4G_POP_TOTAL": {
        "nome": "cobertura_4g_pop_total",
        "descricao": "Percentual da população total do município coberta por 4G.",
        "tipo_esperado": "numero",
        "tecnologia": "4G",
    },
    "COBERTURA_3G_POP_TOTAL": {
        "nome": "cobertura_3g_pop_total",
        "descricao": "Percentual da população total do município coberta por 3G.",
        "tipo_esperado": "numero",
        "tecnologia": "3G",
    },
    "COBERTURA_2G_POP_TOTAL": {
        "nome": "cobertura_2g_pop_total",
        "descricao": "Percentual da população total do município coberta por 2G.",
        "tipo_esperado": "numero",
        "tecnologia": "2G",
    },
    "PROJETO": {
        "nome": "projeto",
        "descricao": "Nome do projeto de lançamento do município.",
        "tipo_esperado": "texto",
    },
}


SINONIMOS_TECNOLOGIA = {
    "2g": "2G",
    "gsm": "2G",

    "3g": "3G",
    "umts": "3G",
    "wcdma": "3G",

    "4g": "4G",
    "lte": "4G",

    "5g": "5G",
    "nr": "5G",

    "nb": "NB-IoT",
    "nb-iot": "NB-IoT",
    "nbiot": "NB-IoT",
}
