const SUGESTOES = [
  {
    icone: "bi-graph-up-arrow",
    texto: "Quais municípios do PR têm maior oportunidade para 5G?",
  },
  {
    icone: "bi-broadcast-pin",
    texto: "Quantos municípios a TIM tem com 5G hoje?",
  },
  {
    icone: "bi-people",
    texto: "Com quantos municípios 5G a Claro fechou 2024?",
  },
  {
    icone: "bi-calendar-event",
    texto: "O que a Vivo está planejando lançar em 2026?",
  },
];

export function ChatEmptyState({ onEscolher }: { onEscolher: (texto: string) => void }) {
  return (
    <div className="tim-assistant-empty">
      <div className="tim-assistant-empty-icon">
        <i className="bi bi-stars" />
      </div>
      <h2 className="tim-assistant-empty-title">Como posso ajudar?</h2>
      <p className="tim-assistant-empty-sub">
        Pergunte sobre municípios, cobertura móvel, presença por tecnologia, 5G,
        operadoras e mercado — em português mesmo, do jeito que você falaria.
      </p>

      <div className="tim-assistant-suggestions">
        {SUGESTOES.map((s) => (
          <button
            key={s.texto}
            type="button"
            className="tim-assistant-suggestion"
            onClick={() => onEscolher(s.texto)}
          >
            <i className={`bi ${s.icone}`} />
            <span>{s.texto}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
