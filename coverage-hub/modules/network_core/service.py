"""
Service layer do módulo Core (volumetria de tráfego da RAN).

Sem conceito de "ano"/"tecnologia" (não existe no dado) — só geografia
(UF/Município/Regional) e tempo (MES, formato YYYYMM). Todo endpoint
deriva de uma das duas queries de queries.py: snapshot (último mês) ou
histórico (últimos 12 meses). A janela de 12 meses (sem 13º de base)
significa que não há comparação YoY — só MoM (mês a mês).
"""

import string as _string

from database.oracle import execute_query

from modules.network_core.queries import (
    VOLUMETRIA_SNAPSHOT,
    VOLUMETRIA_HISTORICO_12M,
)


# ---------------------------------------------------------------------------
# Helpers (mesmo padrão de sites/service.py e summary/service.py — cada
# aba mantém sua própria cópia pequena em vez de compartilhar util
# genérico entre módulos)
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


def _build_municipio_ibge_clause(values, prefix, params):
    """Resolve nome(s) de município pro IBGE via MUNICIPIOS_FECHAMENTO
    antes de filtrar — mesma lógica de sites/service.py e
    summary/service.py: o autocomplete do filtro busca em
    MUNICIPIOS_FECHAMENTO, então comparar por texto direto contra a
    própria coluna MUNICIPIO de outra tabela arrisca não bater
    (acentuação/grafia). Aqui filtramos MUN.IBGE, que já é a mesma tabela
    (TB_AUX_INFO_MUNICIPIOS) usada pra resolver UF/Município/Regional
    nesta query — só município (nome) precisa da ponte, IBGE já é
    identificador numérico direto."""
    if not values:
        return ""
    placeholders = []
    for i, v in enumerate(values):
        key = f"{prefix}_{i}"
        params[key] = v
        placeholders.append(f":{key}")
    in_list = ", ".join(placeholders)
    return f"""AND MUN.IBGE IN (
        SELECT IBGE FROM NTW_OP.MUNICIPIOS_FECHAMENTO
        WHERE TRUNC(DT_CARGA) = (SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO)
        AND MUNICIPIO IN ({in_list})
    )"""


def _template_fields(sql_template):
    return {
        name
        for _, name, _, _ in _string.Formatter().parse(sql_template)
        if name
    }


def _apply_geo(sql_template, filters, params):
    fields = _template_fields(sql_template)
    to_fill = {}
    if "uf_filter" in fields:
        to_fill["uf_filter"] = _build_in_clause("MUN.UF", _normalize_list(filters.get("ufs")), "uf", params)
    if "regional_filter" in fields:
        to_fill["regional_filter"] = _build_in_clause(
            "MUN.REGIONAL", _normalize_list(filters.get("regionais")), "reg", params
        )
    if "municipio_filter" in fields:
        to_fill["municipio_filter"] = _build_municipio_ibge_clause(
            _normalize_list(filters.get("municipios")), "mun", params
        )
    return sql_template.format(**to_fill)


def _mes_label(mes):
    """'202206' -> 'Jun/22'."""
    if not mes or len(mes) != 6:
        return mes
    meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    ano, mm = mes[:4], mes[4:]
    try:
        return f"{meses[int(mm) - 1]}/{ano[-2:]}"
    except (ValueError, IndexError):
        return mes


def _pct_change(current, previous):
    if not previous:
        return None
    return round((current - previous) / previous * 100, 1)


# ---------------------------------------------------------------------------
# Snapshot (último mês) — ranking por município/UF/Regional, mapa
# ---------------------------------------------------------------------------

def _snapshot_rows(filters):
    params = {}
    sql = _apply_geo(VOLUMETRIA_SNAPSHOT, filters, params)
    return execute_query(sql, params) or []


# Quantos municípios a tabela devolve. O Brasil tem ~5570 municípios; mandar
# todos no JSON do /overview era o que deixava a resposta "puxando uma
# infinidade de coisas" (payload gigante). A cauda longa carrega pouquíssimo
# tráfego — o top 100 já cobre a esmagadora maioria da volumetria nacional e
# mantém a resposta leve. As linhas já vêm ordenadas por volumetria desc da
# query (snapshot), então é só cortar as N primeiras.
TABELA_MUNICIPIOS_LIMIT = 100


def _tabela_municipios_from_rows(rows, limit=TABELA_MUNICIPIOS_LIMIT):
    """Top N municípios por volumetria (UF/Regional/Volumetria) — alimenta a
    tabela. Substituiu o mapa de bolhas: sem lat/lon, sem 5500 marcadores e
    sem despejar 5500 linhas no payload, é a mesma leitura de 'onde está o
    tráfego' com uma fração do peso."""
    return {
        "limit": limit,
        "items": [
            {
                "municipio": r.get("municipio") or "N/D",
                "uf": r.get("uf") or "N/D",
                "regional": r.get("regional"),
                "volumetria_pb": round(r.get("volumetria_pb", 0) or 0, 2),
            }
            for r in rows[:limit]
        ],
    }


def get_tabela_municipios(filters):
    """Tabela (top N) de volumetria por município (substituiu o mapa)."""
    return _tabela_municipios_from_rows(_snapshot_rows(filters))


def _rank(rows, key_field, limit=None):
    agg = {}
    for r in rows:
        key = r.get(key_field) or "N/D"
        agg[key] = agg.get(key, 0) + (r.get("volumetria_pb", 0) or 0)
    ranked = sorted(agg.items(), key=lambda kv: kv[1], reverse=True)
    if limit:
        ranked = ranked[:limit]
    return [{"label": k, "value": round(v, 2)} for k, v in ranked]


def get_ranking_municipios(filters, limit=15):
    return {"items": _rank(_snapshot_rows(filters), "municipio", limit)}


def get_ranking_ufs(filters):
    return {"items": _rank(_snapshot_rows(filters), "uf")}


def get_ranking_regionais(filters):
    return {"items": _rank(_snapshot_rows(filters), "regional")}


# ---------------------------------------------------------------------------
# Histórico (12 meses) — KPIs com MoM, tendência nacional, destaques
# ---------------------------------------------------------------------------

def _historico_rows(filters):
    params = {}
    sql = _apply_geo(VOLUMETRIA_HISTORICO_12M, filters, params)
    rows = execute_query(sql, params) or []
    # MES pode voltar do Oracle como NUMBER/Decimal em vez de string (o
    # formato "YYYYMM" descrito pelo usuário é só a representação visual,
    # não garante o tipo da coluna) — normaliza aqui, uma vez só, pra todo
    # o resto do módulo (_mes_label, chaves de dict em
    # _monthly_totals/_top_variacao) poder tratar MES como string sem
    # quebrar com TypeError se vier número.
    for r in rows:
        if r.get("mes") is not None:
            r["mes"] = str(r["mes"]).strip()
    return rows


def _monthly_totals(rows):
    """{mes: total_pb} nacional, ignorando a dimensão geográfica."""
    totals = {}
    for r in rows:
        mes = r.get("mes")
        totals[mes] = totals.get(mes, 0) + (r.get("volumetria_pb", 0) or 0)
    return totals


def _historico_points_from_rows(historico_rows):
    """Série nacional dos 12 meses da janela, com variação MoM em cada
    ponto. O primeiro ponto não tem mês anterior dentro da janela, então
    sai sem variação MoM (variacao_pct = None) — consequência de puxar
    exatamente 12 meses, sem o 13º de base."""
    totals = _monthly_totals(historico_rows)
    meses_ordenados = sorted(totals.keys())
    if not meses_ordenados:
        return {"points": []}

    exibidos = meses_ordenados[-12:]
    base_idx = meses_ordenados.index(exibidos[0])
    anterior_ao_primeiro = meses_ordenados[base_idx - 1] if base_idx > 0 else None

    points = []
    prev_mes = anterior_ao_primeiro
    for mes in exibidos:
        valor = round(totals[mes], 2)
        prev_valor = totals.get(prev_mes) if prev_mes else None
        points.append({
            "mes": mes,
            "label": _mes_label(mes),
            "volumetria_pb": valor,
            "variacao_pct": _pct_change(valor, prev_valor),
        })
        prev_mes = mes
    return {"points": points}


def get_historico_mensal(filters):
    return _historico_points_from_rows(_historico_rows(filters))


def _kpis_from_rows(snapshot_rows, historico_rows):
    """Volume total + top município + top UF, cada um com variação MoM.
    Recebe as linhas já buscadas (snapshot + histórico) em vez de consultar
    o banco — assim get_overview roda cada query pesada uma vez só e
    reaproveita aqui, sem refazer o full-scan. Sem YoY: a janela é de 12
    meses, não alcança o mesmo mês de 1 ano atrás."""
    # snapshot_rows é aceito por simetria/futuro; hoje os KPIs (inclusive o
    # top do mês corrente) saem todos do histórico, que já tem o último mês.
    _ = snapshot_rows
    totals = _monthly_totals(historico_rows)
    meses_ordenados = sorted(totals.keys())

    if not meses_ordenados:
        return {
            "total": {"volumetria_pb": 0, "mom_pct": None},
            "top_municipio": None,
            "top_uf": None,
        }

    mes_atual = meses_ordenados[-1]
    mes_mom = meses_ordenados[-2] if len(meses_ordenados) >= 2 else None

    total_atual = totals[mes_atual]
    total_row = {
        "volumetria_pb": round(total_atual, 2),
        "mom_pct": _pct_change(total_atual, totals.get(mes_mom)) if mes_mom else None,
    }

    def _top_entity(field):
        latest_by_entity = {}
        for r in historico_rows:
            if r.get("mes") != mes_atual:
                continue
            key = r.get(field) or "N/D"
            latest_by_entity[key] = latest_by_entity.get(key, 0) + (r.get("volumetria_pb", 0) or 0)
        if not latest_by_entity:
            return None
        top_key = max(latest_by_entity, key=latest_by_entity.get)

        def _total_for(mes):
            if not mes:
                return None
            total = sum(
                r.get("volumetria_pb", 0) or 0
                for r in historico_rows
                if r.get("mes") == mes and (r.get(field) or "N/D") == top_key
            )
            return total

        atual = latest_by_entity[top_key]
        mom_val = _total_for(mes_mom)
        return {
            "label": top_key,
            "volumetria_pb": round(atual, 2),
            "mom_pct": _pct_change(atual, mom_val) if mom_val else None,
        }

    return {
        "total": total_row,
        "top_municipio": _top_entity("municipio"),
        "top_uf": _top_entity("uf"),
    }


def get_kpis(filters):
    return _kpis_from_rows(_snapshot_rows(filters), _historico_rows(filters))


def _top_variacao(rows, field, mes_atual, mes_anterior, n=5):
    """Maiores altas/quedas (MoM) por `field` (município ou UF)."""
    atual = {}
    anterior = {}
    for r in rows:
        key = r.get(field) or "N/D"
        if r.get("mes") == mes_atual:
            atual[key] = atual.get(key, 0) + (r.get("volumetria_pb", 0) or 0)
        elif r.get("mes") == mes_anterior:
            anterior[key] = anterior.get(key, 0) + (r.get("volumetria_pb", 0) or 0)

    variacoes = []
    for key, valor_atual in atual.items():
        valor_anterior = anterior.get(key)
        # Base mínima pra não deixar ruído de município pequeno dominar o
        # ranking de variação (mesmo espírito do "Base Mín" do painel de
        # referência).
        if not valor_anterior or valor_anterior < 0.01:
            continue
        pct = _pct_change(valor_atual, valor_anterior)
        if pct is None:
            continue
        variacoes.append({
            "label": key,
            "pct": pct,
            "delta_pb": round(valor_atual - valor_anterior, 2),
            "total_pb": round(valor_atual, 2),
        })

    # Cada painel só mostra o lado que promete: "maior crescimento" não
    # deve listar quem na verdade caiu (e vice-versa), mesmo se sobrar
    # vaga no top N por falta de mais entidades no recorte filtrado.
    crescimento = [v for v in variacoes if v["pct"] > 0]
    crescimento.sort(key=lambda v: v["pct"], reverse=True)
    queda = [v for v in variacoes if v["pct"] < 0]
    queda.sort(key=lambda v: v["pct"])
    return crescimento[:n], queda[:n]


def _destaques_from_rows(historico_rows, n=5):
    """Maiores altas/quedas MoM por município e por UF — equivalente ao
    painel 'Destaques de Variação' (mês vs mês anterior)."""
    totals = _monthly_totals(historico_rows)
    meses_ordenados = sorted(totals.keys())
    if len(meses_ordenados) < 2:
        return {
            "mes_atual": meses_ordenados[-1] if meses_ordenados else None,
            "mes_anterior": None,
            "municipios_alta": [], "municipios_queda": [],
            "ufs_alta": [], "ufs_queda": [],
        }

    mes_atual, mes_anterior = meses_ordenados[-1], meses_ordenados[-2]
    mun_alta, mun_queda = _top_variacao(historico_rows, "municipio", mes_atual, mes_anterior, n)
    uf_alta, uf_queda = _top_variacao(historico_rows, "uf", mes_atual, mes_anterior, n)

    return {
        "mes_atual": _mes_label(mes_atual),
        "mes_anterior": _mes_label(mes_anterior),
        "municipios_alta": mun_alta,
        "municipios_queda": mun_queda,
        "ufs_alta": uf_alta,
        "ufs_queda": uf_queda,
    }


def get_destaques_variacao(filters, n=5):
    return _destaques_from_rows(_historico_rows(filters), n)


# ---------------------------------------------------------------------------
# Overview — TUDO do dashboard numa chamada só
# ---------------------------------------------------------------------------

def get_overview(filters):
    """Roda as duas queries pesadas (snapshot + histórico) UMA vez cada e
    deriva todos os blocos do dashboard a partir delas.

    Por que existe: o dashboard tem 7 visões que, se cada uma chamasse
    seu próprio endpoint, disparariam 8 execuções das queries pesadas em
    paralelo (histórico 3x, snapshot 5x) contra um pool de só 5 conexões
    (POOL_MAX). A query de histórico faz full-scan de ALTAIA_PM_MES_4G/5G
    com parsing de string linha a linha — cara mesmo rodando uma vez;
    rodada 3x concorrendo por conexão, a página "nunca" carrega. Aqui é 1
    request → 2 queries, sem contenção. Os endpoints granulares continuam
    existindo (úteis pra debug direto/REST), mas o front usa só este."""
    snapshot_rows = _snapshot_rows(filters)
    historico_rows = _historico_rows(filters)
    return {
        "kpis": _kpis_from_rows(snapshot_rows, historico_rows),
        "historico": _historico_points_from_rows(historico_rows),
        "destaques": _destaques_from_rows(historico_rows),
        "ranking_municipios": {"items": _rank(snapshot_rows, "municipio", 15)},
        "ranking_ufs": {"items": _rank(snapshot_rows, "uf")},
        "ranking_regionais": {"items": _rank(snapshot_rows, "regional")},
        "tabela": _tabela_municipios_from_rows(snapshot_rows),
    }
