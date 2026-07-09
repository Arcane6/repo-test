import { useQuery } from "@tanstack/react-query";
import { Chart } from "../charts/Chart";
import { gaugeOption } from "../charts/optionBuilders";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";
import { SourceBadge } from "./SourceBadge";
import { Skeleton } from "./Skeleton";

const SKELETON_COUNT = 5;
const fmt = (v: number) => v.toLocaleString("pt-BR");

/**
 * Velocímetros por tecnologia (e TIM geral): ponteiro no que já foi
 * divulgado até hoje (YTD), arco marcando o piso do fechamento anterior
 * e o alvo do fechamento deste ano. Substitui o KPI card antigo.
 */
export function GaugeCards() {
  const { uf, municipio, tecnologia } = useFilterStore();

  const { data } = useQuery({
    queryKey: ["actual-gauges", uf, municipio, tecnologia],
    queryFn: () => mobileAccessApi.gauges({ uf, municipio, tecnologia }),
  });

  if (!data) {
    return (
      <div className="row g-3 mb-4">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <div className="col" key={i}>
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <Skeleton height={14} width="60%" className="mb-3" />
                <Skeleton height={140} radius={8} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const { labels } = data;

  return (
    <div className="mb-4">
      <div className="d-flex justify-content-end mb-2">
        <SourceBadge table="MUNICIPIOS_FECHAMENTO" />
      </div>
      <div className="row g-3">
        {data.cards.map((card) => (
        <div className="col" key={card.label}>
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <span className="fw-bold text-muted mb-1">{card.label}</span>
              <Chart option={gaugeOption(card)} height={150} />
              <div className="d-flex justify-content-between small mt-1">
                <span>
                  <span className="text-muted">{labels.prev}</span>{" "}
                  <b>{fmt(card.eoy_prev)}</b>
                </span>
                <span>
                  <span className="text-muted">YTD</span> <b style={{ color: card.color }}>{fmt(card.ytd)}</b>
                </span>
                <span>
                  <span className="text-muted">{labels.curr}</span> <b>{fmt(card.eoy_curr)}</b>
                </span>
              </div>
            </div>
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}
