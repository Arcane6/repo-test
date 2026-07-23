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

from database.oracle import execute_query

from modules.traffic.queries import (
    PLANEJADO_POR_CAMADA,
    PLANEJADO_POR_UF,
    PLANEJADO_TOP_MUNICIPIOS,
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
    """Ponte por IBGE (mesma lógica de sites/summary). Resolve o(s) nome(s)
    de município pro código IBGE via NTW_OP.MUNICIPIOS_FECHAMENTO — que é de
    onde o autocomplete do filtro busca — e filtra por MUNICIPIO_ID (o IBGE
    de 6 dígitos das tabelas de tráfego).

    Por que não filtrar MUNICIPIO_NOME direto: a grafia não bate. O
    realizado (REL_DS013) guarda o nome em CAIXA ALTA e SEM acento
    ('SAO PAULO'), enquanto o autocomplete devolve com acento ('São Paulo')
    — então `UPPER(MUNICIPIO_NOME) IN (...)` casava no planejado (Raia 2,
    nome acentuado) mas NÃO no realizado (Raias 1 e 3). O MUNICIPIO_ID é
    idêntico nos dois (ex.: 314260), então a ponte resolve tudo. MUNICIPIO_ID
    = 6 primeiros dígitos do IBGE de 7 de MUNICIPIOS_FECHAMENTO."""
    if not values:
        return ""
    ph = []
    for i, v in enumerate(values):
        key = f"mun_{i}"
        params[key] = v
        ph.append(f":{key}")
    in_list = ", ".join(ph)
    return f"""AND TO_CHAR(MUNICIPIO_ID) IN (
        SELECT SUBSTR(TO_CHAR(IBGE), 1, 6)
        FROM NTW_OP.MUNICIPIOS_FECHAMENTO
        WHERE TRUNC(DT_CARGA) = (SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO)
        AND MUNICIPIO IN ({in_list})
    )"""




# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def _plan_camada_rows(filters, ano=ANO_PLANO):
    """Planejado agregado por TIPO_TRAF (Oracle faz o GROUP BY) — 5 linhas,
    cada uma com os 12 meses somados nacionalmente. A linha 'Consolidado' dá
    série/total/YTD; as camadas dão o split. Substitui o pull de ~28k linhas."""
    params = {"ano": ano}
    sql = PLANEJADO_POR_CAMADA.format(
        uf_filter=_build_uf_clause(_normalize_list(filters.get("ufs")), params),
        municipio_filter=_build_municipio_clause(_normalize_list(filters.get("municipios")), params),
    )
    return execute_query(sql, params) or []


def _plan_top_municipios(filters, ano=ANO_PLANO):
    """Top 15 municípios do plano no MÊS DE CORTE (dezembro) — 15 linhas."""
    params = {"ano": ano}
    sql = PLANEJADO_TOP_MUNICIPIOS.format(
        uf_filter=_build_uf_clause(_normalize_list(filters.get("ufs")), params),
        municipio_filter=_build_municipio_clause(_normalize_list(filters.get("municipios")), params),
    )
    rows = execute_query(sql, params) or []
    return [{"label": r.get("municipio_nome") or "N/D", "value": round(_num(r.get("total_dez")), 4)} for r in rows]


def _plan_por_uf_rows(filters, ano=ANO_PLANO):
    """Planejado agregado por UF (só Consolidado), 12 meses — ~27 linhas."""
    params = {"ano": ano}
    sql = PLANEJADO_POR_UF.format(
        uf_filter=_build_uf_clause(_normalize_list(filters.get("ufs")), params),
        municipio_filter=_build_municipio_clause(_normalize_list(filters.get("municipios")), params),
    )
    return execute_query(sql, params) or []


def _rz_municipio_rows(filters, ano, mes=None):
    """Realizado agregado por município (Oracle faz o GROUP BY) — soma de
    TODAS as operadoras. Tráfego é métrica MENSAL, não cumulativa: se `mes`
    for informado, filtra o mês EXATO (o "mês de corte"), nunca um
    intervalo Jan..mês (isso somaria vários meses, o que o usuário pediu
    pra nunca fazer). Sem `mes`, cai no ano inteiro cru — hoje nenhum
    chamador usa esse caso; mantido só por segurança de assinatura."""
    params = {"ano": ano}
    periodo = "AND EXTRACT(YEAR FROM DT_REFERENCIA) = :ano"
    if mes is not None:
        params["mes"] = mes
        periodo += " AND EXTRACT(MONTH FROM DT_REFERENCIA) = :mes"
    sql = REALIZADO_POR_MUNICIPIO.format(
        periodo_filter=periodo,
        uf_filter=_build_uf_clause(_normalize_list(filters.get("ufs")), params),
        municipio_filter=_build_municipio_clause(_normalize_list(filters.get("municipios")), params),
    )
    return execute_query(sql, params) or []


def _rz_municipio_rows_acumulado(filters, ano, mes_max):
    """Realizado agregado por município, CUMULATIVO Jan..mes_max. Usado só
    pela aba "YTD" (visão de acumulado do ano — propositalmente separada do
    resto do módulo, que agora usa sempre o mês de corte, nunca a soma)."""
    params = {"ano": ano, "mes_max": mes_max}
    periodo = "AND EXTRACT(YEAR FROM DT_REFERENCIA) = :ano AND EXTRACT(MONTH FROM DT_REFERENCIA) <= :mes_max"
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
# Cálculos — PLANEJADO (a partir das linhas JÁ AGREGADAS)
# ---------------------------------------------------------------------------

# Nas linhas agregadas os meses vêm como colunas m01..m12 (SUM de cada mês).
def _mes_cols(row):
    return [_num(row.get(f"m{i:02d}")) for i in range(1, 13)]


def _plan_meses_consolidado(camada_rows):
    """Série mensal nacional (12 valores PB) da linha Consolidado."""
    for r in camada_rows:
        if str(r.get("tipo_traf") or "").strip().upper() == "CONSOLIDADO":
            return [round(v, 4) for v in _mes_cols(r)]
    return [0.0] * 12


# Camadas que compõem o total de forma ADITIVA (sem sobreposição). A
# hierarquia do dado é: Consolidado = "2G/3G" + "4G/5G", e "4G/5G" = "4G" +
# "5G" (confirmado numericamente). Ou seja, {2G/3G, 4G, 5G} soma exatamente
# o Consolidado — é o split que fecha 100% numa pizza. "4G/5G" e
# "Consolidado" são recortes agregados e ficam de fora do split pra não
# contar em dobro.
CAMADAS_ADITIVAS = {"2G/3G", "4G", "5G"}


def _plan_por_camada(camada_rows):
    """Split do planejado por tecnologia ({2G/3G, 4G, 5G}, que soma o
    Consolidado) no MÊS DE CORTE (dezembro — índice 11), das linhas
    agregadas por TIPO_TRAF. NUNCA soma os 12 meses (tráfego é mensal)."""
    out = []
    for r in camada_rows:
        tt = str(r.get("tipo_traf") or "").strip()
        if tt not in CAMADAS_ADITIVAS:
            continue
        out.append({"label": tt, "value": round(_mes_cols(r)[11], 4)})
    return sorted(out, key=lambda x: x["value"], reverse=True)


def _plan_uf_ytd(uf_rows, mes_max):
    """{UF: total_pb} do planejado acumulado Jan..mes_max, das linhas por UF."""
    agg = {}
    for r in uf_rows:
        uf = str(r.get("estado") or "N/D").strip().upper()
        agg[uf] = round(sum(_mes_cols(r)[:mes_max]), 4) if mes_max else 0.0
    return agg


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

    Regra do usuário: tráfego é métrica MENSAL — todo KPI/ranking/split que
    antes somava o ano (ou o YTD) agora usa só a volumetria do MÊS DE CORTE:
    dez/25 pra Fechamento 2025, dez/26 pra Plano 26, e o mês mais recente com
    realizado (`mes_max`) pra Fechamento 26. NUNCA soma múltiplos meses.
    Exceção deliberada: a "Curva Mensal" (série ponto-a-ponto por mês) segue
    mostrando os 12 meses — cada ponto já é a volumetria do próprio mês, não
    é cumulativo, então já respeita a regra.

    Realizado agregado no Oracle: em vez de puxar ~140k linhas cruas por
    ano, cada `_rz_municipio_rows` volta ~5,5k (uma por município, de UM mês)
    e cada `_rz_mes_totais` volta 12 (uma por mês)."""
    cam26 = _plan_camada_rows(filters, ano=ANO_PLANO)
    plan_mensal = _plan_meses_consolidado(cam26)   # 12 valores PB (série, não soma)
    plano_dez = plan_mensal[11]                    # mês de corte do plano: sempre dez
    # Mês corrente (mais recente com dado) sai da série mensal de 2026.
    rz26_mes = _rz_mes_totais(filters, ANO_FECHAMENTO_ATUAL)
    mes_max = max(rz26_mes) if rz26_mes else 0

    # --- Raia 1: Fechamento 2025 — mês de corte = dezembro/2025 ---
    rz25_mun = _rz_municipio_rows(filters, ANO_FECHAMENTO_ANTERIOR, mes=12)
    tec25 = _rz_por_tecnologia(rz25_mun)
    fechamento_2025 = {
        "ano": ANO_FECHAMENTO_ANTERIOR,
        "trafego_pb": _rz_total(rz25_mun),
        "por_tecnologia": tec25,
        "mix_5g_pct": _mix_5g_pct(tec25),
        "ranking_municipios": _rz_ranking_municipios(rz25_mun),
    }

    # --- Raia 2: Plano 26 — curva mensal (série, não cumulativa) + mês de
    # corte (dezembro) nos KPIs/rankings ---
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
        "trafego_planejado_pb": round(plano_dez, 4),
        "mes_ate": MESES_LABEL[mes_max - 1] if mes_max else None,
        "serie_mensal": serie_mensal,
        "por_camada": _plan_por_camada(cam26),
        "ranking_municipios": _plan_top_municipios(filters, ANO_PLANO),
    }

    # --- Raia 3: Fechamento 26 — mês de corte = mês mais recente com
    # realizado (mes_max). Aderência e YoY comparam o MESMO mês, nunca
    # acumulado. Sem projeção de fim de ano (era um run-rate anualizado —
    # a própria ideia de "somar o ano" que o usuário pediu pra tirar). ---
    rz26_mun = _rz_municipio_rows(filters, ANO_FECHAMENTO_ATUAL, mes=mes_max) if mes_max else []
    realizado_mes = _rz_total(rz26_mun)
    planejado_mes = round(plan_mensal[mes_max - 1], 4) if mes_max else 0.0
    # YoY: mesmo mês do ano anterior (ex.: jul/26 vs jul/25), não acumulado.
    rz25_mes = _rz_mes_totais(filters, ANO_FECHAMENTO_ANTERIOR) if mes_max else {}
    realizado_mes_ano_ant = round(rz25_mes.get(mes_max, 0.0), 4)
    tec26 = _rz_por_tecnologia(rz26_mun)
    fechamento_26 = {
        "ano": ANO_FECHAMENTO_ATUAL,
        "mes_ate": MESES_LABEL[mes_max - 1] if mes_max else None,
        "trafego_mes_pb": realizado_mes,
        "planejado_mes_pb": planejado_mes,
        "aderencia_pct": _aderencia(realizado_mes, planejado_mes),
        "crescimento_yoy_pct": _pct_growth(realizado_mes, realizado_mes_ano_ant),
        "por_tecnologia": tec26,
        "mix_5g_pct": _mix_5g_pct(tec26),
        "ranking_municipios": _rz_ranking_municipios(rz26_mun),
    }

    return {
        "fechamento_2025": fechamento_2025,
        "plano_26": plano_26,
        "fechamento_26": fechamento_26,
    }


def get_ytd(filters):
    """Tráfego YTD: planejado × realizado acumulado por mês (2026), com
    aderência ao plano e ranking por UF."""
    cam = _plan_camada_rows(filters, ano=ANO_PLANO)
    plan_mensal = _plan_meses_consolidado(cam)   # 12 valores
    rz_mensal = _rz_mes_totais(filters, ANO_FECHAMENTO_ATUAL)   # {mes: pb}, 12 linhas
    mes_max = max(rz_mensal) if rz_mensal else 0
    # Por UF (YTD): planejado agregado por UF + realizado agregado por município.
    rz_mun = _rz_municipio_rows_acumulado(filters, ANO_FECHAMENTO_ATUAL, mes_max) if mes_max else []
    plan_uf = _plan_uf_ytd(_plan_por_uf_rows(filters, ANO_PLANO), mes_max)

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

    # Ranking por UF: planejado vs realizado YTD (plan_uf já calculado acima).
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
