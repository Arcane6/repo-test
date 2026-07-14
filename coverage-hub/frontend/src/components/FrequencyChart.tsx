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

    // Categoria = banda + tecnologia, não só a banda: a mesma frequência
    // (ex.: 2100 MHz) usada por tecnologias diferentes é uma coisa
    // distinta em cada uma (uso/licenciamento próprio), então não pode
    // virar uma única barra empilhada como se fossem equivalentes.
    const sortedBars = [...bars].sort((a, b) => {
      const ta = TECH_ORDER.indexOf(a.tec);
      const tb = TECH_ORDER.indexOf(b.tec);
      if (ta !== tb) return ta - tb;
      const [an, as_] = bandaSortKey(a.banda);
      const [bn, bs] = bandaSortKey(b.banda);
      return an !== bn ? an - bn : as_.localeCompare(bs);
    });
    const categories = sortedBars.map((b) => `${b.banda} MHz (${b.tec})`);

    const tecsPresent = TECH_ORDER.filter((t) => bars.some((b) => b.tec === t));

    const series = tecsPresent.map((tec) => ({
      name: tec,
      color: bars.find((b) => b.tec === tec)?.color ?? "#888",
      data: sortedBars.map((b) => (b.tec === tec ? b.value : 0)),
    }));

    const built = stackedBarsOption(categories, series);
    // Com banda+tecnologia na mesma categoria, o eixo fica mais lotado —
    // rótulo rotacionado pra não sobrepor.
    const xAxis = built.xAxis as Record<string, unknown>;
    return {
      ...built,
      grid: { ...(built.grid as Record<string, unknown>), bottom: 80 },
      xAxis: {
        ...xAxis,
        axisLabel: { ...(xAxis.axisLabel as Record<string, unknown>), rotate: 40, fontSize: 10 },
      },
    };
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
