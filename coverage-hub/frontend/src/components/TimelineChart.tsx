import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsCoreOption } from "echarts/core";
import { ChartPanel } from "./ChartPanel";
import { timeSeriesOption } from "../charts/optionBuilders";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";
import { timeseriesToRows } from "../utils/timeseries";

export function TimelineChart() {
  const { uf, municipio, tecnologia, vennRegion } = useFilterStore();

  const { data, isFetching } = useQuery({
    queryKey: ["actual-timeseries", uf, municipio, tecnologia, vennRegion],
    queryFn: () => mobileAccessApi.timeseries({ uf, municipio, tecnologia, vennRegion }),
  });

  const option: EChartsCoreOption = useMemo(() => {
    const series = data?.series ?? [];
    const periods = data?.periods ?? [];

    if (series.length === 0 || periods.length === 0) {
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

    return timeSeriesOption(
      periods.map((p) => p.slice(0, 7)),
      series.map((s) => ({ name: s.tec, color: s.color, values: s.values })),
    );
  }, [data, isFetching]);

  return (
    <ChartPanel
      title="Linha do Tempo"
      subtitle="Municípios acumulados por tecnologia — últimos 10 anos · 5G inclui o plano 26 em dez/26"
      sourceTable={["MUNICIPIOS_FECHAMENTO", "REL_CIDADES_PLANEJADO_26"]}
      option={option}
      loading={isFetching}
      height={420}
      imageFilename="linha-do-tempo.png"
      exportSheet={data ? { name: "Linha do Tempo", ...timeseriesToRows(data) } : undefined}
    />
  );
}
