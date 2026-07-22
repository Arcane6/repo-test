import { useEffect, useRef, type MutableRefObject } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, GaugeChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import type { ChartClickEvent } from "./types";
import { useThemeStore } from "../theme/useThemeStore";
import { applyChartTheme } from "../theme/chartTheme";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

interface ChartProps {
  option: EChartsCoreOption;
  onClick?: (event: ChartClickEvent) => void;
  height?: number | string;
  loading?: boolean;
  /** Recebe a instância do ECharts (para export de imagem, zoom, etc.) */
  instanceRef?: MutableRefObject<echarts.ECharts | null>;
}

/**
 * Wrapper único de ECharts: cuida do ciclo de vida (init/dispose/resize) e
 * do encaminhamento de cliques para o FilterStore. Qualquer gráfico novo só
 * precisa montar um `option` do ECharts — não reimplementa init/resize/click.
 */
export function Chart({ option, onClick, height = 360, loading, instanceRef }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    if (instanceRef) instanceRef.current = chart;

    const resize = () => chart.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
      chartRef.current = null;
      if (instanceRef) instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(applyChartTheme(option, theme), true);
    loading ? chart.showLoading() : chart.hideLoading();
  }, [option, loading, theme]);

  // Donuts com número central (title.text = total): quando a legenda
  // liga/desliga uma fatia, o total do centro acompanha a seleção — antes o
  // número ficava congelado no total cheio, contradizendo o gráfico visível.
  // Só se aplica a séries pie com title (os donuts regionalDonutOption /
  // vendorDonutSideOption); barras/linhas com título nunca chegam aqui.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const opt = option as {
      title?: { text?: unknown };
      series?: Array<{ type?: string; data?: Array<{ name: string; value: number }> }>;
    };
    const series = Array.isArray(opt.series) ? opt.series[0] : undefined;
    const hasCenterTotal =
      opt.title && !Array.isArray(opt.title) && opt.title.text != null &&
      series?.type === "pie" && Array.isArray(series.data);
    if (!hasCenterTotal) return;

    const handler = (params: unknown) => {
      const selected = (params as { selected: Record<string, boolean> }).selected ?? {};
      const total = series!.data!.reduce(
        (sum, d) => sum + (selected[d.name] === false ? 0 : d.value || 0),
        0,
      );
      chart.setOption({ title: { text: total.toLocaleString("pt-BR") } });
    };

    chart.on("legendselectchanged", handler);
    return () => {
      chart.off("legendselectchanged", handler);
    };
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onClick) return;

    const handler = (params: unknown) => {
      const p = params as {
        seriesName?: string;
        name: string;
        value: unknown;
        dataIndex: number;
      };
      onClick({
        seriesName: p.seriesName,
        name: p.name,
        value: p.value,
        dataIndex: p.dataIndex,
      });
    };

    chart.on("click", handler);
    return () => {
      chart.off("click", handler);
    };
  }, [onClick]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height }}
      role="img"
    />
  );
}
