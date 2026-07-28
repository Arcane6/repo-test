import { withBasePath } from "./client";

const BASE = "/mobile-access/api/assistant";

export interface ChatEvento {
  /** Pedaço de texto gerado agora (concatenar na ordem de chegada). */
  delta?: string;
  /** Mensagem de erro pronta pra exibir. */
  erro?: string;
  /** Marca o fim do turno. */
  fim?: boolean;
}

/**
 * Consome o SSE do assistente como async iterator.
 *
 * Chat é efêmero: session_id vive só em memória do navegador (não
 * persiste em localStorage) — recarregar a página começa uma conversa
 * nova, tanto no front quanto no backend (InMemorySessionService).
 *
 * Não usa `fetchJson` (que faz `response.json()` do corpo inteiro): aqui
 * o corpo precisa ser lido incrementalmente, senão não existe streaming.
 * O `signal` deixa o botão "Parar" abortar o turno no meio.
 */
export async function* streamPergunta(
  sessionId: string,
  pergunta: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvento> {
  const resposta = await fetch(withBasePath(`${BASE}/chat`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, pergunta }),
    signal,
  });

  if (!resposta.ok || !resposta.body) {
    yield { erro: `Falha ao falar com o assistente (HTTP ${resposta.status}).` };
    return;
  }

  const reader = resposta.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Eventos SSE são separados por linha em branco; o que sobrar no
    // buffer é um evento ainda incompleto — fica pro próximo read().
    const blocos = buffer.split("\n\n");
    buffer = blocos.pop() ?? "";

    for (const bloco of blocos) {
      const linha = bloco.trim();
      if (!linha.startsWith("data:")) continue;
      try {
        yield JSON.parse(linha.slice(5).trim()) as ChatEvento;
      } catch {
        // Evento malformado não derruba a conversa inteira.
      }
    }
  }
}
