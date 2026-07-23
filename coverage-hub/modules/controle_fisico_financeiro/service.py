"""
Service do módulo Controle Físico-Financeiro.

Primeira parte do portal que ESCREVE no Oracle (ver database/oracle.py —
execute_write_many). Padrão EVENT LOG: toda edição feita na grid vira um
novo evento (INSERT), nunca um UPDATE na linha existente. O "estado atual"
mostrado na grid é sempre o evento de maior ID_EVENTO por ITEM_ID.

Camadas disponíveis: acesso, transporte (Core fica de fora por enquanto).
"""

import uuid

from database.oracle import execute_query, execute_write_many

from modules.controle_fisico_financeiro import queries as q

CAMADAS = {
    "acesso": {
        "key": "acesso",
        "label": "Acesso",
        "dimensao_1": {"campo": "tecnologia", "label": "Tecnologia", "opcoes": ["2G", "3G", "4G", "5G"]},
        "dimensao_2": {"campo": "classificacao_casa", "label": "Classificação", "opcoes": ["CASA NOVA", "CASA EXISTENTE"]},
    },
    "transporte": {
        "key": "transporte",
        "label": "Transporte",
        "dimensao_1": {"campo": "midia", "label": "Mídia", "opcoes": ["FO", "MW", "SAT", "LL", "SLS"]},
        "dimensao_2": {"campo": "capacidade", "label": "Capacidade", "opcoes": ["10G", "1G", "<1G", "Outros"]},
    },
}


def is_camada_valida(camada):
    return camada in CAMADAS


def get_camadas():
    return {
        "camadas": list(CAMADAS.values()),
        "status_options": q.STATUS_OPTIONS,
        "tipo_evento_options": q.TIPO_EVENTO_OPTIONS,
    }


# ---------------------------------------------------------------------------
# Filtros (mesma ponte por IBGE usada em Tráfego/Transporte)
# ---------------------------------------------------------------------------

def _normalize_list(value):
    if not value:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()]


def _in_clause(column, values, params, key_prefix):
    if not values:
        return ""
    ph = []
    for i, v in enumerate(values):
        key = f"{key_prefix}_{i}"
        params[key] = v
        ph.append(f":{key}")
    return f" AND {column} IN ({', '.join(ph)})"


def _build_filters(filters):
    params = {"camada": filters["camada"]}
    clause = ""
    clause += _in_clause("UPPER(TRIM(UF))", [v.upper() for v in _normalize_list(filters.get("ufs"))], params, "uf")
    clause += _in_clause("REGIONAL", _normalize_list(filters.get("regionais")), params, "reg")
    clause += _in_clause("PROJETO", _normalize_list(filters.get("projetos")), params, "proj")
    clause += _in_clause("STATUS", _normalize_list(filters.get("status")), params, "st")

    ano = filters.get("ano_plano")
    if ano:
        params["ano_plano"] = int(ano)
        clause += " AND ANO_PLANO = :ano_plano"

    municipios = _normalize_list(filters.get("municipios"))
    if municipios:
        ph = []
        for i, v in enumerate(municipios):
            key = f"mun_{i}"
            params[key] = v
            ph.append(f":{key}")
        in_list = ", ".join(ph)
        clause += f""" AND TO_CHAR(IBGE_ID) IN (
            SELECT SUBSTR(TO_CHAR(IBGE), 1, 6)
            FROM NTW_OP.MUNICIPIOS_FECHAMENTO
            WHERE TRUNC(DT_CARGA) = (SELECT TRUNC(MAX(DT_CARGA)) FROM NTW_OP.MUNICIPIOS_FECHAMENTO)
            AND MUNICIPIO IN ({in_list})
        )"""

    return clause, params


def get_estado_atual(camada, filters):
    filters = {**filters, "camada": camada}
    clause, params = _build_filters(filters)
    rows = execute_query(q.estado_atual_sql(clause), params) or []
    return {"rows": rows, "total": len(rows)}


def get_historico(camada, item_id):
    rows = execute_query(q.historico_item_sql(), {"camada": camada, "item_id": item_id}) or []
    return {"rows": rows, "total": len(rows)}


def get_opcoes(camada):
    dim1_col, dim2_col = q.DIM_COLUMNS[camada]
    opcoes = {}
    for column in q.FILTER_COLUMNS:
        rows = execute_query(q.opcoes_sql(camada, column)) or []
        opcoes[column.lower()] = [r["label"] for r in rows if r.get("label")]
    for column in (dim1_col, dim2_col):
        rows = execute_query(q.opcoes_sql(camada, column)) or []
        opcoes[column.lower()] = [r["label"] for r in rows if r.get("label")]
    return opcoes


# ---------------------------------------------------------------------------
# Escrita — cada edição na grid = 1 evento novo (INSERT), nunca UPDATE
# ---------------------------------------------------------------------------

_REQUIRED_FIELDS = ["projeto", "ano_plano", "status", "tipo_evento"]


class ValidationError(Exception):
    pass


def _validar_evento(evento):
    for field in _REQUIRED_FIELDS:
        if not evento.get(field):
            raise ValidationError(f"Campo obrigatório ausente: {field}")
    if evento["status"] not in q.STATUS_OPTIONS:
        raise ValidationError(f"status inválido: {evento['status']}")
    if evento["tipo_evento"] not in q.TIPO_EVENTO_OPTIONS:
        raise ValidationError(f"tipo_evento inválido: {evento['tipo_evento']}")


def create_eventos(camada, usuario, eventos):
    """Recebe uma lista de lançamentos (linhas coladas/editadas na grid) e
    grava cada um como um novo evento. Linhas sem item_id são um item novo
    (ITEM_ID gerado aqui); linhas com item_id são uma atualização do item
    existente — mas sempre via INSERT de um novo evento, nunca UPDATE."""
    params_list = []
    for evento in eventos:
        _validar_evento(evento)
        item_id = evento.get("item_id") or uuid.uuid4().hex
        params_list.append({
            "item_id": item_id,
            "projeto": evento["projeto"],
            "ano_plano": int(evento["ano_plano"]),
            "ibge_id": evento.get("ibge_id"),
            "uf": evento.get("uf"),
            "municipio": evento.get("municipio"),
            "regional": evento.get("regional"),
            "dim1": evento.get("dimensao_1"),
            "dim2": evento.get("dimensao_2"),
            "status": evento["status"],
            "data_planejada": evento.get("data_planejada"),
            "data_realizada": evento.get("data_realizada"),
            "valor_planejado": evento.get("valor_planejado"),
            "valor_realizado": evento.get("valor_realizado"),
            "moeda": evento.get("moeda") or "BRL",
            "tipo_evento": evento["tipo_evento"],
            "usuario_lancamento": usuario,
            "observacao": evento.get("observacao"),
        })

    affected = execute_write_many(q.insert_evento_sql(camada), params_list)
    return {"inseridos": affected}
