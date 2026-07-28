import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown das respostas do agente. O agente devolve tabela (GFM) e
 * bloco de SQL com frequência, então a tabela ganha um wrapper com
 * `overflow-x: auto` — sem isso uma tabela larga empurra a coluna de
 * leitura inteira e cria scroll horizontal na página (regra do design
 * system: conteúdo largo rola dentro do próprio container).
 */
export function ChatMarkdown({ texto }: { texto: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children }) => (
          <div className="tim-assistant-tablewrap">
            <table>{children}</table>
          </div>
        ),
        // Links do agente (fontes de mercado/notícias) abrem fora sem
        // sequestrar a aba do portal.
        a: ({ children, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {texto}
    </ReactMarkdown>
  );
}
