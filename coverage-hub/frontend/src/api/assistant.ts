import { fetchJson } from "./client";

const BASE = "/mobile-access/api/assistant";

export interface ChatResponse {
  resposta?: string;
  erro?: string;
}

/** Chat é efêmero: session_id vive só em memória do navegador (não
 * persiste em localStorage) — recarregar a página começa uma conversa
 * nova, tanto no front quanto no backend (InMemorySessionService). */
export function enviarPergunta(sessionId: string, pergunta: string): Promise<ChatResponse> {
  return fetchJson<ChatResponse>(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, pergunta }),
  });
}
