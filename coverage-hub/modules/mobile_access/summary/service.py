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

from modules.mobile_access.shared.filters import build_pop_urbana_clause
from modules.mobile_access.shared.constants import (
    TECH_COLORS, TECH_ORDER, DEFAULT_PLAN_YEAR, DEFAULT_CAPEX_SCENARIO,
)
from modules.mobile_access.summary.queries import (
    R1_SITES_VENN,
    R1_SITES_VENN_REGION_CLAUSES,
    R1_SITES_HIERARCHY,
    R1_CITIES_BY_TECH,
    R1_VENDORS,
    R2_NEW_CITIES_BY_ANF,
    R2_VENDORS_NEW_SITES,
    R2_CAC_POR_PROJETO,
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
    "NÃO INFORMADO": "#6c757d",
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
                   projeto_field="r.PRIORIDADE", projeto_key="projeto_filter",
                   anf_field=None, anf_key="anf_filter",
                   pop_field=None, pop_key="pop_urbana_filter"):
    """
    Injeta filtros (uf/município/regional/anf/população urbana/projeto) só
    nos placeholders que o template realmente tem — cada visual referencia
    apenas os campos que fazem sentido pra ele. anf_field/pop_field
    default pro mesmo field do regional (mesma tabela/alias na maioria das
    queries) quando o chamador não especifica outro.
    """
    fields = _template_fields(sql_template)
    anf_field = anf_field or regional_field.replace("REGIONAL", "ANF")
    pop_field = pop_field or regional_field.replace("REGIONAL", "POPULACAO_URBANA")

    # Só constrói a cláusula (e registra binds) para o placeholder que o
    # template realmente tem — um bind sem placeholder correspondente
    # dispararia ORA-01036.
    spec = {
        uf_key: (uf_field, _normalize_list(filters.get("ufs")), "uf"),
        mun_key: (mun_field, _normalize_list(filters.get("municipios")), "mun"),
        regional_key: (regional_field, _normalize_list(filters.get("regionais")), "reg"),
        projeto_key: (projeto_field, _normalize_list(filters.get("projetos")), "proj"),
        anf_key: (anf_field, _normalize_list(filters.get("anfs")), "anf"),
    }
    to_fill = {
        key: _build_in_clause(field, values, prefix, params)
        for key, (field, values, prefix) in spec.items()
        if key in fields
    }
    if pop_key in fields:
        to_fill[pop_key] = build_pop_urbana_clause(pop_field, filters.get("pop_urbana"), params, "pop")
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
        name = r.get("vendor", "NÃO INFORMADO") or "NÃO INFORMADO"
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


def _build_tecnologia_like_clause(field, tecs):
    """Filtro de tecnologia por presença de substring (TECNOLOGIA vem como
    string tipo "2G/3G/4G", mesmo formato de TB_FT_BASE_UNICA_SITES em
    todo o resto do módulo) — "tem pelo menos uma das tecs pedidas", não
    igualdade exata. `tecs` já validado contra TECH_ORDER (whitelist),
    então não há risco de injeção mesmo interpolando o valor."""
    valid = [t.upper() for t in (tecs or []) if t.upper() in TECH_ORDER]
    if not valid:
        return ""
    conds = [f"{field} LIKE '%{t}%'" for t in valid]
    return "AND (" + " OR ".join(conds) + ")"


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
        anf_key="anf_filter_site", pop_key="pop_urbana_filter_site",
    )
    row = (execute_query(sql, params) or [{}])[0]
    return {
        "regions": {key: row.get(key, 0) or 0 for key in VENN_REGION_KEYS},
        "total_sites": row.get("total_sites", 0) or 0,
    }


def get_r1_sites_hierarchy(filters):
    """Árvore de composição de sites (Total de Sites Ativos), mesmo
    universo/baseline de get_r1_sites_venn — só quebrado nas categorias
    de STATUS_END_ID/TIPO_SITE/MOBILE_SITE em vez de tecnologia. As
    categorias intermediárias são somadas aqui em Python a partir das 5
    folhas que vêm do banco (nunca recalculadas em SQL) — assim o total
    do topo SEMPRE fecha por construção, nunca por acaso:

        total_ativos = total_tim_rf_tx + roaming_vivo
          total_tim_rf_tx = sem_rf + mobile_sites
            mobile_sites = tim + ran_sharing
              tim = macro + small_cell_movel_sls
    """
    params, ano_int = _prepare_params(filters)
    params["baseline_date"] = _dt.date(ano_int - 1, 12, 31)

    mun_clause = _build_municipio_ibge_clause(
        "IBGE", _normalize_list(filters.get("municipios")), "mun", params
    )
    template = R1_SITES_HIERARCHY.replace("{municipio_filter_site}", mun_clause)

    sql = _apply_geo_all(
        template, filters, params,
        uf_key="uf_filter_site",
        regional_field="g.REGIONAL", regional_key="regional_filter_site",
        anf_key="anf_filter_site", pop_key="pop_urbana_filter_site",
    )
    row = (execute_query(sql, params) or [{}])[0]

    macro = row.get("macro", 0) or 0
    small_cell_movel_sls = row.get("small_cell_movel_sls", 0) or 0
    ran_sharing = row.get("ran_sharing", 0) or 0
    sem_rf = row.get("sem_rf", 0) or 0
    roaming_vivo = row.get("roaming_vivo", 0) or 0

    tim = macro + small_cell_movel_sls
    mobile_sites = tim + ran_sharing
    total_tim_rf_tx = sem_rf + mobile_sites
    total_ativos = total_tim_rf_tx + roaming_vivo

    return {
        "total_ativos": total_ativos,
        "total_tim_rf_tx": total_tim_rf_tx,
        "sem_rf": sem_rf,
        "mobile_sites": mobile_sites,
        "tim": tim,
        "macro": macro,
        "small_cell_movel_sls": small_cell_movel_sls,
        "ran_sharing": ran_sharing,
        "roaming_vivo": roaming_vivo,
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
    """Fornecedor dominante por site (Raia 1). Ganhou filtro de tecnologia
    (jul/26, pedido do usuário): restringe o universo de sites ao mesmo
    critério de presença usado em "Mobile Sites por Tecnologia"
    (TECNOLOGIA LIKE '%2G%' etc.) — "tem pelo menos uma das tecs
    selecionadas", igual o filtro de tecnologia da FilterBar em Cidades."""
    params, ano_int = _prepare_params(filters)
    params["baseline_date"] = _dt.date(ano_int - 1, 12, 31)

    mun_clause = _build_municipio_end_id_clause(
        _normalize_list(filters.get("municipios")), "mun", params
    )
    tec_clause = _build_tecnologia_like_clause("TECNOLOGIA", filters.get("tecs"))
    template = (
        R1_VENDORS
        .replace("{municipio_filter}", mun_clause)
        .replace("{tecnologia_filter_site}", tec_clause)
    )

    sql = _apply_geo_all(template, filters, params, regional_field="g.REGIONAL")
    rows = execute_query(sql, params) or []
    return _vendor_payload(rows)


# ---------------------------------------------------------------------------
# RAIA 2 — Plano 26
# ---------------------------------------------------------------------------

def get_r2_new_cities_by_anf(filters):
    """
    Novas cidades por REGIONAL (TNE, TCO, TSP, etc.) — PLANO 26.

    Fonte: NTW_OP.REL_CIDADES_PLANEJADO_26, lista fechada (1 linha por IBGE)
    das cidades novas do plano — não tem MES_REF/DT_CARGA, então sem recorte
    de data. Município filtra via ponte IBGE (mesmo padrão de Tráfego/
    Transporte) porque o nome de município nesta tabela pode não bater
    caractere-a-caractere com o nome resolvido no autocomplete do filtro
    (que busca em MUNICIPIOS_FECHAMENTO).
    """
    params = {}
    mun_clause = _build_municipio_ibge_clause(
        "IBGE", _normalize_list(filters.get("municipios")), "mun", params
    )
    template = R2_NEW_CITIES_BY_ANF.replace("{municipio_filter}", mun_clause)

    sql = _apply_geo_all(template, filters, params)
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
        anf_key="anf_filter_d", pop_key="pop_urbana_filter_d",
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


CASA_LABELS = {"CN": "Casa Nova", "CE": "Casa Existente"}


def _linha_cac(projeto, cac_5g, cac_4g, cac_4g_in_5g):
    """Uma linha da tabela de CAC por projeto.

    Arredonda cada célula ANTES de somar (CAC é contagem de endereço —
    fracionário não faz sentido pra quem lê). `total_cac` é só a soma das
    3 camadas pivotadas (5G/4G/4G in 5G) — pedido explícito do usuário
    (jul/26) pra excluir "outras camadas" do cálculo, não só escondê-la da
    tela. A view não fica mais SUM(KPI) bruto nenhum: qualquer KPI fora
    dessas 3 camadas (histórico: B2B Mobile, ver git blame) some do total.

    Sem `valor_mm`: a coluna "Valor (R$ mi)" saiu desta tabela (pedido do
    usuário, jul/26) — o valor financeiro agora só aparece no resumo
    nacional CAPEX 5G x 4G (`_resumo_5g_4g`), ao lado desta tabela.
    """
    c5 = round(cac_5g or 0)
    c4 = round(cac_4g or 0)
    c45 = round(cac_4g_in_5g or 0)
    return {
        "projeto": projeto,
        "cac_5g": c5,
        "cac_4g": c4,
        "cac_4g_in_5g": c45,
        "total_cac": c5 + c4 + c45,
    }


_CAMPOS_CAC = ("cac_5g", "cac_4g", "cac_4g_in_5g", "total_cac")


def _somar_cac(linhas):
    """Subtotal/total somando as células JÁ arredondadas das linhas — o
    total sempre fecha com o que está na tela, não com o bruto do banco."""
    return {campo: sum(l[campo] for l in linhas) for campo in _CAMPOS_CAC}


def _resumo_5g_4g(rows):
    """Resumo nacional CAPEX + Layers por tecnologia (5G x 4G), pro
    visual ao lado da tabela "CAC por Projeto" (mesmo cenário/linhas —
    só agregado mais grosso, sem segmento/projeto).

    "4G in 5G Layers" entra dentro de "4G" aqui (pedido do usuário,
    jul/26) — nas camadas (`CAC_4G` + `CAC_4G_IN_5G`) e no valor
    (`VALOR_4G_MM` já vem somado assim da query). Célula arredondada
    ANTES de somar, mesmo princípio do resto da tabela.
    """
    def cel(v5, v4):
        total = v5 + v4
        return {
            "v5g": v5, "pct5g": round(v5 / total * 100) if total else 0,
            "v4g": v4, "pct4g": round(v4 / total * 100) if total else 0,
            "total": total,
        }

    def layers(subset):
        v5 = sum(round(r.get("cac_5g") or 0) for r in subset)
        v4 = sum(round(r.get("cac_4g") or 0) + round(r.get("cac_4g_in_5g") or 0) for r in subset)
        return v5, v4

    capex_5g = round(sum(round(r.get("valor_5g_mm") or 0, 2) for r in rows), 2)
    capex_4g = round(sum(round(r.get("valor_4g_mm") or 0, 2) for r in rows), 2)
    layers_5g, layers_4g = layers(rows)
    cn_5g, cn_4g = layers([r for r in rows if r["tipo_casa"] == "CN"])
    ce_5g, ce_4g = layers([r for r in rows if r["tipo_casa"] == "CE"])

    return {
        "capex": cel(capex_5g, capex_4g),
        "layers": cel(layers_5g, layers_4g),
        "casa_nova": cel(cn_5g, cn_4g),
        "casa_existente": cel(ce_5g, ce_4g),
    }


def get_r2_cac_por_projeto():
    """CAC do NEXUS em 3 níveis — Casa Nova/Existente > segmento
    (SOURCE_AJUSTADO: TIM, B2B Mobile...) > projeto (DLV_LEVEL_2) — com as
    camadas tecnológicas em colunas, por cenário. Ao lado, um resumo
    nacional CAPEX+Layers por tecnologia (5G x 4G) — mesmo cenário
    escolhido no combo, sem request novo (`_resumo_5g_4g`).

    NACIONAL, sem rateio geográfico (decisão do usuário): a view não tem
    IBGE/UF/município, e ratear por OC aqui não teria significado — o peso
    seria idêntico pra todos os projetos do mesmo (tech, tipo de casa),
    mudando só a magnitude e nunca a composição. O cenário é escolhido no
    front, num combo, sem request novo.
    """
    rows = execute_query(R2_CAC_POR_PROJETO) or []

    # cenário -> linhas cruas (pro resumo 5g x 4g) / tipo_casa -> segmento -> [linhas]
    rows_por_cenario = {}
    por_cenario = {}
    ordem_cenarios = []
    for r in rows:
        cenario = r["scenario"]
        if cenario not in por_cenario:
            por_cenario[cenario] = {"CN": {}, "CE": {}}
            rows_por_cenario[cenario] = []
            ordem_cenarios.append(cenario)
        rows_por_cenario[cenario].append(r)
        tipo_casa = r["tipo_casa"]
        if tipo_casa not in por_cenario[cenario]:
            continue
        segmentos = por_cenario[cenario][tipo_casa]
        segmento = r["segmento"]
        segmentos.setdefault(segmento, []).append(_linha_cac(
            r["projeto"],
            r.get("cac_5g"), r.get("cac_4g"), r.get("cac_4g_in_5g"),
        ))

    cenarios = []
    for cenario in ordem_cenarios:
        grupos = []
        for tipo_casa in ("CN", "CE"):
            segmentos_raw = por_cenario[cenario][tipo_casa]
            if not segmentos_raw:
                continue
            segmentos = []
            for nome, linhas in segmentos_raw.items():
                # Maior CAC primeiro (o SQL ordena alfabético; pra leitura
                # executiva o que importa é onde está o volume).
                linhas.sort(key=lambda l: l["total_cac"], reverse=True)
                segmentos.append({
                    "segmento": nome,
                    "linhas": linhas,
                    "subtotal": _somar_cac(linhas),
                })
            segmentos.sort(key=lambda sg: sg["subtotal"]["total_cac"], reverse=True)
            # Subtotal do grupo soma os SUBTOTAIS dos segmentos (que por sua
            # vez somam as linhas já arredondadas) — a hierarquia fecha em
            # todos os níveis, sem número solto.
            grupos.append({
                "tipo_casa": tipo_casa,
                "label": CASA_LABELS[tipo_casa],
                "segmentos": segmentos,
                "subtotal": _somar_cac([sg["subtotal"] for sg in segmentos]),
            })
        cenarios.append({
            "cenario": cenario,
            "grupos": grupos,
            "total": _somar_cac([g["subtotal"] for g in grupos]),
            "resumo_tech": _resumo_5g_4g(rows_por_cenario[cenario]),
        })

    nomes = [c["cenario"] for c in cenarios]
    cenario_default = (
        DEFAULT_CAPEX_SCENARIO if DEFAULT_CAPEX_SCENARIO in nomes
        else (nomes[0] if nomes else None)
    )
    return {"cenarios": cenarios, "cenario_default": cenario_default}


# ---------------------------------------------------------------------------
# RAIA 2 — Financeiro (NEXUS)
# ---------------------------------------------------------------------------

def get_r2_orcamento_por_tecnologia(filters):
    """CAPEX vs OPEX/LEASE do plano, rateado por OC e quebrado por
    tecnologia (4G/5G) — fonte TB_NEXUS_FINANCEIRO (rótulo na UI:
    "Master (Nexus)").

    Arredondado pra inteiro (jul/26, pedido do usuário: "arredondar todos
    os números referente a valores") — antes ficava com 2 casas decimais,
    que expunham ruído do rateio (frações de R$ mi sem significado pra
    leitura executiva). Arredondar aqui, na origem, propaga pro rótulo do
    gráfico e pro Excel exportado sem precisar de formatação especial em
    cada consumidor.
    """
    params, ano_int = _prepare_params(filters)
    params["ano"] = ano_int

    sql = _apply_geo_all(
        R2_ORCAMENTO_POR_TECNOLOGIA, filters, params,
        uf_field="g.UF", mun_field="g.MUNICIPIO",
        uf_key="uf_filter_g", mun_key="municipio_filter_g",
        regional_field="g.REGIONAL", regional_key="regional_filter_g",
        projeto_field="R.PRIORIDADE",
        anf_key="anf_filter_g", pop_key="pop_urbana_filter_g",
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
                "data": [round(by_key.get((t, grupo), 0)) for t in techs],
            }
            for grupo in grupos
        ],
        "total": round(sum(by_key.values())),
    }


#  Cores DESTE gráfico especificamente (jul/26, pedido do usuário:
# "trocar cores do gráfico [amarelo e vermelho]") — não é o mesmo par de
# CASA_COLORS (verde/azul) usado no resto do portal pra Casa Nova/Casa
# Existente. Local a esta função de propósito: CASA_COLORS continua
# sendo o par "oficial" caso outro visual de CN/CE precise dele no
# futuro; este card pediu uma paleta própria, não uma mudança global.
# Reaproveita os hex já usados em TECH_COLORS (4G amarelo, 3G vermelho) —
# fonte única de cor em vez de inventar hex novo.
_ENDERECO_CORES = {"CN": TECH_COLORS["4G"], "CE": TECH_COLORS["3G"]}


def get_r2_endereco_por_tecnologia(filters):
    """CAC rateado por OC entre Casa Nova (CN) e Casa Existente (CE), por
    tecnologia e por cenário — numerador/denominador do rateio vêm de
    TB_ROLLOUT_ACESSO (responde a UF/município/regional/projeto/ano,
    igual Orçamento por Tecnologia); o CAC total por (tech, tipo_casa)
    vem de VW_CAPEX_MASTER_FULL@NEXUS_LINK. Cenário: o dataset inteiro
    (todos os cenários) cabe numa resposta só, e o front escolhe qual
    mostrar num combo sem request novo — só filtro geo/ano refaz a
    query."""
    params, ano_int = _prepare_params(filters)
    params["ano"] = ano_int

    sql = _apply_geo_all(
        R2_ENDERECO_POR_TECNOLOGIA, filters, params,
        uf_field="g.UF", mun_field="g.MUNICIPIO",
        uf_key="uf_filter_g", mun_key="municipio_filter_g",
        regional_field="g.REGIONAL", regional_key="regional_filter_g",
        projeto_field="RR.PRIORIDADE",
        anf_key="anf_filter_g", pop_key="pop_urbana_filter_g",
    )
    rows = execute_query(sql, params) or []

    techs = ["4G", "5G"]
    classificacoes = ["CN", "CE"]

    valores_por_cenario = {}
    ordem_cenarios = []
    for r in rows:
        cenario = r["scenario"]
        if cenario not in valores_por_cenario:
            valores_por_cenario[cenario] = {}
            ordem_cenarios.append(cenario)
        valores_por_cenario[cenario][(r["tech"], r["classificacao"])] = r.get("valor", 0) or 0

    cenarios = []
    for cenario in ordem_cenarios:
        by_key = valores_por_cenario[cenario]
        # Arredonda pra cima (não pra 2 casas): endereço fracionário
        # (ex.: 0,47) não é uma métrica que bate pra quem lê o card. O
        # total soma os mesmos valores já arredondados das barras, não o
        # bruto, senão total e barras não batem entre si.
        data_by_cell = {
            (t, c): _math.ceil(by_key.get((t, c), 0))
            for t in techs
            for c in classificacoes
        }
        cenarios.append({
            "cenario": cenario,
            "categories": techs,
            "series": [
                {
                    "name": c,
                    "color": _ENDERECO_CORES[c],
                    "data": [data_by_cell[(t, c)] for t in techs],
                }
                for c in classificacoes
            ],
            "total": sum(data_by_cell.values()),
        })

    nomes_cenarios = [c["cenario"] for c in cenarios]
    cenario_default = (
        DEFAULT_CAPEX_SCENARIO if DEFAULT_CAPEX_SCENARIO in nomes_cenarios
        else (nomes_cenarios[0] if nomes_cenarios else None)
    )

    return {"cenarios": cenarios, "cenario_default": cenario_default}


# ---------------------------------------------------------------------------
# RAIA 3 — Fechamento 26 = Raia 1 + Raia 2 (composição)
# ---------------------------------------------------------------------------

def get_r3_new_cities_by_anf(filters):
    """
    Fechamento 26 (projeção) por regional = Base 25 (5G já ativo até
    31/dez/ano-1) + Ganho 26 (cidades novas do PLANO, REL_CIDADES_PLANEJADO_26
    — não "quem já ativou no ano", que é YTD e não o alvo do plano).

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
        "NÃO INFORMADO (Base 25)": "#6c757d",
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

