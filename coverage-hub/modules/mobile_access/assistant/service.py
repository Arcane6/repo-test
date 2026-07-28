"""
Service da aba "Assistente" — chat efêmero (sem persistência) com o
agente de IA (agent/agent.py, google-adk) sobre municípios, cobertura,
5G, operadoras e mercado.

Com streaming (v2): `responder_stream()` é um gerador SÍNCRONO de deltas
de texto, feito pra ser servido como SSE pela rota. O turno inteiro do
Runner (async) roda num event loop próprio por request — o resto do
projeto continua 100% síncrono, sem view assíncrona nem worker especial
no gunicorn.

Sem tabela nova no banco: cada aba do navegador gera um session_id
aleatório (frontend), e o histórico da conversa fica só na memória do
processo (InMemorySessionService do próprio ADK) — reiniciar o servidor
ou trocar de worker do gunicorn zera o histórico, por design.

user_id fixo ("portal") porque o portal inteiro não tem autenticação
individual hoje — quem separa uma conversa da outra é o session_id.
"""

import asyncio

from google.adk.agents.run_config import RunConfig
from google.adk.agents.run_config import StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agent.agent import root_agent

APP_NAME = "coverage_hub_assistant"
_USER_ID = "portal"

_session_service = InMemorySessionService()
_runner = Runner(agent=root_agent, app_name=APP_NAME, session_service=_session_service)

# StreamingMode.SSE faz o Runner emitir eventos parciais (evento.partial)
# com pedaços de texto conforme o modelo gera, em vez de só a resposta
# fechada no fim do turno.
_RUN_CONFIG = RunConfig(streaming_mode=StreamingMode.SSE)


async def _garantir_sessao(session_id: str) -> None:
    sessao = await _session_service.get_session(
        app_name=APP_NAME, user_id=_USER_ID, session_id=session_id
    )
    if sessao is None:
        await _session_service.create_session(
            app_name=APP_NAME, user_id=_USER_ID, session_id=session_id
        )


def _texto_do_evento(evento) -> str:
    if not evento.content or not evento.content.parts:
        return ""
    return "".join(p.text or "" for p in evento.content.parts)


async def _deltas_async(session_id: str, pergunta: str):
    """Deltas de texto do turno, na ordem em que o modelo gera."""
    await _garantir_sessao(session_id)

    mensagem = types.Content(role="user", parts=[types.Part(text=pergunta)])

    acumulado = ""
    async for evento in _runner.run_async(
        user_id=_USER_ID,
        session_id=session_id,
        new_message=mensagem,
        run_config=_RUN_CONFIG,
    ):
        texto = _texto_do_evento(evento)
        if not texto:
            continue

        if evento.partial:
            acumulado += texto
            yield texto
        elif evento.is_final_response():
            # O evento final traz o texto AGREGADO do trecho — emitir ele
            # inteiro duplicaria tudo que já saiu como delta. Só mandamos
            # o que ainda falta (ou o texto todo, quando não houve
            # streaming nenhum: a resposta pode vir fechada de uma vez,
            # por exemplo logo depois de uma chamada de ferramenta).
            if not acumulado:
                yield texto
            elif texto.startswith(acumulado) and len(texto) > len(acumulado):
                yield texto[len(acumulado):]
            acumulado = ""


def responder_stream(session_id: str, pergunta: str):
    """
    Gerador síncrono de dicts prontos pra virar evento SSE:
    `{"delta": "..."}` conforme o texto sai, ou `{"erro": "..."}`.

    Uma resposta sem streaming de verdade continua funcionando: vira
    simplesmente um único delta com o texto inteiro — o frontend só
    concatena deltas, não muda nada dos dois lados.
    """
    session_id = (session_id or "").strip()
    pergunta = (pergunta or "").strip()

    if not session_id:
        yield {"erro": "session_id é obrigatório."}
        return
    if not pergunta:
        yield {"erro": "Digite uma pergunta."}
        return

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    agen = _deltas_async(session_id, pergunta)
    houve_texto = False
    try:
        while True:
            try:
                delta = loop.run_until_complete(agen.__anext__())
            except StopAsyncIteration:
                break
            houve_texto = True
            yield {"delta": delta}
        if not houve_texto:
            yield {"erro": "Não consegui gerar uma resposta agora. Tente reformular a pergunta."}
    except Exception as e:
        yield {"erro": f"Erro ao consultar o assistente: {e}"}
    finally:
        try:
            loop.run_until_complete(agen.aclose())
        except Exception:
            pass
        asyncio.set_event_loop(None)
        loop.close()
