import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { enviarPergunta } from "../api/assistant";

interface Mensagem {
  id: string;
  autor: "usuario" | "assistente";
  texto: string;
  erro?: boolean;
}

const SUGESTOES = [
  "Quais municípios do PR têm maior oportunidade para 5G?",
  "Quantos municípios a TIM tem com 5G hoje?",
  "Com quantos municípios 5G a Claro fechou 2024?",
  "O que a Vivo está planejando lançar em 2026?",
];

/**
 * Chat com o agente de IA (aba "Assistente") — efêmero de propósito:
 * session_id só existe em memória do componente (useState, sem
 * localStorage) e do processo Flask (InMemorySessionService no
 * backend). Recarregar a página ou clicar em "Nova conversa" começa do
 * zero dos dois lados. Sem streaming (decisão de v1, ver CLAUDE.md) —
 * a resposta chega inteira de uma vez, com indicador de "digitando"
 * enquanto espera.
 */
export function AssistantChat() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [carregando, setCarregando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, carregando]);

  async function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || carregando) return;

    const idUsuario = crypto.randomUUID();
    setMensagens((atual) => [...atual, { id: idUsuario, autor: "usuario", texto: pergunta }]);
    setPergunta("");
    setCarregando(true);

    try {
      const resposta = await enviarPergunta(sessionId, pergunta);
      setMensagens((atual) => [
        ...atual,
        {
          id: crypto.randomUUID(),
          autor: "assistente",
          texto: resposta.erro ?? resposta.resposta ?? "Não consegui gerar uma resposta agora.",
          erro: Boolean(resposta.erro),
        },
      ]);
    } catch {
      setMensagens((atual) => [
        ...atual,
        {
          id: crypto.randomUUID(),
          autor: "assistente",
          texto: "Não consegui falar com o assistente agora. Tente de novo em instantes.",
          erro: true,
        },
      ]);
    } finally {
      setCarregando(false);
    }
  }

  function novaConversa() {
    setSessionId(crypto.randomUUID());
    setMensagens([]);
    setPergunta("");
  }

  function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    enviar(pergunta);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar(pergunta);
    }
  }

  return (
    <div className="card shadow-sm tim-assistant-card">
      <div className="card-body d-flex flex-column p-0">
        <div className="tim-assistant-header d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-robot fs-5" style={{ color: "var(--brand-primary)" }} />
            <div>
              <div className="fw-bold">Assistente de Acesso Móvel</div>
              <small className="text-muted">
                Municípios, cobertura, presença por tecnologia, 5G, operadoras e mercado
              </small>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={novaConversa}
            disabled={mensagens.length === 0}
          >
            <i className="bi bi-arrow-counterclockwise me-1" /> Nova conversa
          </button>
        </div>

        <div className="tim-assistant-messages" ref={listaRef}>
          {mensagens.length === 0 && (
            <div className="tim-assistant-empty">
              <p className="text-muted mb-3">
                Pergunte algo sobre municípios, cobertura móvel, 5G, operadoras ou mercado —
                por exemplo:
              </p>
              <div className="d-flex flex-column gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="btn btn-sm btn-outline-primary text-start"
                    onClick={() => enviar(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((m) => (
            <div
              key={m.id}
              className={`tim-assistant-bubble-row ${m.autor === "usuario" ? "tim-assistant-bubble-row--user" : ""}`}
            >
              <div
                className={
                  "tim-assistant-bubble" +
                  (m.autor === "usuario" ? " tim-assistant-bubble--user" : "") +
                  (m.erro ? " tim-assistant-bubble--erro" : "")
                }
              >
                {m.autor === "assistente" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.texto}</ReactMarkdown>
                ) : (
                  <span>{m.texto}</span>
                )}
              </div>
            </div>
          ))}

          {carregando && (
            <div className="tim-assistant-bubble-row">
              <div className="tim-assistant-bubble tim-assistant-bubble--typing">
                <span className="tim-assistant-dot" />
                <span className="tim-assistant-dot" />
                <span className="tim-assistant-dot" />
              </div>
            </div>
          )}
        </div>

        <form className="tim-assistant-input" onSubmit={aoSubmeter}>
          <textarea
            className="form-control"
            placeholder="Pergunte sobre municípios, cobertura, 5G, operadoras ou mercado..."
            rows={1}
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={aoTeclar}
            disabled={carregando}
          />
          <button type="submit" className="btn btn-primary" disabled={carregando || !pergunta.trim()}>
            <i className="bi bi-send-fill" />
          </button>
        </form>
      </div>
    </div>
  );
}
