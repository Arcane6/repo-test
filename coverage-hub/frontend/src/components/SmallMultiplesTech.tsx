import { TECH_ORDER } from "../theme";
import { SMALL_MULTIPLE_COLORS } from "../charts/optionBuilders";
import type { StackedByTechResponse } from "../api/summary";

/**
 * Grid de mini-cards por tecnologia com barrinhas de proporção — não é
 * um gráfico ECharts, é HTML/CSS puro (mais leve e mais fácil de ler
 * em espaços pequenos do que 4 gráficos de barra separados).
 */
export function SmallMultiplesTech({ data }: { data?: StackedByTechResponse }) {
  if (!data || data.series.length === 0) return null;

  const perTecMax = data.categories.map((_, i) =>
    Math.max(1, ...data.series.map((s) => s.data[i] || 0)),
  );

  return (
    <div className="row g-2 sm-tech-grid">
      {TECH_ORDER.map((tec) => {
        const i = data.categories.indexOf(tec);
        if (i === -1) return <div className="col-3" key={tec} />;

        const total = data.series.reduce((s, ser) => s + (ser.data[i] || 0), 0);
        const maxForCard = perTecMax[i];

        return (
          <div className="col-3" key={tec}>
            <div className="sm-tec-card">
              <div className="sm-tec-title">{tec}</div>
              <div className="sm-tec-total">{total.toLocaleString("pt-BR")}</div>
              {data.series.map((ser) => {
                const val = ser.data[i] || 0;
                const pct = (val / maxForCard) * 100;
                const color = SMALL_MULTIPLE_COLORS[ser.name] || ser.color;
                return (
                  <div className="sm-tec-row" title={`${ser.name}: ${val.toLocaleString("pt-BR")}`} key={ser.name}>
                    <span className="sm-tec-bar-wrap">
                      <span className="sm-tec-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </span>
                    <span className="sm-tec-value">{val.toLocaleString("pt-BR")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
