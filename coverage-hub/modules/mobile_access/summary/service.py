"""
Service layer do módulo Summary.

3 raias:
    Raia 1 (Fechamento 25): direto do banco
    Raia 2 (Plano 26):      direto do banco
    Raia 3 (Fechamento 26): calculada = Raia 1 + Raia 2 (sem query nova)
"""

import datetime as _dt

from database.oracle import execute_query

from modules.mobile_access.shared.constants import (
    TECH_COLORS, TECH_ORDER, DEFAULT_PLAN_YEAR,
)
from modules.mobile_access.summary.queries import (
    R1_SITES_BY_TECH,
    R1_CITIES_BY_TECH,
    R1_VENDORS,
    R2_SITES_BY_TECH,
    R2_NEW_CITIES_BY_ANF,
    R2_VENDORS_NEW_SITES,
    R2_TOP_PROJECTS,
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


def _apply_geo_all(sql_template, filters, params,
                    uf_field="UF", mun_field="MUNICIPIO",
                    uf_key="uf_filter", mun_key="municipio_filter"):
    """Injeta filtros geográficos genéricos num template."""
    ufs = _normalize_list(filters.get("ufs"))
    muns = _normalize_list(filters.get("municipios"))
    uf_clause = _build_in_clause(uf_field, ufs, "uf", params)
    mun_clause = _build_in_clause(mun_field, muns, "mun", params)
    return sql_template.format(**{uf_key: uf_clause, mun_key: mun_clause})


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

def get_r1_sites_by_tech(filters):
    params, ano_int = _prepare_params(filters)
    params["baseline_date"] = _dt.date(ano_int - 1, 12, 31)

    sql = _apply_geo_all(
        R1_SITES_BY_TECH, filters, params,
        uf_key="uf_filter_site", mun_key="municipio_filter_site",
    )
    row = (execute_query(sql, params) or [{}])[0]
    return {
        "bars": [
            {"tec": t, "value": row.get(f"sites_{t.lower()}", 0) or 0,
             "color": TECH_COLORS[t]}
            for t in TECH_ORDER
        ],
        "total": row.get("total_sites", 0) or 0,
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

    sql = _apply_geo_all(R1_VENDORS, filters, params)
    rows = execute_query(sql, params) or []
    return _vendor_payload(rows)


# ---------------------------------------------------------------------------
# RAIA 2 — Plano 26
# ---------------------------------------------------------------------------

def get_r2_sites_by_tech(filters):
    params, ano_int = _prepare_params(filters)
    params["ano"] = ano_int

    sql = _apply_geo_all(
        R2_SITES_BY_TECH, filters, params,
        uf_field="d.UF", mun_field="d.MUNICIPIO",
        uf_key="uf_filter_d", mun_key="municipio_filter_d",
    )
    row = (execute_query(sql, params) or [{}])[0]

    return {
        "categories": TECH_ORDER,  # ["2G","3G","4G","5G"]
        "series": [
            {
                "name": "Casa Nova",
                "color": "#7DC242",  # verde
                "data": [row.get(f"nova_{t.lower()}", 0) or 0 for t in TECH_ORDER],
            },
            {
                "name": "Casa Existente",
                "color": "#003399",  # azul TIM
                "data": [row.get(f"existente_{t.lower()}", 0) or 0 for t in TECH_ORDER],
            },
        ],
        "total": row.get("total_sites", 0) or 0,
    }


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
    )
    rows = execute_query(sql, params) or []
    return [
        {"projeto": r["prioridade"], "value": r.get("qtd", 0) or 0}
        for r in rows
    ]


# ---------------------------------------------------------------------------
# RAIA 3 — Fechamento 26 = Raia 1 + Raia 2 (composição)
# ---------------------------------------------------------------------------

def _sum_bars(bars_a, bars_b):
    """Soma valores das mesmas tecnologias em duas listas de barras."""
    map_a = {b["tec"]: b for b in bars_a}
    map_b = {b["tec"]: b for b in bars_b}
    result = []
    for tec in TECH_ORDER:
        va = map_a.get(tec, {}).get("value", 0)
        vb = map_b.get(tec, {}).get("value", 0)
        result.append({
            "tec": tec,
            "value": va + vb,
            "color": TECH_COLORS[tec],
        })
    return result


def _sum_vendors(a, b):
    """Soma contagens por vendor. Retorna ordenado."""
    acc = {}
    for item in a + b:
        label = item["label"]
        acc[label] = acc.get(label, 0) + item["value"]
    result = [
        {"label": k, "value": v, "color": VENDOR_COLORS.get(k, "#888888")}
        for k, v in acc.items()
    ]
    result.sort(key=lambda x: x["value"], reverse=True)
    return result


def get_r3_sites_by_tech(filters):
    """
    Sites físicos no fechamento EoY 26.

    IMPORTANTE — Regra conceitual:
        - Base 25   = sites físicos EXISTENTES (tec ativas em cada um)
        - Casa Nova = sites físicos NOVOS a serem construídos (só esses somam!)
        - Casa Existente NÃO ENTRA aqui porque é upgrade tecnológico
          (adiciona tec num site que já existe — não soma unidade nova).

    O card gráfico mostra as 3 séries pra dar visibilidade, MAS a soma real
    do "total de sites físicos EoY 26" = Base 25 + Casa Nova.
    """
    r1 = get_r1_sites_by_tech(filters)      # baseline por tec (sites reais)
    r2 = get_r2_sites_by_tech(filters)      # plano stacked (nova + existente)

    # Extrai só a série "Casa Nova" do plano
    casa_nova_series = next(
        (s for s in r2["series"] if s["name"] == "Casa Nova"),
        {"name": "Casa Nova", "color": "#26C281", "data": [0, 0, 0, 0]},
    )
    casa_existente_series = next(
        (s for s in r2["series"] if s["name"] == "Casa Existente"),
        {"name": "Casa Existente", "color": "#1565C0", "data": [0, 0, 0, 0]},
    )

    # Base 25 (renomeada pra clareza)
    base_series = {
        "name": "Base 25",
        "color": "#B0BEC5",
        "data": [b["value"] for b in r1["bars"]],
    }

    # Total físico = Base 25 + Casa Nova (Casa Existente NÃO soma)
    total_fisico = (
        sum(base_series["data"])
        + sum(casa_nova_series["data"])
    )

    return {
        "categories": TECH_ORDER,
        "series": [
            base_series,
            casa_nova_series,
            {
                # Upgrades entram como série informativa, mas NÃO soma no total
                "name": "Upgrade (Casa Existente)",
                "color": "#dee2e6",
                "data": casa_existente_series["data"],
                "is_info_only": True,  # flag pro frontend não somar
            },
        ],
        "total": total_fisico,
        # Total inflado (com upgrade) fica separado pra caso queira exibir
        "total_com_upgrades": r1["total"] + r2["total"],
    }


def get_r3_cities_by_tech(filters):
    """Cidades no fechamento 26 = quem já tinha + quem vai receber pelo plano."""
    r1 = get_r1_cities_by_tech(filters)
    # Cuidado: cidades não podem duplicar. Se uma cidade "vira 5G" no plano,
    # ela sai de 0 pra 1. Precisamos usar a mesma lógica da aba Consolidado.
    # Aqui simplificamos: R2 traz APENAS os deltas (novas cidades), R1 tem baseline.
    # A soma direta funciona porque não há sobreposição semântica.
    r2_new_5g = get_r2_new_cities_by_anf(filters)["total"]

    bars = list(r1["bars"])
    for b in bars:
        if b["tec"] == "5G":
            b["value"] = (b["value"] or 0) + r2_new_5g
    return {"bars": bars, "total": r1["total"]}


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