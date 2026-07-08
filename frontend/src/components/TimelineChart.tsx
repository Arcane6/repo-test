import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsCoreOption } from "echarts/core";
import { Chart } from "../charts/Chart";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";

export function TimelineChart() {
  const { uf, municipio, tecnologia } = useFilterStore();

  const { data, isFetching } = useQuery({
    queryKey: ["actual-timeseries", uf, municipio, tecnologia],
    queryFn: () => mobileAccessApi.timeseries({ uf, municipio, tecnologia }),
  });

  const option: EChartsCoreOption = useMemo(() => {
    const series = data?.series ?? [];
    const periods = data?.periods ?? [];

    if (series.length === 0 || periods.length === 0) {
      return {
        title: {
          text: "Sem dados para os filtros selecionados",
          left: "center",
          top: "center",
          textStyle: { color: "#999", fontSize: 14, fontWeight: "normal" },
        },
      };
    }

    return {
      grid: { left: 55, right: 30, top: 30, bottom: 60 },
      tooltip: { trigger: "axis" },
      legend: {
        data: series.map((s) => s.tec),
        bottom: 0,
        icon: "circle",
        textStyle: { fontWeight: "bold" },
      },
      xAxis: {
        type: "category",
        data: periods.map((p) => p.slice(0, 7)),
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#999" } },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#eee" } },
      },
      series: series.map((s) => ({
        name: s.tec,
        type: "line",
        step: "end",
        showSymbol: false,
        lineStyle: { width: 2, color: s.color },
        itemStyle: { color: s.color },
        areaStyle: { color: s.color, opacity: 0.25 },
        emphasis: { focus: "series" },
        data: s.values,
      })),
    };
  }, [data]);

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <h5 className="card-title mb-1">Linha do Tempo</h5>
        <small className="text-muted d-block mb-3">
          Municípios acumulados por tecnologia
        </small>
        <Chart option={option} loading={isFetching} height={420} />
      </div>
    </div>
  );
}
