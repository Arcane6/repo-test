import { useQuery } from "@tanstack/react-query";
import type { EChartsCoreOption } from "echarts/core";
import { ChartPanel } from "../components/ChartPanel";
import { donutOption, horizontalBarsOption } from "../charts/optionBuilders";
import { transportApi, type ComposicaoMidia } from "../api/transport";
import { useTransportFilterStore } from "../store/transportFilters";
import { TRANSPORT_COLORS, techColor } from "../theme";

const MAKE_BUY_COLOR: Record<string, string> = {
  MAKE: "#2E9E5B", BUY: "#F5A623", METIS: "#7B1FA2", "BUY+MAKE": "#00ACC1", TBD: "#B0BEC5",
};

/** Barras agrupadas 2025 × 2026 por mídia: o "antes" em cinza, o "depois"
 * na cor da mídia — lê a variação de composição num olhar. */
function grouped2526Option(items: ComposicaoMidia[]): EChartsCoreOption {
  if (items.length === 0) return {};
  return {
    grid: { left: 44, right: 20, top: 36, bottom: 40 },
    tooltip: { trigger: "axis" },
    legend: { data: ["2025", "2026"], bottom: 0, icon: "roundRect" },
    xAxis: { type: "category", data: items.map((i) => i.midia) },
    yAxis: { type: "value" },
    series: [
      {
        name: "2025", type: "bar", data: items.map((i) => i.c25),
        itemStyle: { color: "#94A3B8", borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: "top", fontSize: 10, color: "#94A3B8" },
      },
      {
        name: "2026", type: "bar",
        data: items.map((i) => ({ value: i.c26, itemStyle: { color: TRANSPORT_COLORS[i.midia] ?? "#003399", borderRadius: [3, 3, 0, 0] } })),
        label: { show: true, position: "top", fontSize: 10, fontWeight: "bold" },
      },
    ],
  };
}

export function TransporteComposicao() {
  const { uf, municipio, regional } = useTransportFilterStore();
  const filters = { uf, municipio, regional };

  const { data, isFetching: loading, error } = useQuery({
    queryKey: ["transport-composicao", uf, municipio, regional],
    queryFn: () => transportApi.composicao(filters),
    retry: false,
  });

  const src = "REL_TX_PROFILE";

  return (
    <div className="tim-page-enter">
      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div><strong>Falha ao carregar a composição.</strong>
            <div className="small mt-1">{(error as Error).message}</div></div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-7">
          <ChartPanel title="Variação de Composição por Mídia — 2025 × 2026" subtitle="Nº de sites por mídia de transporte"
            sourceTable={src} height={340} option={grouped2526Option(data?.por_midia ?? [])} loading={loading}
            imageFilename="transporte-composicao-25x26.png"
            exportSheet={{ name: "Composição 25x26", columns: [
              { header: "Mídia", key: "midia" }, { header: "2025", key: "c25" }, { header: "2026", key: "c26" }, { header: "Δ", key: "delta" },
            ], rows: data?.por_midia ?? [] }} />
        </div>
        <div className="col-lg-5">
          <ChartPanel title="Top Migrações 25 → 26" subtitle="Sites que trocaram de mídia (nº de sites)"
            sourceTable={src} height={340}
            option={horizontalBarsOption((data?.migracao ?? []).map((m) => ({
              name: `${m.de} → ${m.para}`, value: m.value,
              color: TRANSPORT_COLORS[m.para] ?? "#003399",
            })), 10)}
            loading={loading} imageFilename="transporte-migracoes.png" />
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-4">
          <ChartPanel title="Fibra: Própria × Comprada" subtitle="MAKE (construída) × BUY (leased/parceiro)"
            sourceTable={src} height={300}
            option={donutOption((data?.make_buy ?? []).map((x) => ({ label: x.label, value: x.value, color: MAKE_BUY_COLOR[x.label] ?? "#90A4AE" })))}
            loading={loading} imageFilename="transporte-make-buy.png" />
        </div>
        <div className="col-lg-4">
          <ChartPanel title="Fiberização por Regional" subtitle="% dos sites definidos que são FO (Fech. 26)"
            sourceTable={src} height={300}
            option={horizontalBarsOption((data?.por_regional ?? []).map((r) => ({
              name: r.regional, value: r.pct_fibra,
              color: r.pct_fibra >= 70 ? "#2E7D32" : r.pct_fibra >= 55 ? "#F5A623" : "#E53935",
            })), 10)}
            loading={loading} imageFilename="transporte-fibra-regional.png" />
        </div>
        <div className="col-lg-4">
          <ChartPanel title="Fiberização por Tecnologia" subtitle="% dos sites de cada rádio que rodam em FO"
            sourceTable={src} height={300}
            option={horizontalBarsOption((data?.por_tecnologia ?? []).map((t) => ({
              name: t.tec, value: t.pct_fibra, color: techColor(t.tec),
            })), 4)}
            loading={loading} imageFilename="transporte-fibra-tecnologia.png" />
        </div>
      </div>
    </div>
  );
}
