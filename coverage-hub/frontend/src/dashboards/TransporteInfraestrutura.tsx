import { useQuery } from "@tanstack/react-query";
import type { EChartsCoreOption } from "echarts/core";
import { ChartPanel } from "../components/ChartPanel";
import { TransportMap } from "../components/TransportMap";
import { donutOption, horizontalBarsOption } from "../charts/optionBuilders";
import { transportApi, type RolloutAno } from "../api/transport";
import { useTransportFilterStore } from "../store/transportFilters";

const src = "REL_TX_PROFILE";

// Solução técnica: FTTS CAP = fibra comprada (leased), FTTS MAKE = própria,
// MW = microondas. Cores alinhadas à leitura make/buy (verde=própria).
const SOLUCAO_COLOR: Record<string, string> = {
  "FTTS CAP": "#F5A623", "FTTS MAKE": "#2E9E5B", MW: "#00ACC1",
};
const STATUS_COLOR: Record<string, string> = {
  Ativado: "#2E9E5B", Remanejado: "#F5A623", Desativado: "#E53935",
};
const CLASSIF_COLOR: Record<string, string> = {
  ACESSO: "#003399", TRANSPORTE: "#7DC242", CORE: "#7B1FA2", OUTROS: "#90A4AE",
  RANSHARING: "#00ACC1", TEFF: "#F5A623", CORPORATIVO: "#EC407A",
};

/** Rollout por ano: barras verticais; o ano de plano (2026) em destaque azul-TIM
 * e o histórico em cinza-azulado — lê o ritmo de entrada de sites num olhar. */
function rolloutOption(items: RolloutAno[]): EChartsCoreOption {
  if (items.length === 0) return {};
  return {
    grid: { left: 44, right: 16, top: 24, bottom: 28 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: items.map((i) => i.ano) },
    yAxis: { type: "value" },
    series: [
      {
        type: "bar",
        data: items.map((i) => ({
          value: i.value,
          itemStyle: { color: i.ano >= "2026" ? "#003399" : "#94A3B8", borderRadius: [3, 3, 0, 0] },
        })),
        label: { show: true, position: "top", fontSize: 10, fontWeight: "bold" },
      },
    ],
  };
}

export function TransporteInfraestrutura() {
  const { uf, municipio, regional } = useTransportFilterStore();
  const filters = { uf, municipio, regional };

  const { data, isFetching: loading, error } = useQuery({
    queryKey: ["transport-infra", uf, municipio, regional],
    queryFn: () => transportApi.infraestrutura(filters),
    retry: false,
  });

  return (
    <div className="tim-page-enter">
      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div><strong>Falha ao carregar a infraestrutura.</strong>
            <div className="small mt-1">{(error as Error).message}</div></div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-12">
          <TransportMap filters={filters} />
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-4">
          <ChartPanel title="Solução Técnica" subtitle="FTTS CAP (comprada) × MAKE (própria) × MW"
            sourceTable={src} height={300}
            option={donutOption((data?.por_solucao ?? []).map((x) => ({ label: x.label, value: x.value, color: SOLUCAO_COLOR[x.label] ?? "#90A4AE" })))}
            loading={loading} imageFilename="transporte-solucao.png" />
        </div>
        <div className="col-lg-4">
          <ChartPanel title="Status do Site" subtitle="Saúde da base (STS_END_ID)"
            sourceTable={src} height={300}
            option={donutOption((data?.por_status ?? []).map((x) => ({ label: x.label, value: x.value, color: STATUS_COLOR[x.label] ?? "#90A4AE" })))}
            loading={loading} imageFilename="transporte-status.png" />
        </div>
        <div className="col-lg-4">
          <ChartPanel title="Camada de Rede" subtitle="Classificação do enlace"
            sourceTable={src} height={300}
            option={horizontalBarsOption((data?.por_classificacao ?? []).map((x) => ({
              name: x.label, value: x.value, color: CLASSIF_COLOR[x.label] ?? "#90A4AE",
            })), 8)}
            loading={loading} imageFilename="transporte-classificacao.png" />
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-6">
          <ChartPanel title="Top Provedores de Fibra (BUY)" subtitle="De quem a TIM depende no backhaul comprado"
            sourceTable={src} height={320}
            option={horizontalBarsOption((data?.por_provedor ?? []).map((x) => ({
              name: x.label, value: x.value, color: "#00ACC1",
            })), 10)}
            loading={loading} imageFilename="transporte-provedores.png" />
        </div>
        <div className="col-lg-6">
          <ChartPanel title="Rollout por Ano" subtitle="Ritmo de entrada dos sites de transporte"
            sourceTable={src} height={320} option={rolloutOption(data?.por_rollout ?? [])}
            loading={loading} imageFilename="transporte-rollout.png"
            exportSheet={{ name: "Rollout", columns: [
              { header: "Ano", key: "ano" }, { header: "Sites", key: "value" },
            ], rows: data?.por_rollout ?? [] }} />
        </div>
      </div>
    </div>
  );
}
