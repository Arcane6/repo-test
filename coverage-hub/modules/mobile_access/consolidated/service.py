"""
Service layer da aba "Consolidado" (Rede + Plano).

Fonte única para o Gap Analysis:
    NTW_OP.MUNICIPIOS_FECHAMENTO com MES_DIV_XG:
        - Baseline   = MES_DIV_XG <= 31/dez do ano anterior
        - Plano      = MES_DIV_XG entre 01/jan e 31/dez do ano
        - YTD        = PRESENCA_XG = 1 hoje
        - Projetado  = Baseline + Plano

Todas as funções seguem contrato:
    (filters: dict) -> dict | list
"""

import datetime as _dt

from database.oracle import execute_query

from modules.mobile_access.shared.constants import (
    TECH_COLORS,
    TECH_ORDER,
    OPERATIONAL_PRIORITIES,
    DEFAULT_PLAN_YEAR,
)
from modules.mobile_access.consolidated.queries import (
    BASE_CTE_TEMPLATE,
    GAP_QUERY,
    DELTA_BY_UF_QUERY,
    HISTORICAL_CTE_TEMPLATE,
    HISTORICAL_QUERY,
    GAUGE_CITIES_5G_EOY25,
    GAUGE_CITIES_5G_YTD,
    GAUGE_CITIES_5G_PLAN,
    GAUGE_SITES_5G_EOY25,
    GAUGE_SITES_5G_YTD,
    GAUGE_SITES_5G_PLAN,
)


# =============================================================================
# HELPERS DE NORMALIZAÇÃO
# =============================================================================

def _normalize_list(value):
    """Converte lista, string com vírgulas ou None em lista limpa."""
    if not value:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()]


def _build_in_clause(field, values, prefix, params):
    """Monta cláusula `AND field IN (:p_0, :p_1, ...)` com bind params seguros."""
    if not values:
        return ""
    placeholders = []
    for i, v in enumerate(values):
        key = f"{prefix}_{i}"
        params[key] = v
        placeholders.append(f":{key}")
    return f"AND {field} IN ({', '.join(placeholders)})"


def _build_status_clause(include_closed):
    """Aceita CLOSED opcionalmente. Usado só nos velocímetros que consultam plano."""
    if include_closed:
        return "AND r.STATUS_OC IN ('ACTIVATED', 'CLOSED')"
    return "AND r.STATUS_OC = 'ACTIVATED'"


def _build_ops_clause(include_ops, params):
    """Exclui prioridades operacionais (SWAP, DECOMMISSIONING, etc.) por default."""
    if include_ops:
        return ""
    placeholders = []
    for i, v in enumerate(OPERATIONAL_PRIORITIES):
        key = f"op_{i}"
        params[key] = v
        placeholders.append(f":{key}")
    return (
        f"AND (r.PRIORIDADE IS NULL "
        f"OR r.PRIORIDADE NOT IN ({', '.join(placeholders)}))"
    )


def _pct(value, total):
    """Retorna percentual arredondado (2 casas). 0.0 quando total é zero."""
    if not total:
        return 0.0
    return round((value / total) * 100, 2)


# =============================================================================
# MONTADORES DE QUERY
# =============================================================================

def _prepare_base_query(base_body, filters):
    params = {}

    ano = filters.get("ano") or DEFAULT_PLAN_YEAR
    try:
        ano_int = int(ano)
    except (TypeError, ValueError):
        ano_int = DEFAULT_PLAN_YEAR

    # Datas de referência (usadas dentro do CTE BASE)
    params["baseline_date"] = _dt.date(ano_int - 1, 12, 31)
    params["plan_start"]    = _dt.date(ano_int, 1, 1)
    params["plan_end"]      = _dt.date(ano_int, 12, 31)
    params["today_date"]    = _dt.date.today()   # ← NOVA LINHA

    ufs = _normalize_list(filters.get("ufs"))
    muns = _normalize_list(filters.get("municipios"))
    uf_filter = _build_in_clause("UF", ufs, "uf", params)
    mun_filter = _build_in_clause("MUNICIPIO", muns, "mun", params)

    cte = BASE_CTE_TEMPLATE.format(
        uf_filter=uf_filter,
        municipio_filter=mun_filter,
    )
    return cte + base_body, params


def _prepare_historical_query(filters):
    """Monta CTE do histórico (só rede) + corpo."""
    params = {}
    ufs = _normalize_list(filters.get("ufs"))
    muns = _normalize_list(filters.get("municipios"))
    uf_filter = _build_in_clause("UF", ufs, "uf", params)
    mun_filter = _build_in_clause("MUNICIPIO", muns, "mun", params)

    cte = HISTORICAL_CTE_TEMPLATE.format(
        uf_filter=uf_filter,
        municipio_filter=mun_filter,
    )
    return cte + HISTORICAL_QUERY, params


# =============================================================================
# ENDPOINTS PRINCIPAIS (GAP, DELTA, TIMELINE, SUMMARY)
# =============================================================================

def get_gap(filters):
    """
    Gap Analysis: para cada tec, retorna baseline (EoY-1), YTD (hoje),
    projetado (baseline + plano) e ganho do ano (plano).

    Fonte única: MES_DIV_XG em MUNICIPIOS_FECHAMENTO.
    """
    sql, params = _prepare_base_query(GAP_QUERY, filters)
    result = execute_query(sql, params)
    row = result[0] if result else {}

    total = row.get("total_municipios", 0) or 0

    bars = []
    for tec in TECH_ORDER:
        tec_low = tec.lower()
        baseline = row.get(f"baseline_{tec_low}", 0) or 0
        atual = row.get(f"atual_{tec_low}", 0) or 0
        proj = row.get(f"proj_{tec_low}", 0) or 0
        ganho = row.get(f"ganho_{tec_low}", 0) or 0

        bars.append({
            "tec": tec,
            "color": TECH_COLORS[tec],
            "baseline": baseline,
            "atual": atual,
            "projetado": proj,
            "ganho": ganho,
            "pct_atual": _pct(atual, total),
            "pct_projetado": _pct(proj, total),
            "pct_ganho_relativo": _pct(ganho, baseline) if baseline else 0.0,
        })

    return {"total_municipios": total, "bars": bars}


def get_delta_by_uf(filters):
    """
    UFs que mais ganham cobertura no ano.

    Ganho por UF/tec = municípios que ativaram a tec APÓS o baseline
    (já rodou este ano) + municípios que ainda vão receber pelo plano.

    Alinhado com o "Ganho FY" do velocímetro.
    """
    sql, params = _prepare_base_query(DELTA_BY_UF_QUERY, filters)
    result = execute_query(sql, params)

    rows = []
    for r in result:
        rows.append({
            "uf": r["uf"],
            "ganho_2g": r.get("ganho_2g", 0) or 0,
            "ganho_3g": r.get("ganho_3g", 0) or 0,
            "ganho_4g": r.get("ganho_4g", 0) or 0,
            "ganho_5g": r.get("ganho_5g", 0) or 0,
            "ganho_total": r.get("ganho_total", 0) or 0,
        })
    return rows


def get_projected_timeline(filters):
    """
    Histórico acumulado + ponto projetado em dez/AAAA.

    - Histórico: soma acumulada por mês a partir de MES_DIV_XG.
    - Projeção: último valor histórico + ganho anual (do get_gap).
    """
    # ---------------------------
    # 1) Histórico
    # ---------------------------
    sql_hist, params_hist = _prepare_historical_query(filters)
    hist = execute_query(sql_hist, params_hist)

    by_tec = {t: {} for t in TECH_ORDER}
    all_periods = set()
    for row in hist:
        tec = row["tec"]
        periodo = row["periodo"]
        qtd = row["qtd"] or 0
        if tec not in by_tec:
            continue
        if hasattr(periodo, "strftime"):
            key = periodo.strftime("%Y-%m-01")
        else:
            key = str(periodo)[:10]
        by_tec[tec][key] = by_tec[tec].get(key, 0) + qtd
        all_periods.add(key)

    periods = sorted(all_periods)

    # Acumulados históricos
    hist_series = {}
    for tec in TECH_ORDER:
        running = 0
        values = []
        for p in periods:
            running += by_tec[tec].get(p, 0)
            values.append(running)
        hist_series[tec] = values

    # Valor final (último ponto real)
    final_hist = {
        tec: (hist_series[tec][-1] if hist_series[tec] else 0)
        for tec in TECH_ORDER
    }

    # ---------------------------
    # 2) Projeção
    # ---------------------------
    gap = get_gap(filters)
    ganho_by_tec = {b["tec"]: b["ganho"] for b in gap["bars"]}
    ano = int(filters.get("ano") or DEFAULT_PLAN_YEAR)

    projection_point = f"{ano}-12-01"

    series = []
    for tec in TECH_ORDER:
        values = list(hist_series[tec])
        proj_value = final_hist[tec] + ganho_by_tec.get(tec, 0)

        series.append({
            "tec": tec,
            "color": TECH_COLORS[tec],
            "historical": values,
            "projected_point": {
                "period": projection_point,
                "value": proj_value,
                "current": final_hist[tec],
                "ganho": ganho_by_tec.get(tec, 0),
            },
        })

    all_periods_out = periods + [projection_point]

    return {
        "periods": periods,
        "projection_point": projection_point,
        "all_periods": all_periods_out,
        "series": series,
    }


def get_summary(filters):
    """
    Resumo executivo dos KPIs 'Saímos de X → Y'.
    Deriva do get_gap.
    """
    gap = get_gap(filters)
    total = gap["total_municipios"]

    cards = []
    for bar in gap["bars"]:
        cards.append({
            "label": bar["tec"],
            "atual": bar["atual"],
            "projetado": bar["projetado"],
            "ganho": bar["ganho"],
            "pct_atual": bar["pct_atual"],
            "pct_projetado": bar["pct_projetado"],
            "color": bar["color"],
        })

    return {
        "total_municipios": total,
        "cards": cards,
    }


# =============================================================================
# VELOCÍMETROS — Cidades 5G e Sites 5G
# =============================================================================
#
# Estes velocímetros consultam o plano diretamente em TB_ROLLOUT_ACESSO
# (para consistência com Sites, cuja base única não tem MES_DIV_XG).
#
# Se depois quiser padronizar Cidades 5G para usar MES_DIV_5G também,
# basta trocar GAUGE_CITIES_5G_PLAN por uma query em MUNICIPIOS_FECHAMENTO.
# =============================================================================

def _apply_geo_filters(sql_template, filters, uf_field="UF", mun_field="MUNICIPIO",
                      uf_key="uf_filter", mun_key="municipio_filter"):
    """Aplica filtros UF/Município num template específico dos gauges."""
    params = {}
    ufs = _normalize_list(filters.get("ufs"))
    muns = _normalize_list(filters.get("municipios"))

    uf_clause = _build_in_clause(uf_field, ufs, "uf", params)
    mun_clause = _build_in_clause(mun_field, muns, "mun", params)

    kwargs = {uf_key: uf_clause, mun_key: mun_clause}
    return sql_template.format(**kwargs), params


def _apply_plan_filters(sql_template, filters):
    """Aplica filtros do plano (ano, status, ops, UF, Município)."""
    params = {}

    ano = filters.get("ano") or DEFAULT_PLAN_YEAR
    try:
        params["ano"] = int(ano)
    except (TypeError, ValueError):
        params["ano"] = DEFAULT_PLAN_YEAR

    status_filter = _build_status_clause(filters.get("include_closed", False))
    ops_filter = _build_ops_clause(filters.get("include_ops", False), params)

    ufs = _normalize_list(filters.get("ufs"))
    muns = _normalize_list(filters.get("municipios"))
    uf_filter_d = _build_in_clause("d.UF", ufs, "uf", params)
    mun_filter_d = _build_in_clause("d.MUNICIPIO", muns, "mun", params)

    sql = sql_template.format(
        status_filter=status_filter,
        ops_filter=ops_filter,
        uf_filter_d=uf_filter_d,
        municipio_filter_d=mun_filter_d,
    )
    return sql, params


def _scalar(sql, params):
    """Executa e retorna o primeiro valor da primeira linha (int)."""
    result = execute_query(sql, params)
    if not result:
        return 0
    row = result[0]
    val = list(row.values())[0]
    return int(val or 0)


def _compute_gauge_metrics(eoy_baseline, ytd, plan_new, ano):
    """
    Métricas do velocímetro.

    Fórmulas:
        eoy_target    = ytd + plan_new
        ganho_ano     = eoy_target - eoy_baseline
        ganho_ytd     = ytd - eoy_baseline
        pt_pct        = ganho_ytd / ganho_ano * 100

    Projeção da meta (substitui SD, mais actionable):
        Só calcula quando ano == ano corrente e mês > 0.
            ritmo_mensal    = ganho_ytd / mes_atual
            projecao_dez    = ritmo_mensal * 12
            projected_pct   = projecao_dez / ganho_ano * 100
            projected_final = eoy_baseline + projecao_dez

    projected_pct interpreta:
        100% → bate meta exatamente no ritmo atual
        >100% → vai exceder
        <100% → vai ficar aquém
    """
    eoy_target = ytd + plan_new
    ganho_ano = eoy_target - eoy_baseline
    ganho_ytd = ytd - eoy_baseline

    pt_pct = 0.0
    if ganho_ano > 0:
        pt_pct = round((ganho_ytd / ganho_ano) * 100, 1)

    projected_pct = None
    projected_final = None
    ritmo_mensal = None

    today = _dt.date.today()
    if today.year == int(ano) and today.month > 0 and ganho_ano > 0:
        ritmo_mensal = ganho_ytd / today.month
        projecao_dez = ritmo_mensal * 12
        projected_pct = round((projecao_dez / ganho_ano) * 100, 1)
        projected_final = int(round(eoy_baseline + projecao_dez))

    return {
        "eoy_baseline": eoy_baseline,
        "ytd": ytd,
        "eoy_target": eoy_target,
        "ganho": ganho_ano,
        "ganho_ytd": ganho_ytd,
        "plan_new": plan_new,
        "pt_pct": pt_pct,
        "projected_pct": projected_pct,
        "projected_final": projected_final,
        "ritmo_mensal": round(ritmo_mensal, 1) if ritmo_mensal is not None else None,
        "current_month": today.month if today.year == int(ano) else None,
    }


def get_gauges(filters):
    """
    Retorna os 2 velocímetros de 5G (Cidades e Sites) com todas as métricas.

    Filtros aplicados:
        - UF, Município       → geografia (todos os 3 pontos)
        - Ano                 → define baseline (ano-1) e plano
        - include_closed      → aceita CLOSED no plano
        - include_ops         → mantém SWAP/DECOMMISSIONING no plano
    """
    ano = filters.get("ano") or DEFAULT_PLAN_YEAR
    try:
        ano = int(ano)
    except (TypeError, ValueError):
        ano = DEFAULT_PLAN_YEAR

    baseline_date_str = f"{ano - 1}-12-31"

    # ---------- CIDADES 5G ----------
    sql, params = _apply_geo_filters(
        GAUGE_CITIES_5G_EOY25, filters,
        uf_field="UF", mun_field="MUNICIPIO",
    )
    params["baseline_date"] = _dt.date(ano - 1, 12, 31)
    cities_eoy = _scalar(sql, params)

    sql, params = _apply_geo_filters(
        GAUGE_CITIES_5G_YTD, filters,
        uf_field="UF", mun_field="MUNICIPIO",
    )
    cities_ytd = _scalar(sql, params)

    sql, params = _apply_plan_filters(GAUGE_CITIES_5G_PLAN, filters)
    cities_plan = _scalar(sql, params)

    cities_metrics = _compute_gauge_metrics(cities_eoy, cities_ytd, cities_plan, ano)

    # ---------- SITES 5G ----------
    sql, params = _apply_geo_filters(
        GAUGE_SITES_5G_EOY25, filters,
        uf_field="UF", mun_field="MUNICIPIO",
        uf_key="uf_filter_site", mun_key="municipio_filter_site",
    )
    params["baseline_date"] = _dt.date(ano - 1, 12, 31)
    sites_eoy = _scalar(sql, params)

    sql, params = _apply_geo_filters(
        GAUGE_SITES_5G_YTD, filters,
        uf_field="UF", mun_field="MUNICIPIO",
        uf_key="uf_filter_site", mun_key="municipio_filter_site",
    )
    sites_ytd = _scalar(sql, params)

    sql, params = _apply_plan_filters(GAUGE_SITES_5G_PLAN, filters)
    sites_plan = _scalar(sql, params)

    sites_metrics = _compute_gauge_metrics(sites_eoy, sites_ytd, sites_plan, ano)

    return {
        "ano": ano,
        "baseline_year": ano - 1,
        "baseline_date": baseline_date_str,
        "gauges": {
            "cities_5g": {
                "title": "Cidades 5G",
                "unit": "cidades",
                **cities_metrics,
            },
            "sites_5g": {
                "title": "Sites 5G",
                "unit": "sites",
                **sites_metrics,
            },
        },
    }