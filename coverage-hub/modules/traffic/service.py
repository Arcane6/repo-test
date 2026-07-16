"""
Service do módulo Tráfego (planejado × realizado + market share TIM × OI).

Regras de negócio (confirmadas com os dados):
- **Planejado** (REL_TRAFEGO_CIDADES_WIDE) já vem em **PB**. TIPO_TRAF
  'Consolidado' é o TOTAL oficial — as demais camadas (2G/3G, 4G, 4G/5G,
  5G) se sobrepõem, então NUNCA somar as camadas pra obter total; usar
  'Consolidado'.
- **Realizado** (REL_DS013_TRAFEGO_REALIZADO) vem em MB. Converte pra PB
  dividindo por 1e9 (decimal: 1 PB = 1e9 MB). As colunas por tecnologia
  são aditivas (2G+3G+4G+5G_NSA+5G_SA = TOTAL).
- **Market share** = tráfego TIM / (TIM + OI), com o realizado (a fonte
  traz as duas operadoras).
- **YTD** = acumulado de Janeiro até o mês corrente (o mês corrente é o
  maior MES do realizado do ano).

Tudo calculado em Python a partir das linhas (mais simples de auditar e
testar com stub, sem Oracle real no sandbox), no mesmo espírito do módulo
de Acesso Móvel.
"""

import string as _string

from database.oracle import execute_query

from modules.traffic.queries import (
    MESES_WIDE,
    PLANEJADO_WIDE,
    REALIZADO,
)

# Ano do plano / fechamentos exibidos nas 3 raias do Resumo Executivo.
ANO_PLANO = 2026
ANO_FECHAMENTO_ATUAL = 2026
ANO_FECHAMENTO_ANTERIOR = 2025

MB_POR_PB = 1e9  # decimal: 1 PB = 1e6 GB = 1e9 MB
OPERADORA_TIM = "TIM"

MESES_LABEL = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]


# ---------------------------------------------------------------------------
# Helpers de filtro (mesmo padrão introspectivo das outras abas)
# ---------------------------------------------------------------------------

def _normalize_list(value):
    if not value:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()]


def _num(v):
    """Coerção segura pra float — cobre None, Decimal e string com vírgula
    decimal (caso alguma coluna venha como VARCHAR do Oracle)."""
    if v is None:
        return 0.0
    if isinstance(v, str):
        v = v.strip().replace(".", "").replace(",", ".") if ("," in v) else v.strip()
        try:
            return float(v)
        except ValueError:
            return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _build_uf_clause(values, params):
    if not values:
        return ""
    ph = []
    for i, v in enumerate(values):
        key = f"uf_{i}"
        params[key] = v.upper()
        ph.append(f":{key}")
    return f"AND UPPER(TRIM(ESTADO)) IN ({', '.join(ph)})"


def _build_municipio_clause(values, params):
    """Filtra por nome de município direto na coluna MUNICIPIO_NOME
    (UPPER/TRIM dos dois lados). O autocomplete do filtro busca em
    MUNICIPIOS_FECHAMENTO; se aparecer descasamento de acentuação/grafia
    contra as tabelas de tráfego, a ponte via IBGE (MUNICIPIO_ID de 6
    dígitos) entra numa próxima iteração — por ora o match por nome cobre
    o caso comum e degrada de forma visível (sem match = vazio)."""
    if not values:
        return ""
    ph = []
    for i, v in enumerate(values):
        key = f"mun_{i}"
        params[key] = v.upper()
        ph.append(f"UPPER(:{key})")
    return f"AND UPPER(TRIM(MUNICIPIO_NOME)) IN ({', '.join(ph)})"


def _template_fields(sql_template):
    return {name for _, name, _, _ in _string.Formatter().parse(sql_template) if name}


def _apply_filters(sql_template, filters, params):
    fields = _template_fields(sql_template)
    fill = {}
    if "uf_filter" in fields:
        fill["uf_filter"] = _build_uf_clause(_normalize_list(filters.get("ufs")), params)
    if "municipio_filter" in fields:
        fill["municipio_filter"] = _build_municipio_clause(_normalize_list(filters.get("municipios")), params)
    return sql_template.format(**fill)


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def _planejado_rows(filters, ano=ANO_PLANO):
    params = {"ano": ano}
    sql = _apply_filters(PLANEJADO_WIDE, filters, params)
    return execute_query(sql, params) or []


def _realizado_rows(filters, ano=None, mes_max=None):
    params = {}
    periodo = ""
    if ano is not None:
        params["ano"] = ano
        periodo = "AND EXTRACT(YEAR FROM DT_REFERENCIA) = :ano"
        if mes_max is not None:
            params["mes_max"] = mes_max
            periodo += " AND EXTRACT(MONTH FROM DT_REFERENCIA) <= :mes_max"
    sql = REALIZADO.format(
        periodo_filter=periodo,
        uf_filter=_build_uf_clause(_normalize_list(filters.get("ufs")), params),
        municipio_filter=_build_municipio_clause(_normalize_list(filters.get("municipios")), params),
    )
    return execute_query(sql, params) or []


# ---------------------------------------------------------------------------
# Cálculos — PLANEJADO (a partir das linhas WIDE)
# ---------------------------------------------------------------------------

def _plan_consolidado(rows):
    """Só as linhas Consolidado (o total oficial)."""
    return [r for r in rows if str(r.get("tipo_traf") or "").strip().upper() == "CONSOLIDADO"]


def _plan_por_mes(rows):
    """Série mensal do planejado (Consolidado), somando municípios.
    Retorna lista de 12 valores (Jan..Dez) em PB."""
    cons = _plan_consolidado(rows)
    totais = [0.0] * 12
    for r in cons:
        for i, mes in enumerate(MESES_WIDE):
            totais[i] += _num(r.get(mes.lower()))
    return [round(v, 4) for v in totais]


def _plan_total_ano(rows):
    return round(sum(_plan_por_mes(rows)), 4)


def _plan_ytd(rows, mes_max):
    """Acumulado Jan..mes_max (1-based) do planejado Consolidado."""
    por_mes = _plan_por_mes(rows)
    return round(sum(por_mes[:mes_max]), 4)


# Camadas que compõem o total de forma ADITIVA (sem sobreposição). A
# hierarquia do dado é: Consolidado = "2G/3G" + "4G/5G", e "4G/5G" = "4G" +
# "5G" (confirmado numericamente). Ou seja, {2G/3G, 4G, 5G} soma exatamente
# o Consolidado — é o split que fecha 100% numa pizza. "4G/5G" e
# "Consolidado" são recortes agregados e ficam de fora do split pra não
# contar em dobro.
CAMADAS_ADITIVAS = {"2G/3G", "4G", "5G"}


def _plan_por_camada(rows):
    """Split aditivo do planejado por tecnologia ({2G/3G, 4G, 5G}, que soma
    o Consolidado). Exclui 'Consolidado' e a camada combinada '4G/5G' pra
    não dobrar o total."""
    agg = {}
    for r in rows:
        tt = str(r.get("tipo_traf") or "").strip()
        if tt not in CAMADAS_ADITIVAS:
            continue
        total = sum(_num(r.get(m.lower())) for m in MESES_WIDE)
        agg[tt] = agg.get(tt, 0.0) + total
    return [{"label": k, "value": round(v, 4)} for k, v in sorted(agg.items(), key=lambda kv: kv[1], reverse=True)]


def _plan_ranking_municipios(rows, limit=15):
    cons = _plan_consolidado(rows)
    agg = {}
    for r in cons:
        nome = r.get("municipio_nome") or "N/D"
        agg[nome] = agg.get(nome, 0.0) + sum(_num(r.get(m.lower())) for m in MESES_WIDE)
    ranked = sorted(agg.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [{"label": k, "value": round(v, 4)} for k, v in ranked]


# ---------------------------------------------------------------------------
# Cálculos — REALIZADO (a partir das linhas)
# ---------------------------------------------------------------------------

def _rz_pb(mb):
    return _num(mb) / MB_POR_PB


def _rz_por_operadora(rows):
    agg = {}
    for r in rows:
        op = str(r.get("operadora") or "N/D").strip().upper()
        agg[op] = agg.get(op, 0.0) + _rz_pb(r.get("s_megabyte_total"))
    return {k: round(v, 4) for k, v in agg.items()}


def _market_share_tim(rows):
    por_op = _rz_por_operadora(rows)
    tim = por_op.get(OPERADORA_TIM, 0.0)
    total = sum(por_op.values())
    share = round(tim / total * 100, 1) if total else None
    return {"tim_pb": round(tim, 4), "total_mercado_pb": round(total, 4), "share_tim_pct": share, "por_operadora": por_op}


def _rz_tim_rows(rows):
    return [r for r in rows if str(r.get("operadora") or "").strip().upper() == OPERADORA_TIM]


def _rz_total_tim(rows):
    return round(sum(_rz_pb(r.get("s_megabyte_total")) for r in _rz_tim_rows(rows)), 4)


def _rz_por_tecnologia_tim(rows):
    """Split aditivo do tráfego TIM por tecnologia (2G/3G/4G/5G) em PB."""
    tim = _rz_tim_rows(rows)
    buckets = {"2G": 0.0, "3G": 0.0, "4G": 0.0, "5G": 0.0}
    for r in tim:
        buckets["2G"] += _rz_pb(r.get("s_megabyte_2g"))
        buckets["3G"] += _rz_pb(r.get("s_megabyte_3g"))
        buckets["4G"] += _rz_pb(r.get("s_megabyte_4g"))
        buckets["5G"] += _rz_pb(r.get("s_megabyte_5g_nsa")) + _rz_pb(r.get("s_megabyte_5g_sa"))
    return [{"label": k, "value": round(v, 4)} for k, v in buckets.items()]


def _rz_por_mes_tim(rows):
    """Série mensal do realizado TIM (PB), indexada por número do mês."""
    agg = {}
    for r in _rz_tim_rows(rows):
        mes = int(_num(r.get("mes")))
        agg[mes] = agg.get(mes, 0.0) + _rz_pb(r.get("s_megabyte_total"))
    return {m: round(v, 4) for m, v in agg.items()}


def _rz_ranking_municipios_tim(rows, limit=15):
    agg = {}
    for r in _rz_tim_rows(rows):
        nome = r.get("municipio_nome") or "N/D"
        agg[nome] = agg.get(nome, 0.0) + _rz_pb(r.get("s_megabyte_total"))
    ranked = sorted(agg.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [{"label": k, "value": round(v, 4)} for k, v in ranked]


def _mes_corrente(realizado_rows):
    """Maior mês presente no realizado (define o 'YTD até')."""
    meses = [int(_num(r.get("mes"))) for r in realizado_rows if r.get("mes") is not None]
    return max(meses) if meses else 0


def _aderencia(realizado_pb, planejado_pb):
    if not planejado_pb:
        return None
    return round(realizado_pb / planejado_pb * 100, 1)


# ---------------------------------------------------------------------------
# Endpoints de alto nível
# ---------------------------------------------------------------------------

def get_resumo_executivo(filters):
    """3 raias: Fechamento 2025 · Plano 26 · Fechamento 26."""
    # --- Raia 1: Fechamento 2025 (realizado ano cheio) ---
    rz25 = _realizado_rows(filters, ano=ANO_FECHAMENTO_ANTERIOR)
    ms25 = _market_share_tim(rz25)
    fechamento_2025 = {
        "ano": ANO_FECHAMENTO_ANTERIOR,
        "trafego_tim_pb": _rz_total_tim(rz25),
        "market_share": ms25,
        "por_tecnologia": _rz_por_tecnologia_tim(rz25),
        "ranking_municipios": _rz_ranking_municipios_tim(rz25),
    }

    # --- Raia 2: Plano 26 (planejado ano cheio) ---
    pl26 = _planejado_rows(filters, ano=ANO_PLANO)
    plano_26 = {
        "ano": ANO_PLANO,
        "trafego_planejado_pb": _plan_total_ano(pl26),
        "serie_mensal": [
            {"mes": MESES_LABEL[i], "value": v} for i, v in enumerate(_plan_por_mes(pl26))
        ],
        "por_camada": _plan_por_camada(pl26),
        "ranking_municipios": _plan_ranking_municipios(pl26),
    }

    # --- Raia 3: Fechamento 26 (realizado YTD) + aderência ao plano ---
    rz26_full = _realizado_rows(filters, ano=ANO_FECHAMENTO_ATUAL)
    mes_max = _mes_corrente(rz26_full)
    rz26 = _realizado_rows(filters, ano=ANO_FECHAMENTO_ATUAL, mes_max=mes_max) if mes_max else rz26_full
    ms26 = _market_share_tim(rz26)
    realizado_ytd = _rz_total_tim(rz26)
    planejado_ytd = _plan_ytd(pl26, mes_max) if mes_max else 0.0
    fechamento_26 = {
        "ano": ANO_FECHAMENTO_ATUAL,
        "mes_ate": MESES_LABEL[mes_max - 1] if mes_max else None,
        "trafego_tim_ytd_pb": realizado_ytd,
        "planejado_ytd_pb": planejado_ytd,
        "aderencia_pct": _aderencia(realizado_ytd, planejado_ytd),
        "market_share": ms26,
        "por_tecnologia": _rz_por_tecnologia_tim(rz26),
    }

    return {
        "fechamento_2025": fechamento_2025,
        "plano_26": plano_26,
        "fechamento_26": fechamento_26,
    }


def get_ytd(filters):
    """Tráfego YTD: planejado × realizado acumulado por mês (2026), com
    aderência ao plano e ranking por UF."""
    pl = _planejado_rows(filters, ano=ANO_PLANO)
    rz = _realizado_rows(filters, ano=ANO_FECHAMENTO_ATUAL)
    mes_max = _mes_corrente(rz)

    plan_mensal = _plan_por_mes(pl)          # 12 valores
    rz_mensal = _rz_por_mes_tim(rz)          # {mes: pb}

    # Série acumulada mês a mês até o mês corrente.
    serie = []
    acc_plan = 0.0
    acc_real = 0.0
    for m in range(1, (mes_max or 12) + 1):
        acc_plan += plan_mensal[m - 1]
        acc_real += rz_mensal.get(m, 0.0)
        serie.append({
            "mes": MESES_LABEL[m - 1],
            "planejado_pb": round(acc_plan, 4),
            "realizado_pb": round(acc_real, 4),
            "aderencia_pct": _aderencia(acc_real, acc_plan),
        })

    realizado_ytd = round(acc_real, 4)
    planejado_ytd = round(acc_plan, 4)

    # Ranking por UF: planejado vs realizado YTD.
    plan_uf = {}
    for r in _plan_consolidado(pl):
        uf = str(r.get("estado") or "N/D").strip().upper()
        plan_uf[uf] = plan_uf.get(uf, 0.0) + sum(_num(r.get(MESES_WIDE[i].lower())) for i in range(mes_max or 12))
    real_uf = {}
    for r in _rz_tim_rows(rz):
        if mes_max and int(_num(r.get("mes"))) > mes_max:
            continue
        uf = str(r.get("estado") or "N/D").strip().upper()
        real_uf[uf] = real_uf.get(uf, 0.0) + _rz_pb(r.get("s_megabyte_total"))
    ufs = sorted(set(plan_uf) | set(real_uf), key=lambda u: real_uf.get(u, 0.0), reverse=True)
    por_uf = [
        {
            "uf": uf,
            "planejado_pb": round(plan_uf.get(uf, 0.0), 4),
            "realizado_pb": round(real_uf.get(uf, 0.0), 4),
            "aderencia_pct": _aderencia(real_uf.get(uf, 0.0), plan_uf.get(uf, 0.0)),
        }
        for uf in ufs
    ]

    return {
        "ano": ANO_FECHAMENTO_ATUAL,
        "mes_ate": MESES_LABEL[mes_max - 1] if mes_max else None,
        "planejado_ytd_pb": planejado_ytd,
        "realizado_ytd_pb": realizado_ytd,
        "aderencia_pct": _aderencia(realizado_ytd, planejado_ytd),
        "serie_acumulada": serie,
        "por_uf": por_uf,
    }
