import { useQuery } from "@tanstack/react-query";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";

export function KpiCards() {
  const { uf, municipio, tecnologia } = useFilterStore();

  const { data } = useQuery({
    queryKey: ["actual-kpis", uf, municipio, tecnologia],
    queryFn: () => mobileAccessApi.kpis({ uf, municipio, tecnologia }),
  });

  if (!data) return null;

  return (
    <div className="row g-3 mb-4">
      {data.cards.map((card) => (
        <div className="col" key={card.label}>
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center mb-2">
                <span className="fw-bold text-muted">{card.label}</span>
              </div>
              <h2 className="fw-bold" style={{ color: card.color }}>
                {card.value.toLocaleString("pt-BR")}
              </h2>
              <div className="progress mb-2" style={{ height: 8 }}>
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${card.percent}%`, background: card.color }}
                />
              </div>
              <small className="fw-bold" style={{ color: card.color }}>
                {card.percent}%
              </small>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
