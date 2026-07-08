import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsCoreOption } from "echarts/core";
import type * as echarts from "echarts/core";
import { Chart } from "../charts/Chart";
import { downloadChartImage } from "../charts/exportImage";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";
import { ChartToolbar } from "./ChartToolbar";
import { downloadSheet } from "../utils/excelExport";

/**
 * Gráfico de frequências por tecnologia. Clicar numa barra filtra o resto
 * do dashboard por aquela tecnologia (cross-filter) — clicar de novo
 * remove o filtro.
 */
export function FrequencyChart() {
  const { uf, municipio, tecnologia, toggle } = useFilterStore();
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["actual-frequencies", uf, municipio, tecnologia],
    queryFn: () => mobileAccessApi.frequencies({ uf, municipio, tecnologia }),
  });

  const option: EChartsCoreOption = useMemo(() => {
    const bars = data?.bars ?? [];

    if (bars.length === 0) {
      return {
        title: {
          text: "Sem dados para os filtros selecionados",
          left: "center",
          top: "center",
          textStyle: { color: "#999", fontSize: 14, fontWeight: "normal" },
        },
      };
    }

    const categories = bars.map((b) => `${b.banda}|${b.tec}`);
    const hasSelection = tecnologia.length > 0;

    const values = bars.map((b) => ({
      value: b.value,
      itemStyle: {
        color: b.color,
        opacity: !hasSelection || tecnologia.includes(b.tec) ? 1 : 0.25,
      },
    }));

    return {
      grid: { left: 50, right: 20, top: 40, bottom: 70 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const p = (params as { name: string; value: number }[])[0];
          const [band, tec] = p.name.split("|");
          return `<b>${tec} — ${band} MHz</b><br/>${p.value.toLocaleString("pt-BR")} municípios`;
        },
      },
      xAxis: {
        type: "category",
        data: categories,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#999" } },
        axisLabel: {
          interval: 0,
          formatter: (value: string) => value.split("|")[0],
        },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#eee" } },
      },
      series: [
        {
          type: "bar",
          data: values,
          barMaxWidth: 42,
          label: {
            show: true,
            position: "top",
            fontWeight: "bold",
            formatter: (p: { value: number }) => p.value.toLocaleString("pt-BR"),
          },
        },
      ],
    };
  }, [data, tecnologia]);

  const bars = data?.bars ?? [];

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-1">
          <div>
            <h5 className="card-title mb-1">Frequências Utilizadas por Tecnologia</h5>
            <small className="text-muted d-block mb-3">
              Clique numa barra para filtrar o dashboard por aquela tecnologia
            </small>
          </div>
          <ChartToolbar
            onDownloadImage={() =>
              downloadChartImage(chartInstance.current, "frequencias-por-tecnologia.png")
            }
            onExportData={() =>
              downloadSheet("frequencias-por-tecnologia.xlsx", {
                name: "Frequências",
                columns: [
                  { header: "Tecnologia", key: "tec" },
                  { header: "Banda (MHz)", key: "banda" },
                  { header: "Municípios", key: "value" },
                ],
                rows: bars,
              })
            }
          />
        </div>
        <Chart
          option={option}
          loading={isFetching}
          height={420}
          instanceRef={chartInstance}
          onClick={(event) => {
            const bar = bars[event.dataIndex];
            if (bar) toggle("tecnologia", bar.tec);
          }}
        />
      </div>
    </div>
  );
}
