interface DeltaSpec {
  label: string;
  pct: number | null;
}

interface KpiDeltaCardProps {
  label: string;
  icon: string;
  accentColor: string;
  /** Modo número (ex.: volume total) ou nome de entidade (ex.: top município) — a
   * própria cor de destaque muda o que é "o valor" do card. */
  value: string;
  unit?: string;
  /** Linha secundária abaixo do valor (ex.: "48,4 PB" quando o valor
   * principal é o nome de uma entidade, não um número). */
  secondaryValue?: string;
  deltas: DeltaSpec[];
}

function DeltaBadge({ label, pct }: DeltaSpec) {
  if (pct === null) {
    return (
      <span className="kpi-delta-badge" style={{ opacity: 0.6 }}>
        — {label}
      </span>
    );
  }
  const up = pct >= 0;
  const formatted = `${up ? "+" : ""}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return (
    <span className={`kpi-delta-badge ${up ? "up" : "down"}`}>
      <i className={`bi bi-arrow-${up ? "up" : "down"}-right`} /> {formatted} {label}
    </span>
  );
}

/**
 * Card de KPI no estilo "Volume de Tráfego" de referência: label
 * pequeno + ícone, valor grande (número ou nome de entidade), e badges
 * de variação (MoM/YoY) embaixo de um divisor.
 */
export function KpiDeltaCard({
  label,
  icon,
  accentColor,
  value,
  unit,
  secondaryValue,
  deltas,
}: KpiDeltaCardProps) {
  return (
    <div className="kpi-card">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <span className="kpi-card-label">{label}</span>
        <div
          className="kpi-card-icon"
          style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)`, color: accentColor }}
        >
          <i className={icon} />
        </div>
      </div>

      <div className="kpi-card-value" style={secondaryValue ? { color: accentColor, fontSize: "1.4rem" } : undefined}>
        {value}
        {unit && <span className="kpi-card-value-unit">{unit}</span>}
      </div>
      {secondaryValue && <div className="kpi-card-secondary">{secondaryValue}</div>}

      <div className="kpi-card-divider" />
      <div className="d-flex flex-wrap gap-2">
        {deltas.map((d) => (
          <DeltaBadge key={d.label} label={d.label} pct={d.pct} />
        ))}
      </div>
    </div>
  );
}
