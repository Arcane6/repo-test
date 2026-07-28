import type { Mensagem } from "../../hooks/useAssistantChat";
import { ChatMarkdown } from "./ChatMarkdown";

/**
 * Uma mensagem da conversa.
 *
 * Assimetria proposital (mesmo idioma do ChatGPT/Claude): a pergunta do
 * usuário é curta e ganha bolha compacta à direita; a resposta do agente
 * é um bloco de documento (tabela, lista, SQL) e fica SEM bolha, só com
 * avatar à esquerda. Enfiar uma tabela de 20 linhas dentro de um balão
 * cinza arredondado é o que fazia a tela parecer "esquisita" na v1.
 */
export function ChatMessage({ mensagem }: { mensagem: Mensagem }) {
  if (mensagem.autor === "usuario") {
    return (
      <div className="tim-assistant-row tim-assistant-row--user">
        <div className="tim-assistant-bubble-user">{mensagem.texto}</div>
      </div>
    );
  }

  return (
    <div className="tim-assistant-row">
      <div className="tim-assistant-avatar" aria-hidden="true">
        <i className="bi bi-robot" />
      </div>

      <div className="tim-assistant-body">
        {mensagem.erro ? (
          <div className="tim-assistant-erro">
            <i className="bi bi-exclamation-triangle-fill" />
            <span>{mensagem.texto}</span>
          </div>
        ) : mensagem.texto ? (
          <div className={mensagem.streaming ? "tim-assistant-caret" : undefined}>
            <ChatMarkdown texto={mensagem.texto} />
          </div>
        ) : (
          /* Turno aberto mas nenhum texto ainda: o agente pode estar
             rodando uma ferramenta (SQL/scraping) antes de responder. */
          <div className="tim-assistant-typing" role="status" aria-label="Gerando resposta">
            <span className="tim-assistant-dot" />
            <span className="tim-assistant-dot" />
            <span className="tim-assistant-dot" />
          </div>
        )}
      </div>
    </div>
  );
}
