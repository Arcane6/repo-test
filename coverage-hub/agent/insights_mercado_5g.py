from datetime import datetime
from urllib.parse import quote_plus
import xml.etree.ElementTree as ET

import requests


_GOOGLE_NEWS_RSS_BASE = "https://news.google.com/rss/search"

_INSIGHTS_5G_CACHE = {}


def buscar_noticias_mercado_5g(
    termo: str = "5G municípios operadoras Brasil lançamento",
    quantidade: int = 10,
    force_reload: bool = False,
) -> str:
    """
    Busca notícias recentes relacionadas a lançamento/expansão de municípios 5G.

    Usa Google News RSS, sem necessidade de API key.

    Parâmetros:
    - termo: termo de busca.
    - quantidade: quantidade máxima de notícias retornadas.
    - force_reload: se True, ignora cache.

    Retorna texto com título, fonte, data e link.
    """

    termo = str(termo).strip()

    if termo == "":
        termo = "5G municípios operadoras Brasil lançamento"

    quantidade = int(quantidade)

    if quantidade <= 0:
        quantidade = 10

    if quantidade > 20:
        quantidade = 20

    chave_cache = (termo.lower(), quantidade)

    if chave_cache in _INSIGHTS_5G_CACHE and not force_reload:
        return _INSIGHTS_5G_CACHE[chave_cache]

    query = quote_plus(termo)

    url = (
        f"{_GOOGLE_NEWS_RSS_BASE}"
        f"?q={query}"
        f"&hl=pt-BR"
        f"&gl=BR"
        f"&ceid=BR:pt-419"
    )

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    response = requests.get(
        url,
        headers=headers,
        timeout=30,
    )

    response.raise_for_status()

    root = ET.fromstring(response.content)

    channel = root.find("channel")

    if channel is None:
        return "Não foi possível ler o feed de notícias."

    itens = channel.findall("item")

    resultados = []

    for item in itens[:quantidade]:
        titulo = item.findtext("title", default="").strip()
        link = item.findtext("link", default="").strip()
        data_publicacao = item.findtext("pubDate", default="").strip()
        fonte = ""

        source = item.find("source")
        if source is not None and source.text:
            fonte = source.text.strip()

        resultados.append(
            {
                "titulo": titulo,
                "fonte": fonte,
                "data_publicacao": data_publicacao,
                "link": link,
            }
        )

    linhas = []

    linhas.append("Notícias encontradas sobre mercado 5G e municípios.")
    linhas.append(f"Termo pesquisado: {termo}")
    linhas.append(f"Consulta realizada em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    linhas.append("")

    if not resultados:
        linhas.append("Nenhuma notícia encontrada.")
    else:
        for i, noticia in enumerate(resultados, start=1):
            linhas.append(f"{i}. {noticia['titulo']}")
            if noticia["fonte"]:
                linhas.append(f"   Fonte: {noticia['fonte']}")
            if noticia["data_publicacao"]:
                linhas.append(f"   Data: {noticia['data_publicacao']}")
            if noticia["link"]:
                linhas.append(f"   Link: {noticia['link']}")
            linhas.append("")

    retorno = "\n".join(linhas)

    _INSIGHTS_5G_CACHE[chave_cache] = retorno

    return retorno

def buscar_fontes_insight_mercado_5g(
    pergunta: str = "",
    quantidade: int = 8
) -> str:
    """
    Busca fontes na web para responder perguntas livres sobre mercado,
    operadoras, lançamento e expansão de municípios com 5G no Brasil.

    Parâmetros:
    - pergunta: pergunta original do usuário.
    - quantidade: quantidade máxima de fontes retornadas.

    A função não responde sozinha à pergunta.
    Ela retorna fontes para o agente interpretar e responder.
    """

    pergunta = str(pergunta).strip()

    if pergunta == "":
        pergunta = "5G municípios operadoras Brasil lançamento cobertura"

    try:
        quantidade = int(quantidade)
    except Exception:
        quantidade = 8

    if quantidade <= 0:
        quantidade = 8

    if quantidade > 15:
        quantidade = 15

    # Complementa a busca para manter o assunto dentro do escopo.
    termo_busca = f"{pergunta} 5G municípios operadoras Brasil lançamento cobertura"

    return buscar_noticias_mercado_5g(
        termo=termo_busca,
        quantidade=quantidade,
        force_reload=False,
    )