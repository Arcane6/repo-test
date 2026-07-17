import type { EChartsCoreOption } from "echarts/core";
import type { Theme } from "./useThemeStore";

interface ThemePalette {
  text: string;
  tooltipBg: string;
  tooltipBorder: string;
  axisLine: string;
  splitLine: string;
}

// Mesma família tipográfica do resto do portal (tokens em styles/index.css).
// Canvas do ECharts não herda CSS — precisa ser dito aqui explicitamente.
const CHART_FONT = '"Inter Variable", system-ui, sans-serif';

// Cores alinhadas aos tokens de tema do styles/index.css (o canvas não lê
// CSS vars — os hex daqui precisam acompanhar mudanças de lá).
const PALETTES: Record<Theme, ThemePalette> = {
  light: {
    text: "#1c2433",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e3e8f0",
    axisLine: "#9aa5b5",
    splitLine: "#edf0f5",
  },
  dark: {
    text: "#dbe4f0",
    tooltipBg: "#131a26",
    tooltipBorder: "#2c3850",
    axisLine: "#3d4a63",
    splitLine: "#1c2536",
  },
};

type AnyRecord = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Aplica cores de texto/eixo/tooltip do tema atual a um `option` do
 * ECharts, sem sobrescrever nada que o gráfico já tenha definido
 * explicitamente. Centralizado aqui (em vez de em cada gráfico) porque
 * é exatamente o tipo de boilerplate que não deveria se repetir.
 */
export function applyChartTheme(
  option: EChartsCoreOption,
  theme: Theme,
): EChartsCoreOption {
  const p = PALETTES[theme];
  const opt = option as AnyRecord;

  const themed: AnyRecord = {
    ...opt,
    textStyle: { color: p.text, fontFamily: CHART_FONT, ...(opt.textStyle as AnyRecord) },
  };

  if (opt.tooltip) {
    const isArr = Array.isArray(opt.tooltip);
    const list = asArray(opt.tooltip as AnyRecord | AnyRecord[]).map((t) => ({
      backgroundColor: p.tooltipBg,
      borderColor: p.tooltipBorder,
      // Sombra + raio do tooltip seguindo o design system (tokens --shadow-md
      // e --radius-md — valores replicados porque o canvas não lê CSS vars).
      extraCssText: "box-shadow: 0 4px 12px rgba(2,12,40,0.12); border-radius: 10px;",
      ...t,
      textStyle: { color: p.text, fontFamily: CHART_FONT, ...(t.textStyle as AnyRecord) },
    }));
    themed.tooltip = isArr ? list : list[0];
  }

  if (opt.legend) {
    const isArr = Array.isArray(opt.legend);
    const list = asArray(opt.legend as AnyRecord | AnyRecord[]).map((lg) => ({
      ...lg,
      textStyle: { color: p.text, ...(lg.textStyle as AnyRecord) },
    }));
    themed.legend = isArr ? list : list[0];
  }

  for (const axisKey of ["xAxis", "yAxis"]) {
    if (!opt[axisKey]) continue;
    const isArr = Array.isArray(opt[axisKey]);
    const list = asArray(opt[axisKey] as AnyRecord | AnyRecord[]).map((ax) => ({
      ...ax,
      axisLine: {
        ...(ax.axisLine as AnyRecord),
        lineStyle: { color: p.axisLine, ...((ax.axisLine as AnyRecord)?.lineStyle as AnyRecord) },
      },
      // Padrão TIM: sem números no eixo de valor — só o valor mostrado na
      // própria barra (label da série). Eixo de categoria (nome da tec,
      // vendor, município etc.) não é afetado, pois não é "número do
      // eixo". Mesmo princípio do splitLine abaixo — um builder que
      // realmente precise do número do eixo pode reativar passando
      // `axisLabel: { show: true }` explicitamente.
      axisLabel:
        ax.type === "value"
          ? { show: false, color: p.text, ...(ax.axisLabel as AnyRecord) }
          : { color: p.text, ...(ax.axisLabel as AnyRecord) },
      // Nenhum gráfico deve nascer com grade de linha — é aplicado aqui,
      // centralizado, em vez de cada option builder lembrar de desligar.
      // Um builder que realmente precise de grade pode reativar passando
      // `splitLine: { show: true }` explicitamente na sua option.
      splitLine: {
        show: false,
        ...(ax.splitLine as AnyRecord),
        lineStyle: { color: p.splitLine, ...((ax.splitLine as AnyRecord)?.lineStyle as AnyRecord) },
      },
    }));
    themed[axisKey] = isArr ? list : list[0];
  }

  return themed as EChartsCoreOption;
}
