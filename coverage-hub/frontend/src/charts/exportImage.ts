import type * as echarts from "echarts/core";

/**
 * Baixa o gráfico atual como PNG em alta resolução (pixelRatio 3), com
 * fundo branco fixo — independente do tema light/dark da tela, porque o
 * destino típico (PPTX de diretoria) espera fundo branco.
 */
export function downloadChartImage(chart: echarts.ECharts | null, filename: string) {
  if (!chart) return;
  const url = chart.getDataURL({
    type: "png",
    pixelRatio: 3,
    backgroundColor: "#fff",
  });
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
