import type { EChartsCoreOption } from "echarts/core";
import type { Theme } from "./useThemeStore";

interface ThemePalette {
  text: string;
  tooltipBg: string;
  tooltipBorder: string;
  axisLine: string;
  splitLine: string;
}

const PALETTES: Record<Theme, ThemePalette> = {
  light: {
    text: "#212529",
    tooltipBg: "#ffffff",
    tooltipBorder: "#dddddd",
    axisLine: "#999999",
    splitLine: "#eeeeee",
  },
  dark: {
    text: "#e6edf3",
    tooltipBg: "#1a1f28",
    tooltipBorder: "#3d444d",
    axisLine: "#3d444d",
    splitLine: "#262c37",
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
    textStyle: { color: p.text, ...(opt.textStyle as AnyRecord) },
  };

  if (opt.tooltip) {
    const isArr = Array.isArray(opt.tooltip);
    const list = asArray(opt.tooltip as AnyRecord | AnyRecord[]).map((t) => ({
      backgroundColor: p.tooltipBg,
      borderColor: p.tooltipBorder,
      ...t,
      textStyle: { color: p.text, ...(t.textStyle as AnyRecord) },
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
