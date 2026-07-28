import { useEffect, useRef } from "react";
import { useAssistantChat } from "../../hooks/useAssistantChat";
import { ChatComposer } from "./ChatComposer";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatMessage } from "./ChatMessage";

/**
 * Chat com o agente de IA (aba "Assistente").
 *
 * Layout: card de altura fixa (nunca "estoura" a página) com uma única
 * área rolável no meio — cabeçalho e composer ficam sempre visíveis. A
 * conversa mora numa coluna de leitura centralizada e limitada; sem
 * isso, num monitor wide a linha de texto passava de 1000px e a leitura
 * ficava desconfortável.
 */
export function AssistantChat() {
  const { mensagens, carregando, enviar, parar, novaConversa } = useAssistantChat();
  const listaRef = useRef<HTMLDivElement>(null);
  const grudadoNoFimRef = useRef(true);

  // Auto-scroll durante o streaming, mas só enquanto o usuário está no
  // fim da lista: se ele rolou pra cima pra reler algo, o texto chegando
  // não pode arrastar a tela de volta.
  useEffect(() => {
    const el = listaRef.current;
    if (!el || !grudadoNoFimRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [mensagens]);

  function aoRolar() {
    const el = listaRef.current;
    if (!el) return;
    const distanciaDoFim = el.scrollHeight - el.scrollTop - el.clientHeight;
    grudadoNoFimRef.current = distanciaDoFim < 80;
  }

  function enviarGrudando(texto: string) {
    grudadoNoFimRef.current = true;
    enviar(texto);
  }

  return (
    <div className="card shadow-sm tim-assistant">
      <div className="tim-assistant-header">
        <div className="d-flex align-items-center gap-2">
          <span className="tim-assistant-avatar tim-assistant-avatar--header">
            <i className="bi bi-robot" />
          </span>
          <div>
            <div className="tim-assistant-title">Assistente de Acesso Móvel</div>
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

      <div className="tim-assistant-messages" ref={listaRef} onScroll={aoRolar}>
        {mensagens.length === 0 ? (
          <ChatEmptyState onEscolher={enviarGrudando} />
        ) : (
          <div className="tim-assistant-thread">
            {mensagens.map((m) => (
              <ChatMessage key={m.id} mensagem={m} />
            ))}
          </div>
        )}
      </div>

      <ChatComposer carregando={carregando} onEnviar={enviarGrudando} onParar={parar} />
    </div>
  );
}
