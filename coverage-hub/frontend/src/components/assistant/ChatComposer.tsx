import { useState } from "react";
import TextareaAutosize from "react-textarea-autosize";

interface Props {
  carregando: boolean;
  onEnviar: (texto: string) => void;
  onParar: () => void;
}

export function ChatComposer({ carregando, onEnviar, onParar }: Props) {
  const [texto, setTexto] = useState("");

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (carregando || !texto.trim()) return;
    onEnviar(texto);
    setTexto("");
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!carregando && texto.trim()) {
        onEnviar(texto);
        setTexto("");
      }
    }
  }

  return (
    <form className="tim-assistant-composer" onSubmit={submeter}>
      <div className="tim-assistant-composer-inner">
        <div className="tim-assistant-field">
          <TextareaAutosize
            minRows={1}
            maxRows={6}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Pergunte sobre municípios, cobertura, 5G, operadoras ou mercado..."
            aria-label="Sua pergunta"
          />

          {/* Enquanto gera, o botão vira "parar" — sem isso uma resposta
              longa prende o usuário até o fim do turno. */}
          {carregando ? (
            <button
              type="button"
              className="tim-assistant-send tim-assistant-send--stop"
              onClick={onParar}
              title="Parar de gerar"
              aria-label="Parar de gerar"
            >
              <i className="bi bi-stop-fill" />
            </button>
          ) : (
            <button
              type="submit"
              className="tim-assistant-send"
              disabled={!texto.trim()}
              title="Enviar"
              aria-label="Enviar pergunta"
            >
              <i className="bi bi-arrow-up" />
            </button>
          )}
        </div>

        <p className="tim-assistant-hint">
          <kbd>Enter</kbd> envia · <kbd>Shift</kbd>+<kbd>Enter</kbd> quebra linha · o
          assistente pode errar — confira números críticos na fonte.
        </p>
      </div>
    </form>
  );
}
