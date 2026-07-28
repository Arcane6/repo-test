"""
Service da aba "Assistente" — chat efêmero (sem persistência) com o
agente de IA (agent/agent.py, google-adk) sobre municípios, cobertura,
5G, operadoras e mercado.

Sem streaming (turno completo de uma vez, decisão consciente pra v1 —
ver CLAUDE.md) e sem tabela nova no banco: cada aba do navegador gera um
session_id aleatório (frontend), e o histórico da conversa fica só na
memória do processo (InMemorySessionService do próprio ADK) — reiniciar
o servidor ou trocar de worker do gunicorn zera o histórico, por design.

user_id fixo ("portal") porque o portal inteiro não tem autenticação
individual hoje — quem separa uma conversa da outra é o session_id.
"""

import asyncio

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agent.agent import root_agent

APP_NAME = "coverage_hub_assistant"
_USER_ID = "portal"

_session_service = InMemorySessionService()
_runner = Runner(agent=root_agent, app_name=APP_NAME, session_service=_session_service)


async def _garantir_sessao(session_id: str) -> None:
    sessao = await _session_service.get_session(
        app_name=APP_NAME, user_id=_USER_ID, session_id=session_id
    )
    if sessao is None:
        await _session_service.create_session(
            app_name=APP_NAME, user_id=_USER_ID, session_id=session_id
        )


async def _responder_async(session_id: str, pergunta: str) -> str:
    await _garantir_sessao(session_id)

    mensagem = types.Content(role="user", parts=[types.Part(text=pergunta)])

    texto_final = ""
    async for evento in _runner.run_async(
        user_id=_USER_ID, session_id=session_id, new_message=mensagem
    ):
        if evento.is_final_response() and evento.content and evento.content.parts:
            texto_final = "".join(p.text or "" for p in evento.content.parts)

    return texto_final or "Não consegui gerar uma resposta agora. Tente reformular a pergunta."


def responder(session_id: str, pergunta: str) -> dict:
    """Roda um turno completo do agente (sem streaming) e devolve a
    resposta pronta como texto (markdown — tabelas/SQL vêm formatados
    assim pelas ferramentas do agente)."""
    session_id = (session_id or "").strip()
    pergunta = (pergunta or "").strip()

    if not session_id:
        return {"erro": "session_id é obrigatório."}
    if not pergunta:
        return {"erro": "Digite uma pergunta."}

    try:
        resposta = asyncio.run(_responder_async(session_id, pergunta))
    except Exception as e:
        return {"erro": f"Erro ao consultar o assistente: {e}"}

    return {"resposta": resposta}
