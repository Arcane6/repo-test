"""
Service layer do módulo Summary.

3 raias:
    Raia 1 (Fechamento 25): direto do banco
    Raia 2 (Plano 26):      direto do banco
    Raia 3 (Fechamento 26): calculada = Raia 1 + Raia 2 (sem query nova)
"""

import datetime as _dt
import math as _math

from database.oracle import execute_query

from modules.mobile_access.shared.constants import (
    TECH_COLORS, TECH_ORDER, DEFAULT_PLAN_YEAR,
)
from modules.mobile_access.summary.queries import (
    R1_SITES_VENN,
    R1_SITES_VENN_REGION_CLAUSES,
    R1_CITIES_BY_TECH,
    R1_VENDORS,
    R2_NEW_CITIES_BY_ANF,
    R2_VENDORS_NEW_SITES,
    R2_TOP_PROJECTS,
    R2_ORCAMENTO_POR_TECNOLOGIA,
    R2_ENDERECO_POR_TECNOLOGIA,
    R3_TOTAL_CITIES_BY_REGIONAL,
    YEARS_QUERY,
)


# Cores fixas para os principais vendors
VENDOR_COLORS = {
    "NOKIA":     "#124191",
    "ERICSSON":  "#0082F0",
    "HUAWEI":    "#E60012",
    "ZTE":       "#3A67C1",
    "A DEFINIR": "#6c757d",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_list(value):
    if not value:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()]


def _build_in_clause(field, values, prefix, params):
    if not values:
        return ""
    placeholders = []
    for i, v in enumerate(values):
        key = f"{prefix}_{i}"
        params[key] = v
        placeholders.append(f":{key}")
    return f"AND {field} IN ({', '.join(placeholders)})"


def _build_municipio_ibge_clause(field, values, prefix, params):
    """Resolve nome(s) de município pro IBGE via MUNICIPIOS_FECHAMENTO antes
    de filtrar {field} — necessário quando a tabela-alvo guarda o nome do
    município como texto próprio, que pode não bater caractere-a-caractere
    com o nome vindo do autocomplete do filtro (que busca em
    MUNICIPIOS_FECHAMENTO). Comparar direto por texto nesses casos deixava
    o filtro silenciosamente sem casar nada."""
    if not values:
        return ""
    placeholders = []
    for i, v in enumerate(values):
        key = f"{prefix}_{i}"
        params[key] = v
        placeholders.append(f":{key}")
    in_list = ", ".join(placeholders)
    return f"""AND {field} IN (
        SELECT IBGE FROM NTW_OP.MUNICIPIOS_FECHAMENTO
        WHERE TRUNC(DT_CARGA) = (SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO)
        AND MUNICIPIO IN ({in_list})
    )"""


def _build_municipio_end_id_clause(values, prefix, params):
    """Mesma ponte por IBGE acima, mas pra tabelas sem coluna IBGE própria
    (ex.: NTW_MABE.BASE_TB_END_ID_NEW) — resolve via END_ID, identificador
    já usado em outros joins entre BASE_TB_END_ID_NEW e
    TB_FT_BASE_UNICA_SITES (ex.: SITES_VENDORS).

    Usado só na raia Fechamento 25 (get_r1_vendors), então resolve os
    END_IDs no MESMO recorte de mês da raia — o fechamento de dezembro
    (`:baseline_date`, já presente em params quando chamado daqui) — e NÃO
    no MES_REF mais recente. Assim o escopo do filtro de município bate com
    o resto da raia (o Venn de sites por tecnologia também usa dez/25)."""
    if not values:
        return ""
    ibge_clause = _build_municipio_ibge_clause("s.IBGE", values, prefix, params)
    return f"""AND END_ID IN (
        SELECT s.END_ID
        FROM NTW_OP.TB_FT_BASE_UNICA_SITES s
        WHERE TRUNC(s.MES_REF, 'MM') = TRUNC(:baseline_date, 'MM')
        {ibge_clause}
    )"""


def _prepare_params(filters):
    """
    Só devolve o ano_int normalizado.
    Cada função pública injeta APENAS os binds que sua query precisa,
    evitando ORA-01036 (bind sobrando).
    """
    ano = filters.get("ano") or DEFAULT_PLAN_YEAR
    try:
        ano_int = int(ano)
    except (TypeError, ValueError):
        ano_int = DEFAULT_PLAN_YEAR
    return {}, ano_int


import string as _string


def _template_fields(sql_template):
    """Nomes de {placeholders} presentes num template."""
    return {
        name
        for _, name, _, _ in _string.Formatter().parse(sql_template)
        if name
    }


def _apply_geo_all(sql_template, filters, params,
                   uf_field="UF", mun_field="MUNICIPIO",
                   uf_key="uf_filter", mun_key="municipio_filter",
                   regional_field="REGIONAL", regional_key="regional_filter",
                   projeto_field="r.PRIORIDADE", projeto_key="projeto_filter"):
    """
    Injeta filtros (uf/município/regional/projeto) só nos placeholders que
    o template realmente tem — cada visual referencia apenas os campos que
    fazem sentido pra ele.
    """
    fields = _template_fields(sql_template)

    # Só constrói a cláusula (e registra binds) para o placeholder que o
    # template realmente tem — um bind sem placeholder correspondente
    # dispararia ORA-01036.
    spec = {
        uf_key: (uf_field, _normalize_list(filters.get("ufs")), "uf"),
        mun_key: (mun_field, _normalize_list(filters.get("municipios")), "mun"),
        regional_key: (regional_field, _normalize_list(filters.get("regionais")), "reg"),
        projeto_key: (projeto_field, _normalize_list(filters.get("projetos")), "proj"),
    }
    to_fill = {
        key: _build_in_clause(field, values, prefix, params)
        for key, (field, values, prefix) in spec.items()
        if key in fields
    }
    return sql_template.format(**to_fill)


def _tech_bars_payload(row):
    """Formata linha de sites/cidades por tecnologia em barras coloridas."""
    return [
        {"tec": t, "value": row.get(f"cidades_{t.lower()}", row.get(f"sites_{t.lower()}", 0)) or 0,
         "color": TECH_COLORS[t]}
        for t in TECH_ORDER
    ]


def _vendor_payload(rows):
    """Formata rows do vendor em pizza."""
    result = []
    for r in rows:
        name = r.get("vendor", "A DEFINIR") or "A DEFINIR"
        value = r.get("qtd", 0) or 0
        result.append({
            "label": name,
            "value": value,
            "color": VENDOR_COLORS.get(name, "#888888"),
        })
    return result


# ---------------------------------------------------------------------------
# Anos disponíveis (filtro "Ano")
# ---------------------------------------------------------------------------

def get_years():
    """Lista de anos distintos disponíveis no TB_ROLLOUT_ACESSO."""
    result = execute_query(YEARS_QUERY)
    return [int(r["ano"]) for r in result if r.get("ano") is not None]


# ---------------------------------------------------------------------------
# RAIA 1 — Fechamento 25
# ---------------------------------------------------------------------------

VENN_REGION_KEYS = [
    "only_2g", "only_3g", "only_4g", "only_5g",
    "i_23", "i_24", "i_25", "i_34", "i_35", "i_45",
    "i_234", "i_235", "i_245", "i_345", "i_2345",
]


def _build_site_venn_clause(region):
    """Combinação exata de tecnologias (fatia clicada do Venn de 4
    conjuntos). `region` vem de query param — só aceitamos valores do
    whitelist R1_SITES_VENN_REGION_CLAUSES, sem risco de injeção."""
    clause = R1_SITES_VENN_REGION_CLAUSES.get(region or "")
    return f"AND {clause}" if clause else ""


def get_r1_sites_venn(filters):
    """Sites por tecnologia como diagrama de Venn de 4 conjuntos — cada site
    conta uma única vez, na combinação exata de tecnologias que ele tem
    (não por cascata), fonte TB_FT_BASE_UNICA_SITES (mesma regra do
    Power BI anterior: exclui roaming, só site móvel, tec informada).
    Clicar numa fatia filtra o próprio gráfico por aquela combinação exata.

    Recorte de mês = FECHAMENTO de dezembro do ano anterior ao plano
    (baseline_date), não o MES_REF mais recente — esta é a raia Fechamento
    25. (Pegar o MES_REF mais recente é o correto só na aba Sites, que
    mostra o inventário atual.)"""
    params, ano_int = _prepare_params(filters)
    params["baseline_date"] = _dt.date(ano_int - 1, 12, 31)

    venn_clause = _build_site_venn_clause(filters.get("site_venn_region"))
    mun_clause = _build_municipio_ibge_clause(
        "IBGE", _normalize_list(filters.get("municipios")), "mun", params
    )
    template = (
        R1_SITES_VENN
        .replace("{site_venn_filter}", venn_clause)
        .replace("{municipio_filter_site}", mun_clause)
    )

    sql = _apply_geo_all(
        template, filters, params,
        uf_key="uf_filter_site",
        regional_field="g.REGIONAL", regional_key="regional_filter_site",
    )
    row = (execute_query(sql, params) or [{}])[0]
    return {
        "regions": {key: row.get(key, 0) or 0 for key in VENN_REGION_KEYS},
        "total_sites": row.get("total_sites", 0) or 0,
    }


def get_r1_cities_by_tech(filters):
    params, ano_int = _prepare_params(filters)
    params["baseline_date"] = _dt.date(ano_int - 1, 12, 31)

    sql = _apply_geo_all(R1_CITIES_BY_TECH, filters, params)
    row = (execute_query(sql, params) or [{}])[0]
    return {
        "bars": [
            {"tec": t, "value": row.get(f"cidades_{t.lower()}", 0) or 0,
             "color": TECH_COLORS[t]}
            for t in TECH_ORDER
        ],
        "total": row.get("total_municipios", 0) or 0,
    }


def get_r1_vendors(filters):
    params, ano_int = _prepare_params(filters)
    params["baseline_date"] = _dt.date(ano_int - 1, 12, 31)

    mun_clause = _build_municipio_end_id_clause(
        _normalize_list(filters.get("municipios")), "mun", params
    )
    template = R1_VENDORS.replace("{municipio_filter}", mun_clause)

    sql = _apply_geo_all(template, filters, params, regional_field="g.REGIONAL")
    rows = execute_query(sql, params) or []
    return _vendor_payload(rows)


# ---------------------------------------------------------------------------
# RAIA 2 — Plano 26
# ---------------------------------------------------------------------------

def get_r2_new_cities_by_anf(filters):
    """
    Novas cidades por REGIONAL (TNE, TCN, TSP, etc.).
    Nome de função mantido pra não quebrar rota, mas agora usa REGIONAL.
    """
    params, ano_int = _prepare_params(filters)
    params["plan_start"] = _dt.date(ano_int, 1, 1)
    params["plan_end"]   = _dt.date(ano_int, 12, 31)

    sql = _apply_geo_all(R2_NEW_CITIES_BY_ANF, filters, params)
    rows = execute_query(sql, params) or []
    total = sum((r.get("cidades", 0) or 0) for r in rows)
    return {
        "slices": [
            {"label": r["agrupador"] or "N/D", "value": r.get("cidades", 0) or 0}
            for r in rows
        ],
        "total": total,
    }


def get_r2_vendors_new_sites(filters):
    """
    Fornecedores do plano com breakdown por tipo de casa.

    Categorias possíveis:
        - "A Contratar (Casa Nova)"    → sites novos, sem vendor definido
        - "HUAWEI (Existente)"          → casa existente com vendor dominante
        - "NOKIA (Existente)"
        - "ERICSSON (Existente)"
        - "ZTE (Existente)"
        - "Sem info (Existente)"        → casa existente em município sem sites cadastrados
    """
    params, ano_int = _prepare_params(filters)
    params["ano"] = ano_int

    sql = _apply_geo_all(
        R2_VENDORS_NEW_SITES, filters, params,
        uf_field="d.UF", mun_field="d.MUNICIPIO",
        uf_key="uf_filter_d", mun_key="municipio_filter_d",
        regional_field="d.REGIONAL", regional_key="regional_filter_d",
    )
    rows = execute_query(sql, params) or []

    # Cores contextualizadas por tipo/vendor
    VENDOR_COLORS_PLAN = {
        "A CONTRATAR (CASA NOVA)":  "#26C281",   # verde vibrante
        "HUAWEI (EXISTENTE)":       "#E60012",   # vermelho Huawei
        "ERICSSON (EXISTENTE)":     "#0082F0",   # azul Ericsson
        "NOKIA (EXISTENTE)":        "#124191",   # azul Nokia
        "ZTE (EXISTENTE)":          "#3A67C1",   # azul ZTE
        "SEM INFO (EXISTENTE)":     "#adb5bd",   # cinza claro
    }

    result = []
    for r in rows:
        name = r.get("vendor", "Sem info") or "Sem info"
        value = r.get("qtd", 0) or 0
        color = VENDOR_COLORS_PLAN.get(name.upper(), "#888888")
        result.append({"label": name, "value": value, "color": color})
    return result

def get_r2_top_projects(filters):
    params, ano_int = _prepare_params(filters)
    params["ano"] = ano_int

    sql = _apply_geo_all(
        R2_TOP_PROJECTS, filters, params,
        uf_field="d.UF", mun_field="d.MUNICIPIO",
        uf_key="uf_filter_d", mun_key="municipio_filter_d",
        regional_field="d.REGIONAL", regional_key="regional_filter_d",
    )
    rows = execute_query(sql, params) or []
    return [
        {"projeto": r["prioridade"], "value": r.get("qtd", 0) or 0}
        for r in rows
    ]


# ---------------------------------------------------------------------------
# RAIA 2 — Financeiro (NEXUS)
# ---------------------------------------------------------------------------

def get_r2_orcamento_por_tecnologia(filters):
    """CAPEX vs OPEX/LEASE do plano, rateado por OC e quebrado por
    tecnologia (4G/5G) — fonte TB_NEXUS_FINANCEIRO."""
    params, ano_int = _prepare_params(filters)
    params["ano"] = ano_int

    sql = _apply_geo_all(
        R2_ORCAMENTO_POR_TECNOLOGIA, filters, params,
        uf_field="g.UF", mun_field="g.MUNICIPIO",
        uf_key="uf_filter_g", mun_key="municipio_filter_g",
        regional_field="g.REGIONAL", regional_key="regional_filter_g",
        projeto_field="R.PRIORIDADE",
    )
    rows = execute_query(sql, params) or []

    techs = ["4G", "5G"]
    grupos = ["CAPEX", "OPEX/LEASE"]
    by_key = {(r["tech"], r["grupo"]): r.get("valor", 0) or 0 for r in rows}

    return {
        "categories": techs,
        "series": [
            {
                "name": grupo,
                "color": "#003399" if grupo == "CAPEX" else "#7DC242",
                "data": [round(by_key.get((t, grupo), 0), 2) for t in techs],
            }
            for grupo in grupos
        ],
        "total": round(sum(by_key.values()), 2),
    }


def get_r2_endereco_por_tecnologia(filters):
    """CAC (custo de aquisição) rateado por OC entre Casa Nova e Casa
    Existente, por tecnologia — fonte TB_NEXUS_CN_CE."""
    params, ano_int = _prepare_params(filters)
    params["ano"] = ano_int

    sql = _apply_geo_all(
        R2_ENDERECO_POR_TECNOLOGIA, filters, params,
        uf_field="g.UF", mun_field="g.MUNICIPIO",
        uf_key="uf_filter_g", mun_key="municipio_filter_g",
        regional_field="g.REGIONAL", regional_key="regional_filter_g",
        projeto_field="RR.PRIORIDADE",
    )
    rows = execute_query(sql, params) or []

    techs = ["4G", "5G"]
    classificacoes = ["CN", "CE"]
    by_key = {(r["tech"], r["classificacao"]): r.get("valor", 0) or 0 for r in rows}

    # Arredonda pra cima (não pra 2 casas): o rateio proporcional dá valor
    # fracionário (ex.: 0.47 endereço), mas quando filtramos um recorte
    # pequeno (um município) isso não faz sentido de exibir — "0,47
    # endereço" não é uma métrica que bate. O total soma os mesmos valores
    # já arredondados exibidos nas barras, não o bruto, senão total e
    # barras não batem entre si.
    data_by_cell = {
        (t, c): _math.ceil(by_key.get((t, c), 0))
        for t in techs
        for c in classificacoes
    }

    return {
        "categories": classificacoes,
        "series": [
            {
                "name": t,
                "color": TECH_COLORS[t],
                "data": [data_by_cell[(t, c)] for c in classificacoes],
            }
            for t in techs
        ],
        "total": sum(data_by_cell.values()),
    }


# ---------------------------------------------------------------------------
# RAIA 3 — Fechamento 26 = Raia 1 + Raia 2 (composição)
# ---------------------------------------------------------------------------

def get_r3_new_cities_by_anf(filters):
    """
    Fechamento 26 por regional, com breakdown de Base 25 + Ganho 26.

    Retorno:
        {
          "series": [
            {"name": "Base 25",  "color": "#adb5bd", "data": [...]},
            {"name": "Ganho 26", "color": "#7DC242", "data": [...]}
          ],
          "categories": ["TSP", "TNE", "TSL", ...],
          "total_base": int,
          "total_ganho": int,
          "total": int
        }
    """
    params, ano_int = _prepare_params(filters)
    params["baseline_date"] = _dt.date(ano_int - 1, 12, 31)
    params["plan_start"]    = _dt.date(ano_int, 1, 1)
    params["plan_end"]      = _dt.date(ano_int, 12, 31)

    sql = _apply_geo_all(R3_TOTAL_CITIES_BY_REGIONAL, filters, params)
    rows = execute_query(sql, params) or []

    categories = [r["agrupador"] or "N/D" for r in rows]
    base_data = [r.get("base_25", 0) or 0 for r in rows]
    ganho_data = [r.get("ganho_26", 0) or 0 for r in rows]

    return {
        "categories": categories,
        "series": [
            {"name": "Base 25",  "color": "#adb5bd", "data": base_data},
            {"name": "Ganho 26", "color": "#7DC242", "data": ganho_data},
        ],
        "total_base": sum(base_data),
        "total_ganho": sum(ganho_data),
        "total": sum(base_data) + sum(ganho_data),
    }


def get_r3_vendors(filters):
    """
    Fornecedores EoY 26 — só sites físicos reais.

    Fontes:
      - Base 25 (sites físicos existentes): r1_vendors — traz vendors HUAWEI/ERICSSON/NOKIA/ZTE
      - Plano 26 Casa Nova: entra como "A Contratar (Casa Nova)"

    NÃO inclui upgrades de Casa Existente porque eles NÃO criam site novo —
    apenas adicionam tec num site que já foi contado na Base 25 (que já
    tem seu vendor).
    """
    r1 = get_r1_vendors(filters)  # sites físicos existentes
    r2 = get_r2_vendors_new_sites(filters)  # OCs do plano

    # Do plano, pega SÓ "Casa Nova" — o resto (Existente) já está na Base 25
    casa_nova_total = 0
    for item in r2:
        raw = (item.get("label") or "").upper()
        if "CASA NOVA" in raw:
            casa_nova_total += item.get("value", 0)

    # Cores contextualizadas
    COLORS = {
        "HUAWEI (Base 25)":     "#B00010",
        "ERICSSON (Base 25)":   "#005DC0",
        "NOKIA (Base 25)":      "#0D2F70",
        "ZTE (Base 25)":        "#2A4E9E",
        "A DEFINIR (Base 25)":  "#6c757d",
        "A Contratar (Plano 26)": "#26C281",
    }

    # Base 25 com sufixo
    result = []
    for item in r1:
        label = f"{item['label']} (Base 25)"
        result.append({
            "label": label,
            "value": item["value"],
            "color": COLORS.get(label, "#666"),
        })

    # Adiciona só a Casa Nova do plano
    if casa_nova_total > 0:
        result.append({
            "label": "A Contratar (Plano 26)",
            "value": casa_nova_total,
            "color": COLORS["A Contratar (Plano 26)"],
        })

    # Ordena por valor desc
    result.sort(key=lambda x: x["value"], reverse=True)
    return result


def get_r3_top_projects(filters):
    """Top 10 projetos do plano é o mesmo — ele não é acumulativo."""
    return get_r2_top_projects(filters)