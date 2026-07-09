import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsCoreOption } from "echarts/core";
import { ChartPanel } from "./ChartPanel";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";

/**
 * Gráfico de frequências por tecnologia. Clicar numa barra filtra o resto
 * do dashboard por aquela tecnologia (cross-filter) — clicar de novo
 * remove o filtro.
 */
export function FrequencyChart() {
  const { uf, municipio, tecnologia, toggle } = useFilterStore();

  const { data, isFetching } = useQuery({
    queryKey: ["actual-frequencies", uf, municipio, tecnologia],
    queryFn: () => mobileAccessApi.frequencies({ uf, municipio, tecnologia }),
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
  }, [bars, tecnologia, isFetching]);

  return (
    <ChartPanel
      title="Frequências Utilizadas por Tecnologia"
      subtitle="Clique numa barra para filtrar o dashboard por aquela tecnologia"
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
        const bar = bars[event.dataIndex];
        if (bar) toggle("tecnologia", bar.tec);
      }}
    />
  );
}
