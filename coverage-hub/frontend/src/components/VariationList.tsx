/** Item de uma lista de variação (nome + %, delta e total). Genérico —
 * antes vinha do módulo Core (removido); mantido local pra o componente
 * seguir reutilizável por qualquer módulo. */
export interface VariacaoItem {
  label: string;
  pct: number;
  delta_pb: number;
  total_pb: number;
}

interface VariationListProps {
  title: string;
  icon: string;
  /** true = crescimento (verde), false = queda (vermelho) — mesma cor em
   * todos os itens da lista, já que cada painel é só um dos dois lados. */
  positive: boolean;
  items: VariacaoItem[];
}

const fmtPb = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/**
 * Coluna de destaque (maior crescimento OU maior queda) — mesmo layout
 * do painel de referência: nome à esquerda, variação % + delta absoluto
 * + total à direita.
 */
export function VariationList({ title, icon, positive, items }: VariationListProps) {
  const color = positive ? "#2e7d32" : "#c62828";

  return (
    <div className="card shadow-sm h-100 core-variation-panel" style={{ "--variation-color": color } as React.CSSProperties}>
      <div className="card-body">
        <div className="d-flex align-items-center gap-2 mb-3">
          <i className={`bi ${icon}`} style={{ color }} />
          <h6 className="fw-bold mb-0 text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: 0.5 }}>
            {title}
          </h6>
        </div>

        {items.length === 0 ? (
          <p className="text-muted small mb-0">Sem variação relevante no período.</p>
        ) : (
          items.map((item) => (
            <div className="core-variation-item" key={item.label}>
              <span className="fw-bold small">{item.label}</span>
              <div className="text-end">
                <div className="fw-bold" style={{ color }}>
                  {item.pct >= 0 ? "+" : ""}
                  {item.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  <i className={`bi bi-arrow-${item.pct >= 0 ? "up" : "down"}-right ms-1`} />
                </div>
                <div className="small text-muted">
                  ({item.delta_pb >= 0 ? "+" : ""}
                  {fmtPb(item.delta_pb)} PB)
                  <br />
                  Total: {fmtPb(item.total_pb)} PB
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
