"""
Service do módulo Transporte (perfil de infraestrutura de TX + migração).

Regras de negócio:
- **Mídia** = 1º token do TIPO_TX (FO/MW/SAT/LL/SLS/N/I); vazio → "Não
  definido". **RanSharing** (CLASSIFICACAO='RANSHARING') sobrescreve a mídia
  pra **RS** — o usuário pediu RS como um dos tipos, e ele não existe no
  TIPO_TX. (Se um dia quiser RS sem sobrescrever a mídia física, é só tirar
  o override em `_media`.)
- **Capacidade** = 2º token (10G/1G/<1G) ou "Outros" (LEO/IPSEC/...).
- **Fiberização** = FO ÷ sites com mídia definida (exclui "Não definido").
- **% 10G** = sites 10G ÷ sites com capacidade conhecida.
- **Raias**: Fechamento 2025 = TIPO_TX_25 · Plano 26 = TIPO_TX_PLAN (só os
  sites com plano explícito, ~ poucos) · Fechamento 26 = TIPO_TX_26.
"""

from database.oracle import execute_query

from modules.transport.queries import TX_PROFILE

MEDIA_ORDER = ["FO", "MW", "RS", "SAT", "LL", "SLS", "N/I", "Não definido"]
MEDIA_TOKENS = {"FO", "MW", "SAT", "LL", "SLS"}
CAP_ORDER = ["10G", "1G", "<1G", "Outros"]


# ---------------------------------------------------------------------------
# Filtros (UF direto, Município via ponte IBGE — igual Tráfego)
# ---------------------------------------------------------------------------

def _normalize_list(value):
    if not value:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()]


def _build_uf_clause(values, params):
    if not values:
        return ""
    ph = []
    for i, v in enumerate(values):
        key = f"uf_{i}"
        params[key] = v.upper()
        ph.append(f":{key}")
    return f"AND UPPER(TRIM(UF)) IN ({', '.join(ph)})"


def _build_regional_clause(values, params):
    if not values:
        return ""
    ph = []
    for i, v in enumerate(values):
        key = f"reg_{i}"
        params[key] = v.upper()
        ph.append(f":{key}")
    return f"AND UPPER(TRIM(REGIONAL)) IN ({', '.join(ph)})"


def _build_municipio_clause(values, params):
    """Ponte por IBGE (mesma de Tráfego/sites): resolve nome → IBGE via
    MUNICIPIOS_FECHAMENTO e filtra IBGE_ID (6 dígitos)."""
    if not values:
        return ""
    ph = []
    for i, v in enumerate(values):
        key = f"mun_{i}"
        params[key] = v
        ph.append(f":{key}")
    in_list = ", ".join(ph)
    return f"""AND TO_CHAR(IBGE_ID) IN (
        SELECT SUBSTR(TO_CHAR(IBGE), 1, 6)
        FROM NTW_OP.MUNICIPIOS_FECHAMENTO
        WHERE TRUNC(DT_CARGA) = (SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO)
        AND MUNICIPIO IN ({in_list})
    )"""


def _rows(filters):
    params = {}
    sql = TX_PROFILE.format(
        uf_filter=_build_uf_clause(_normalize_list(filters.get("ufs")), params),
        municipio_filter=_build_municipio_clause(_normalize_list(filters.get("municipios")), params),
        regional_filter=_build_regional_clause(_normalize_list(filters.get("regionais")), params),
    )
    return execute_query(sql, params) or []


# ---------------------------------------------------------------------------
# Parsing de mídia / capacidade
# ---------------------------------------------------------------------------

def _media(tipo_tx, classificacao):
    if str(classificacao or "").strip().upper() == "RANSHARING":
        return "RS"
    tt = str(tipo_tx or "").strip()
    if not tt:
        return "Não definido"
    tok = tt.split()[0].upper()
    if tok == "N/I":
        return "N/I"
    return tok if tok in MEDIA_TOKENS else "N/I"


def _capacity(tipo_tx):
    parts = str(tipo_tx or "").strip().split(None, 1)
    if len(parts) < 2:
        return None
    cap = parts[1].strip().upper()
    return cap if cap in {"10G", "1G", "<1G"} else "Outros"


def _ordered_media(counts):
    known = [m for m in MEDIA_ORDER if counts.get(m)]
    extra = [m for m in counts if m not in MEDIA_ORDER and counts.get(m)]
    return known + sorted(extra)


def _media_counts(rows, tx_key):
    agg = {}
    for r in rows:
        m = _media(r.get(tx_key), r.get("classificacao"))
        agg[m] = agg.get(m, 0) + 1
    return agg


# ---------------------------------------------------------------------------
# Perfil por raia
# ---------------------------------------------------------------------------

def _perfil(rows, tx_key):
    media_counts = {}
    cap_counts = {}
    for r in rows:
        m = _media(r.get(tx_key), r.get("classificacao"))
        media_counts[m] = media_counts.get(m, 0) + 1
        c = _capacity(r.get(tx_key))
        if c:
            cap_counts[c] = cap_counts.get(c, 0) + 1

    total = len(rows)
    definidos = total - media_counts.get("Não definido", 0)
    fo = media_counts.get("FO", 0)
    cap_total = sum(cap_counts.values())
    return {
        "total_sites": total,
        "definidos": definidos,
        "pct_fibra": round(fo / definidos * 100, 1) if definidos else None,
        "pct_10g": round(cap_counts.get("10G", 0) / cap_total * 100, 1) if cap_total else None,
        "por_midia": [{"label": m, "value": media_counts[m]} for m in _ordered_media(media_counts)],
        "por_capacidade": [{"label": c, "value": cap_counts[c]} for c in CAP_ORDER if cap_counts.get(c)],
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

def get_resumo_executivo(filters):
    """3 raias: Fechamento 2025 (TX_25) · Plano 26 (TX_PLAN) · Fechamento 26
    (TX_26). A raia Plano usa só os sites com plano explícito de
    transformação (TIPO_TX_PLAN preenchido)."""
    rows = _rows(filters)

    fechamento_2025 = _perfil(rows, "tipo_tx_25")
    fechamento_26 = _perfil(rows, "tipo_tx_26")

    # Plano 26: só quem tem transformação planejada (TX_PLAN preenchido) — o
    # resto fica como está, então não faz sentido no denominador do plano.
    rows_plano = [r for r in rows if str(r.get("tipo_tx_plan") or "").strip()]
    plano_26 = _perfil(rows_plano, "tipo_tx_plan")

    # Variação de mídia 25→26 (pro destaque da raia Fechamento 26).
    m25 = _media_counts(rows, "tipo_tx_25")
    m26 = _media_counts(rows, "tipo_tx_26")
    medias = _ordered_media({**m25, **m26})
    fechamento_26["variacao"] = [
        {"label": m, "delta": m26.get(m, 0) - m25.get(m, 0)}
        for m in medias if m not in ("Não definido",)
    ]

    return {
        "fechamento_2025": fechamento_2025,
        "plano_26": plano_26,
        "fechamento_26": fechamento_26,
    }


def get_composicao(filters):
    """Aba 2 — Composição & Migração 25×26."""
    rows = _rows(filters)
    m25 = _media_counts(rows, "tipo_tx_25")
    m26 = _media_counts(rows, "tipo_tx_26")

    # Barras 25×26 por mídia (a "variação de composição por tipo" pedida).
    medias = [m for m in _ordered_media({**m25, **m26}) if m != "Não definido"]
    por_midia = [
        {"midia": m, "c25": m25.get(m, 0), "c26": m26.get(m, 0), "delta": m26.get(m, 0) - m25.get(m, 0)}
        for m in medias
    ]

    # Fluxos de migração 25→26 (só quem mudou de mídia, ambas definidas).
    mig = {}
    for r in rows:
        a = _media(r.get("tipo_tx_25"), r.get("classificacao"))
        b = _media(r.get("tipo_tx_26"), r.get("classificacao"))
        if a != b and "Não definido" not in (a, b):
            mig[(a, b)] = mig.get((a, b), 0) + 1
    migracao = [
        {"de": k[0], "para": k[1], "value": v}
        for k, v in sorted(mig.items(), key=lambda kv: kv[1], reverse=True)
    ][:10]

    # MAKE × BUY (estratégia de construção de fibra).
    make_buy = {}
    for r in rows:
        mm = str(r.get("metodo_construtivo_fo") or "").strip() or "N/D"
        make_buy[mm] = make_buy.get(mm, 0) + 1
    make_buy_items = [
        {"label": k, "value": v}
        for k, v in sorted(make_buy.items(), key=lambda kv: kv[1], reverse=True)
        if k != "N/D"
    ]

    # Fiberização por regional (onde a fibra está adiantada/atrasada), base 26.
    reg = {}
    for r in rows:
        rg = str(r.get("regional") or "N/D").strip() or "N/D"
        d = reg.setdefault(rg, {"total": 0, "definidos": 0, "fo": 0})
        m = _media(r.get("tipo_tx_26"), r.get("classificacao"))
        d["total"] += 1
        if m != "Não definido":
            d["definidos"] += 1
        if m == "FO":
            d["fo"] += 1
    por_regional = sorted(
        [
            {"regional": k, "total": v["total"],
             "pct_fibra": round(v["fo"] / v["definidos"] * 100, 1) if v["definidos"] else 0.0}
            for k, v in reg.items()
        ],
        key=lambda x: x["pct_fibra"], reverse=True,
    )

    # Fiberização por tecnologia de rádio servida (presença), base 26 —
    # crítico: sites 5G precisam de fibra de alta capacidade.
    tec = {t: {"total": 0, "fo": 0} for t in ["2G", "3G", "4G", "5G"]}
    for r in rows:
        tecs = str(r.get("tecnologia") or "")
        m = _media(r.get("tipo_tx_26"), r.get("classificacao"))
        for t in ["2G", "3G", "4G", "5G"]:
            if t in tecs:
                tec[t]["total"] += 1
                if m == "FO":
                    tec[t]["fo"] += 1
    por_tecnologia = [
        {"tec": t, "total": tec[t]["total"],
         "pct_fibra": round(tec[t]["fo"] / tec[t]["total"] * 100, 1) if tec[t]["total"] else 0.0}
        for t in ["2G", "3G", "4G", "5G"]
    ]

    return {
        "por_midia": por_midia,
        "migracao": migracao,
        "make_buy": make_buy_items,
        "por_regional": por_regional,
        "por_tecnologia": por_tecnologia,
    }
