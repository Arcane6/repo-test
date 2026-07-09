import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsCoreOption } from "echarts/core";
import { ChartPanel } from "./ChartPanel";
import { stackedBarsOption } from "../charts/optionBuilders";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";
import { TECH_ORDER } from "../theme";

function bandaSortKey(banda: string): [number, string] {
  const n = Number(banda);
  return Number.isFinite(n) ? [n, banda] : [Number.POSITIVE_INFINITY, banda];
}

/**
 * Frequências por banda, empilhadas por tecnologia (legenda). Clicar num
 * segmento filtra o resto do dashboard por aquela tecnologia (cross-filter)
 * — clicar de novo remove o filtro.
 */
export function FrequencyChart() {
  const { uf, municipio, tecnologia, vennRegion, toggle } = useFilterStore();

  const { data, isFetching } = useQuery({
    queryKey: ["actual-frequencies", uf, municipio, tecnologia, vennRegion],
    queryFn: () => mobileAccessApi.frequencies({ uf, municipio, tecnologia, vennRegion }),
  });

  const bars = data?.bars ?? [];

  const option: EChartsCoreOption = useMemo(() => {
    if (bars.length === 0) {
      if (isFetching) return {};
      return {
        title: {
          text: "Sem dados para os filtros selecionados",
          left: "center",
          top: "center",
          textStyle: { color: "#999", fontSize: 14, fontWeight: "normal" },
        },
      };
    }

    const bandas = Array.from(new Set(bars.map((b) => b.banda))).sort((a, b) => {
      const [an, as_] = bandaSortKey(a);
      const [bn, bs] = bandaSortKey(b);
      return an !== bn ? an - bn : as_.localeCompare(bs);
    });

    const tecsPresent = TECH_ORDER.filter((t) => bars.some((b) => b.tec === t));

    const series = tecsPresent.map((tec) => {
      const barsByBanda = new Map(bars.filter((b) => b.tec === tec).map((b) => [b.banda, b]));
      return {
        name: tec,
        color: bars.find((b) => b.tec === tec)?.color ?? "#888",
        data: bandas.map((banda) => barsByBanda.get(banda)?.value ?? 0),
      };
    });

    return stackedBarsOption(bandas, series);
  }, [bars, isFetching]);

  return (
    <ChartPanel
      title="Frequências Utilizadas por Tecnologia"
      subtitle="Clique num segmento para filtrar o dashboard por aquela tecnologia"
      sourceTable="MUNICIPIOS_FECHAMENTO"
      option={option}
      loading={isFetching}
      height={420}
      imageFilename="frequencias-por-tecnologia.png"
      exportSheet={{
        name: "Frequências",
        columns: [
          { header: "Tecnologia", key: "tec" },
          { header: "Banda (MHz)", key: "banda" },
          { header: "Municípios", key: "value" },
        ],
        rows: bars,
      }}
      onClick={(event) => {
        if (event.seriesName) toggle("tecnologia", event.seriesName);
      }}
    />
  );
}
