MODULES = [
    {
        "key": "mobile_access",
        "name": "Acesso Móvel",
        "description": "Cobertura móvel por município, tecnologia e frequência",
        "url": "/mobile-access/",
        "icon": "bi-broadcast-pin",
        "color": "#1E88E5",
        "enabled": True,
    },
    {
        "key": "traffic",
        "name": "Tráfego",
        "description": "Tráfego planejado × realizado por município, UF e regional",
        "url": "/trafego/",
        "icon": "bi-graph-up",
        "color": "#42C286",
        "enabled": True,
    },
    {
        "key": "transport",
        "name": "Transporte",
        "description": "Backhaul, fibra e capilaridade",
        "url": "/transport/",
        "icon": "bi-diagram-3",
        "color": "#F5C518",
        "enabled": False,
    },
    {
        "key": "orcamento",
        "name": "Orçamento",
        "description": "CAPEX / OPEX e alocação de investimento",
        "url": "/orcamento/",
        "icon": "bi-cash-coin",
        "color": "#E53935",
        "enabled": False,
    },
    {
        "key": "resumo_executivo",
        "name": "Resumo Executivo",
        "description": "Visão consolidada de todos os módulos",
        "url": "/resumo-executivo/",
        "icon": "bi-graph-up-arrow",
        "color": "#003399",
        "enabled": False,
    },
    {
        "key": "base_unica",
        "name": "Base Única",
        "description": "Datasets, dicionário de dados e downloads",
        "url": "/base-unica/",
        "icon": "bi-database",
        "color": "#6C757D",
        "enabled": False,
    },
]


def get_enabled_modules():
    return [m for m in MODULES if m["enabled"]]


def get_module(key):
    return next((m for m in MODULES if m["key"] == key), None)
