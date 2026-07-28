DICIONARIO_MUNICIPIOS = {
    2: {
        "nome": "ibge",
        "descricao": "Código IBGE do município, usado como chave primária para identificação.",
        "tipo_esperado": "inteiro",
    },
    3: {
        "nome": "regional",
        "descricao": "Regional TIM à qual pertence o município.",
        "tipo_esperado": "texto",
    },
    4: {
        "nome": "uf",
        "descricao": "Unidade Federativa, Estado ao qual pertence o município.",
        "tipo_esperado": "texto",
    },
    5: {
        "nome": "municipio",
        "descricao": "Nome do município.",
        "tipo_esperado": "texto",
    },
    7: {
        "nome": "anf",
        "descricao": "Área de Numeração Fechada, DDD ao qual pertence o município.",
        "tipo_esperado": "inteiro",
    },
    8: {
        "nome": "populacao_urbana",
        "descricao": "População urbana considerada para o município.",
        "tipo_esperado": "numero",
    },
    9: {
        "nome": "populacao_total",
        "descricao": "População total considerada para o município.",
        "tipo_esperado": "numero",
    },
    11: {
    "nome": "presenca",
    "descricao": "Indicador de presença TIM no município, considerando qualquer tecnologia. Valores: 1 = presente/atendido; 0 = não presente/não atendido.",
    "tipo_esperado": "indicador",
    },
    12: {
        "nome": "presenca_5g",
        "descricao": "Indicador de presença TIM 5G no município. Valores: 1 = atende com 5G; 0 = não atende com 5G.",
        "tipo_esperado": "indicador",
    },
    13: {
        "nome": "presenca_4g",
        "descricao": "Indicador de presença TIM 4G no município, também chamada de LTE. Valores: 1 = atende com 4G/LTE; 0 = não atende com 4G/LTE.",
        "tipo_esperado": "indicador",
    },
    14: {
        "nome": "presenca_3g",
        "descricao": "Indicador de presença TIM 3G no município, também chamada de UMTS ou WCDMA. Valores: 1 = atende com 3G; 0 = não atende com 3G.",
        "tipo_esperado": "indicador",
    },
    15: {
        "nome": "presenca_2g",
        "descricao": "Indicador de presença TIM 2G no município, também chamada de GSM. Valores: 1 = atende com 2G/GSM; 0 = não atende com 2G/GSM.",
        "tipo_esperado": "indicador",
    },
    17: {
        "nome": "status_presenca",
        "descricao": "Status atual da presença da TIM no município, considerando qualquer tecnologia.",
        "tipo_esperado": "texto",
    },
    18: {
        "nome": "mes_div_presenca",
        "descricao": "Data de divulgação da presença da TIM no município, considerando qualquer tecnologia.",
        "tipo_esperado": "data",
    },
    20: {
        "nome": "status_5g",
        "descricao": "Status atual da presença no município com tecnologia 5G.",
        "tipo_esperado": "texto",
        "tecnologia": "5G",
    },
    21: {
        "nome": "banda_5g_mhz",
        "descricao": "Banda ou frequência de atendimento da tecnologia 5G no município. Pode conter uma ou mais bandas/frequências. Para filtrar uma frequência específica, use busca parcial segura, não igualdade exata.",
        "tipo_esperado": "texto_multivalor",
        "tecnologia": "5G",
    },
    22: {
        "nome": "mes_div_5g",
        "descricao": "Data de divulgação da presença no município com tecnologia 5G.",
        "tipo_esperado": "data",
        "tecnologia": "5G",
    },
    23: {
        "nome": "cobertura_5g_100_bairros",
        "descricao": "Status atual da presença de 5G em todos os bairros do município.",
        "tipo_esperado": "texto",
        "tecnologia": "5G",
    },
    24: {
        "nome": "mes_div_100_bairros_5g",
        "descricao": "Data da divulgação da presença de 5G em todos os bairros do município.",
        "tipo_esperado": "data",
        "tecnologia": "5G",
    },
    26: {
        "nome": "status_4g",
        "descricao": "Status atual da presença no município com tecnologia 4G.",
        "tipo_esperado": "texto",
        "tecnologia": "4G",
    },
    27: {
        "nome": "banda_4g_mhz",
        "descricao": "Banda ou frequência de atendimento da tecnologia 4G no município. Pode conter uma ou mais bandas/frequências. Para filtrar uma frequência específica, use busca parcial segura, não igualdade exata.",
        "tipo_esperado": "texto_multivalor",
        "tecnologia": "4G",
    },
    28: {
        "nome": "mes_div_4g",
        "descricao": "Data de divulgação da presença no município com tecnologia 4G.",
        "tipo_esperado": "data",
        "tecnologia": "4G",
    },
    29: {
        "nome": "mes_div_700mhz",
        "descricao": "Data de divulgação da presença no município com tecnologia 4G em 700 MHz.",
        "tipo_esperado": "data",
        "tecnologia": "4G",
    },
    30: {
        "nome": "mes_div_low_freq_700_850mhz",
        "descricao": "Data de divulgação da presença no município com tecnologia 4G em baixas frequências, 700 ou 850 MHz.",
        "tipo_esperado": "data",
        "tecnologia": "4G",
    },
    31: {
        "nome": "volte",
        "descricao": "Data de divulgação da presença no município com tecnologia 4G VoLTE.",
        "tipo_esperado": "data",
        "tecnologia": "4G",
    },
    32: {
        "nome": "carrier_aggregation",
        "descricao": "Data de divulgação da presença no município com tecnologia 4G Carrier Aggregation.",
        "tipo_esperado": "data",
        "tecnologia": "4G",
    },
    33: {
        "nome": "nb_iot",
        "descricao": "Data de divulgação da presença no município com tecnologia NB-IoT.",
        "tipo_esperado": "data",
        "tecnologia": "NB-IoT",
    },
    34: {
        "nome": "wttx",
        "descricao": "Status atual da presença no município com tecnologia 4G WTTX.",
        "tipo_esperado": "texto",
        "tecnologia": "4G",
    },
    36: {
        "nome": "status_3g",
        "descricao": "Status atual da presença no município com tecnologia 3G.",
        "tipo_esperado": "texto",
        "tecnologia": "3G",
    },
    37: {
        "nome": "banda_3g_mhz",
        "descricao": "Banda ou frequência de atendimento da tecnologia 3G no município. Pode conter uma ou mais bandas/frequências. Para filtrar uma frequência específica, use busca parcial segura, não igualdade exata.",
        "tipo_esperado": "texto_multivalor",
        "tecnologia": "3G",
    },
    38: {
        "nome": "mes_div_3g",
        "descricao": "Data de divulgação da presença no município com tecnologia 3G.",
        "tipo_esperado": "data",
        "tecnologia": "3G",
    },
    40: {
        "nome": "status_2g",
        "descricao": "Status atual da presença no município com tecnologia 2G.",
        "tipo_esperado": "texto",
        "tecnologia": "2G",
    },
    41: {
        "nome": "banda_2g_mhz",
        "descricao": "Banda ou frequência de atendimento da tecnologia 2G no município. Pode conter uma ou mais bandas/frequências. Para filtrar uma frequência específica, use busca parcial segura, não igualdade exata.",
        "tipo_esperado": "texto_multivalor",
        "tecnologia": "2G",
    },
    42: {
        "nome": "mes_div_2g",
        "descricao": "Data de divulgação da presença no município com tecnologia 2G.",
        "tipo_esperado": "data",
        "tecnologia": "2G",
    },
    44: {
        "nome": "latitude_municipio",
        "descricao": "Latitude considerada para o município em graus decimais.",
        "tipo_esperado": "numero",
    },
    45: {
        "nome": "longitude_municipio",
        "descricao": "Longitude considerada para o município em graus decimais.",
        "tipo_esperado": "numero",
    },
    56: {
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