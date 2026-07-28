import { useCallback, useRef, useState } from "react";
import { streamPergunta } from "../api/assistant";

export interface Mensagem {
  id: string;
  autor: "usuario" | "assistente";
  texto: string;
  erro?: boolean;
  /** Turno ainda chegando — usado pro cursor piscando. */
  streaming?: boolean;
}

/**
 * Estado + streaming da conversa, separado da UI: o componente cuida de
 * layout, o hook cuida de "o que é uma conversa".
 *
 * Efêmero por design — session_id nasce de um `crypto.randomUUID()` em
 * memória (sem localStorage), então F5 ou "Nova conversa" recomeçam do
 * zero nos dois lados (ver CLAUDE.md).
 */
export function useAssistantChat() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const atualizarUltima = useCallback((patch: Partial<Mensagem>) => {
    setMensagens((atual) => {
      if (atual.length === 0) return atual;
      const copia = [...atual];
      copia[copia.length - 1] = { ...copia[copia.length - 1], ...patch };
      return copia;
    });
  }, []);

  const enviar = useCallback(
    async (texto: string) => {
      const pergunta = texto.trim();
      if (!pergunta || carregando) return;

      const controller = new AbortController();
      abortRef.current = controller;

      setMensagens((atual) => [
        ...atual,
        { id: crypto.randomUUID(), autor: "usuario", texto: pergunta },
        { id: crypto.randomUUID(), autor: "assistente", texto: "", streaming: true },
      ]);
      setCarregando(true);

      try {
        for await (const evento of streamPergunta(sessionId, pergunta, controller.signal)) {
          if (evento.erro) {
            atualizarUltima({ texto: evento.erro, erro: true, streaming: false });
            break;
          }
          if (evento.delta) {
            const delta = evento.delta;
            setMensagens((atual) => {
              const copia = [...atual];
              const ultima = copia[copia.length - 1];
              copia[copia.length - 1] = { ...ultima, texto: ultima.texto + delta };
              return copia;
            });
          }
        }
      } catch (e) {
        // Abort é ação do usuário (botão "Parar"), não erro: mantém o
        // texto que já chegou em vez de trocar por mensagem de falha.
        if ((e as Error)?.name !== "AbortError") {
          atualizarUltima({
            texto: "Não consegui falar com o assistente agora. Tente de novo em instantes.",
            erro: true,
          });
        }
      } finally {
        atualizarUltima({ streaming: false });
        setCarregando(false);
        abortRef.current = null;
      }
    },
    [sessionId, carregando, atualizarUltima],
  );

  const parar = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const novaConversa = useCallback(() => {
    abortRef.current?.abort();
    setSessionId(crypto.randomUUID());
    setMensagens([]);
  }, []);

  return { mensagens, carregando, enviar, parar, novaConversa };
}
