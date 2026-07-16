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
    REALIZADO_POR_MUNICIPIO,
    REALIZADO_POR_MES,
)

# Ano do plano / fechamentos exibidos nas 3 raias do Resumo Executivo.
ANO_PLANO = 2026
ANO_FECHAMENTO_ATUAL = 2026
ANO_FECHAMENTO_ANTERIOR = 2025

MB_POR_PB = 1e9  # decimal: 1 PB = 1e6 GB = 1e9 MB

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


def _rz_municipio_rows(filters, ano, mes_max=None):
    """Realizado agregado por município (Oracle faz o GROUP BY) — soma dos
    meses do período e de todas as operadoras. Devolve ~5,5k linhas em vez
    das ~140k cruas."""
    params = {"ano": ano}
    periodo = "AND EXTRACT(YEAR FROM DT_REFERENCIA) = :ano"
    if mes_max is not None:
        params["mes_max"] = mes_max
        periodo += " AND EXTRACT(MONTH FROM DT_REFERENCIA) <= :mes_max"
    sql = REALIZADO_POR_MUNICIPIO.format(
        periodo_filter=periodo,
        uf_filter=_build_uf_clause(_normalize_list(filters.get("ufs")), params),
        municipio_filter=_build_municipio_clause(_normalize_list(filters.get("municipios")), params),
    )
    return execute_query(sql, params) or []


def _rz_mes_totais(filters, ano):
    """Realizado agregado por mês (Oracle faz o GROUP BY) — {mês: PB}, 12
    linhas. Também revela o mês corrente (maior mês com dado)."""
    params = {"ano": ano}
    sql = REALIZADO_POR_MES.format(
        uf_filter=_build_uf_clause(_normalize_list(filters.get("ufs")), params),
        municipio_filter=_build_municipio_clause(_normalize_list(filters.get("municipios")), params),
    )
    rows = execute_query(sql, params) or []
    return {int(_num(r.get("mes"))): _rz_pb(r.get("mb_total")) for r in rows}


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


# A OI pertence à TIM — não é concorrente. Então NÃO existe "market share":
# o realizado já vem somado por TODAS as operadoras direto do Oracle (o
# GROUP BY das queries não inclui OPERADORA). As funções abaixo consomem as
# linhas JÁ AGREGADAS por município (colunas mb_total/mb_2g/.../mb_5g).

def _rz_total(mun_rows):
    return round(sum(_rz_pb(r.get("mb_total")) for r in mun_rows), 4)


def _rz_por_tecnologia(mun_rows):
    """Split aditivo por tecnologia (2G/3G/4G/5G) em PB, das linhas agregadas."""
    buckets = {"2G": 0.0, "3G": 0.0, "4G": 0.0, "5G": 0.0}
    for r in mun_rows:
        buckets["2G"] += _rz_pb(r.get("mb_2g"))
        buckets["3G"] += _rz_pb(r.get("mb_3g"))
        buckets["4G"] += _rz_pb(r.get("mb_4g"))
        buckets["5G"] += _rz_pb(r.get("mb_5g"))
    return [{"label": k, "value": round(v, 4)} for k, v in buckets.items()]


def _rz_ranking_municipios(mun_rows, limit=15):
    ranked = sorted(
        ((r.get("municipio_nome") or "N/D", _rz_pb(r.get("mb_total"))) for r in mun_rows),
        key=lambda kv: kv[1], reverse=True,
    )[:limit]
    return [{"label": k, "value": round(v, 4)} for k, v in ranked]


def _rz_por_uf(mun_rows):
    """{UF: total_pb} das linhas agregadas por município."""
    agg = {}
    for r in mun_rows:
        uf = str(r.get("estado") or "N/D").strip().upper()
        agg[uf] = agg.get(uf, 0.0) + _rz_pb(r.get("mb_total"))
    return agg


def _mix_5g_pct(por_tecnologia):
    """% do tráfego que já é 5G — leitura executiva de modernização da rede."""
    total = sum(t["value"] for t in por_tecnologia)
    g5 = next((t["value"] for t in por_tecnologia if t["label"] == "5G"), 0.0)
    return round(g5 / total * 100, 1) if total else None


def _aderencia(realizado_pb, planejado_pb):
    if not planejado_pb:
        return None
    return round(realizado_pb / planejado_pb * 100, 1)


def _pct_growth(atual, anterior):
    """Crescimento % de `atual` sobre `anterior` (YoY)."""
    if not anterior:
        return None
    return round((atual - anterior) / anterior * 100, 1)


# ---------------------------------------------------------------------------
# Endpoints de alto nível
# ---------------------------------------------------------------------------

def get_resumo_executivo(filters):
    """3 raias: Fechamento 2025 · Plano 26 · Fechamento 26.

    Realizado agregado no Oracle: em vez de puxar ~140k linhas cruas por
    ano, cada `_rz_municipio_rows` volta ~5,5k (uma por município) e cada
    `_rz_mes_totais` volta 12 (uma por mês)."""
    pl26 = _planejado_rows(filters, ano=ANO_PLANO)
    # Mês corrente (YTD) sai da série mensal de 2026 (12 linhas, barato).
    rz26_mes = _rz_mes_totais(filters, ANO_FECHAMENTO_ATUAL)
    mes_max = max(rz26_mes) if rz26_mes else 0

    # --- Raia 1: Fechamento 2025 (realizado ano cheio, agregado) ---
    rz25_mun = _rz_municipio_rows(filters, ANO_FECHAMENTO_ANTERIOR)
    tec25 = _rz_por_tecnologia(rz25_mun)
    fechamento_2025 = {
        "ano": ANO_FECHAMENTO_ANTERIOR,
        "trafego_pb": _rz_total(rz25_mun),
        "por_tecnologia": tec25,
        "mix_5g_pct": _mix_5g_pct(tec25),
        "ranking_municipios": _rz_ranking_municipios(rz25_mun),
    }

    # --- Raia 2: Plano 26 — curva mensal planejada + REALIZADO até o YTD ---
    plan_mensal = _plan_por_mes(pl26)          # 12 valores
    serie_mensal = [
        {
            "mes": MESES_LABEL[i],
            "planejado_pb": plan_mensal[i],
            # realizado só existe até o mês corrente; depois fica None pra a
            # linha "parar" no acompanhamento (não desenha futuro).
            "realizado_pb": round(rz26_mes.get(i + 1, 0.0), 4) if (mes_max and i + 1 <= mes_max) else None,
        }
        for i in range(12)
    ]
    plano_26 = {
        "ano": ANO_PLANO,
        "trafego_planejado_pb": _plan_total_ano(pl26),
        "mes_ate": MESES_LABEL[mes_max - 1] if mes_max else None,
        "serie_mensal": serie_mensal,
        "por_camada": _plan_por_camada(pl26),
        "ranking_municipios": _plan_ranking_municipios(pl26),
    }

    # --- Raia 3: Fechamento 26 (realizado YTD) + aderência, YoY e projeção ---
    rz26_mun = _rz_municipio_rows(filters, ANO_FECHAMENTO_ATUAL, mes_max=mes_max) if mes_max else []
    realizado_ytd = _rz_total(rz26_mun)
    planejado_ytd = _plan_ytd(pl26, mes_max) if mes_max else 0.0
    # YoY: mesmo período (Jan..mes_max) do ano anterior — soma da série
    # mensal de 2025 até o mês corrente (reaproveita a query por mês).
    rz25_mes = _rz_mes_totais(filters, ANO_FECHAMENTO_ANTERIOR) if mes_max else {}
    realizado_ytd_ano_ant = round(sum(v for m, v in rz25_mes.items() if m <= mes_max), 4)
    # Projeção linear de fechamento do ano (run-rate) vs plano cheio.
    plano_ano = _plan_total_ano(pl26)
    projecao_ano = round(realizado_ytd / mes_max * 12, 4) if mes_max else 0.0
    tec26 = _rz_por_tecnologia(rz26_mun)
    fechamento_26 = {
        "ano": ANO_FECHAMENTO_ATUAL,
        "mes_ate": MESES_LABEL[mes_max - 1] if mes_max else None,
        "trafego_ytd_pb": realizado_ytd,
        "planejado_ytd_pb": planejado_ytd,
        "aderencia_pct": _aderencia(realizado_ytd, planejado_ytd),
        "crescimento_yoy_pct": _pct_growth(realizado_ytd, realizado_ytd_ano_ant),
        "projecao_ano_pb": projecao_ano,
        "atingimento_plano_pct": _aderencia(projecao_ano, plano_ano),
        "por_tecnologia": tec26,
        "mix_5g_pct": _mix_5g_pct(tec26),
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
    rz_mensal = _rz_mes_totais(filters, ANO_FECHAMENTO_ATUAL)   # {mes: pb}, 12 linhas
    mes_max = max(rz_mensal) if rz_mensal else 0
    # Por UF (YTD) sai da agregação por município já filtrada até o mês corrente.
    rz_mun = _rz_municipio_rows(filters, ANO_FECHAMENTO_ATUAL, mes_max=mes_max) if mes_max else []

    plan_mensal = _plan_por_mes(pl)          # 12 valores

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
    real_uf = _rz_por_uf(rz_mun)
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
