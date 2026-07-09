import type { EChartsCoreOption } from "echarts/core";
import type { LabeledValue, RegionalSeriesResponse, TechBar, TechSeries } from "../api/summary";

/**
 * Catálogo de "templates" de gráfico — funções puras que recebem dados
 * já no formato da API e devolvem um `option` do ECharts pronto pra
 * `<Chart/>`/`<ChartPanel/>`. A ideia: um gráfico novo quase sempre se
 * encaixa numa dessas formas; ao invés de escrever `option` do zero,
 * primeiro olhe se algum builder abaixo já serve (ajustando cor/rótulo),
 * e só escreva um novo se a forma for genuinamente diferente.
 *
 *   barsByTechOption      barras verticais, uma por tecnologia
 *   horizontalBarsOption  ranking (top N) em barras horizontais
 *   donutOption           donut com legenda embaixo
 *   pieOption             pizza cheia, paleta cíclica (categorias sem cor própria)
 *   regionalSunburstOption donut com total no centro + legenda rica (2 séries empilhadas por categoria)
 *   vendorDonutSideOption  donut com total no centro, legenda lateral simples
 *   timeSeriesOption       linhas acumuladas ao longo do tempo, com Δ no tooltip
 *
 * Todos aceitam um parâmetro de destaque opcional (`focusedX`) que
 * reduz a opacidade de tudo que não bate com o valor focado — é o que
 * dá o cross-filter visual entre painéis sem precisar reconsultar a API.
 */

const CYCLIC_PALETTE = [
  "#003399", "#7DC242", "#F5C518", "#E53935", "#1E88E5",
  "#795548", "#7B1FA2", "#00897B", "#FB8C00", "#5D4037",
];

const fmt = (v: number) => v.toLocaleString("pt-BR");
const pct = (part: number, total: number) => (total ? ((part / total) * 100).toFixed(1) : "0");

/**
 * Barras verticais simples por tecnologia (R1 sites/cidades por tec).
 * `total` é o total real do universo (ex.: total de municípios) — não a
 * soma das barras, porque um município pode contar em mais de uma
 * tecnologia ao mesmo tempo (2G e 5G não são mutuamente exclusivos).
 */
export function barsByTechOption(
  bars: TechBar[],
  total: number,
  focusedTec?: string | null,
): EChartsCoreOption {
  if (bars.length === 0) return {};
  return {
    grid: { left: 45, right: 30, top: 20, bottom: 40 },
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number }[])[0];
        return `<b>${p.name}</b><br/>${fmt(p.value)} <span style="opacity:0.65">(${pct(p.value, total)}% do total)</span>`;
      },
    },
    xAxis: { type: "category", data: bars.map((b) => b.tec), axisLabel: { fontWeight: "bold" } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#eee" } } },
    series: [
      {
        type: "bar",
        data: bars.map((b) => ({
          value: b.value,
          itemStyle: {
            color: b.color,
            opacity: !focusedTec || focusedTec === b.tec ? 1 : 0.3,
          },
        })),
        barMaxWidth: 40,
        label: { show: true, position: "top", fontWeight: "bold", formatter: (p: { value: number }) => fmt(p.value) },
      },
    ],
  };
}

interface NamedValue {
  name: string;
  value: number;
  color?: string;
}

/** Barras horizontais (top N, maior no topo) — vendors, top projetos. */
export function horizontalBarsOption(items: NamedValue[], limit = 12): EChartsCoreOption {
  if (items.length === 0) return {};
  const sliced = items.slice(0, limit).reverse();
  const total = items.reduce((s, d) => s + (d.value || 0), 0);
  return {
    grid: { left: 140, right: 50, top: 10, bottom: 20 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number }[])[0];
        return `<b>${p.name}</b><br/>${fmt(p.value)} <span style="opacity:0.65">(${pct(p.value, total)}% do total)</span>`;
      },
    },
    xAxis: { type: "value", axisLabel: { formatter: (v: number) => fmt(v) } },
    yAxis: {
      type: "category",
      data: sliced.map((d) => d.name),
      axisLabel: { fontSize: 10, width: 130, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: sliced.map((d) => ({ value: d.value, itemStyle: { color: d.color ?? "#003399" } })),
        barMaxWidth: 16,
        label: { show: true, position: "right", formatter: (p: { value: number }) => fmt(p.value), fontWeight: "bold", fontSize: 10 },
      },
    ],
  };
}

/** Donut simples com legenda embaixo (R2 vendors). */
export function donutOption(items: LabeledValue[]): EChartsCoreOption {
  if (items.length === 0) return {};
  const total = items.reduce((s, d) => s + (d.value || 0), 0);
  return {
    tooltip: {
      trigger: "item",
      formatter: (p: unknown) => {
        const d = p as { name: string; value: number };
        const pct = total ? ((d.value / total) * 100).toFixed(1) : "0";
        return `<b>${d.name}</b><br/>${fmt(d.value)} (${pct}%)`;
      },
    },
    legend: { bottom: 0, icon: "circle", textStyle: { fontSize: 11 } },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "42%"],
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
        label: {
          show: true,
          position: "outside",
          formatter: (p: { name: string; value: number }) => `${p.name}\n${fmt(p.value)}`,
          fontSize: 10,
          lineHeight: 14,
        },
        labelLine: { length: 6, length2: 6 },
        data: items.map((d) => ({ name: d.label, value: d.value, itemStyle: { color: d.color || "#888" } })),
      },
    ],
  };
}

/** Pizza cheia com paleta cíclica (R2 novas cidades por regional). */
export function pieOption(
  slices: { label: string; value: number }[],
  focusedLabel?: string | null,
): EChartsCoreOption {
  if (slices.length === 0) return {};
  const total = slices.reduce((s, d) => s + (d.value || 0), 0);
  return {
    tooltip: {
      trigger: "item",
      formatter: (p: unknown) => {
        const d = p as { name: string; value: number };
        const pct = total ? ((d.value / total) * 100).toFixed(1) : "0";
        return `<b>${d.name}</b><br/>${fmt(d.value)} cidades (${pct}%)`;
      },
    },
    series: [
      {
        type: "pie",
        radius: "70%",
        center: ["50%", "50%"],
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: {
          show: true,
          position: "outside",
          formatter: (p: { name: string; value: number }) => `${p.name}\n${fmt(p.value)}`,
          fontSize: 10,
          lineHeight: 14,
        },
        labelLine: { length: 6, length2: 6 },
        data: slices.map((d, i) => ({
          name: d.label,
          value: d.value,
          itemStyle: {
            color: CYCLIC_PALETTE[i % CYCLIC_PALETTE.length],
            opacity: !focusedLabel || focusedLabel === d.label ? 1 : 0.35,
          },
        })),
      },
    ],
  };
}

/** Donut com total no centro + legenda rica Base/Ganho (R3 cidades por regional). */
export function regionalSunburstOption(
  data: RegionalSeriesResponse,
  focusedRegional?: string | null,
): EChartsCoreOption {
  if (data.categories.length === 0) return {};

  const base = data.series.find((s) => s.name === "Base 25")?.data ?? [];
  const ganho = data.series.find((s) => s.name === "Ganho 26")?.data ?? [];
  const totalGeral = data.total || 0;

  const donutData = data.categories
    .map((cat, i) => ({
      name: cat,
      value: (base[i] || 0) + (ganho[i] || 0),
      base: base[i] || 0,
      ganho: ganho[i] || 0,
      itemStyle: {
        color: CYCLIC_PALETTE[i % CYCLIC_PALETTE.length],
        opacity: !focusedRegional || focusedRegional === cat ? 1 : 0.35,
      },
    }))
    .sort((a, b) => b.value - a.value);

  return {
    title: {
      text: fmt(totalGeral),
      subtext: "EoY 26 · Total",
      left: "32%",
      top: "42%",
      textAlign: "center",
      textStyle: { fontSize: 22, fontWeight: "bold", color: "#003399" },
      subtextStyle: { fontSize: 10 },
    },
    tooltip: {
      trigger: "item",
      formatter: (p: unknown) => {
        const d = (p as { data: (typeof donutData)[number] }).data;
        const pct = totalGeral ? ((d.value / totalGeral) * 100).toFixed(1) : "0";
        return `<b>${d.name}</b> (${pct}%)<br/>
          <span style="opacity:0.6">▪ Base 25:</span> <b>${fmt(d.base)}</b><br/>
          <span style="color:${d.itemStyle.color}">▪ Ganho 26:</span> <b>${fmt(d.ganho)}</b><br/>
          <b>Total: ${fmt(d.value)}</b>`;
      },
    },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 8,
      top: "center",
      itemGap: 8,
      textStyle: {
        fontSize: 10,
        rich: {
          n: { fontWeight: "bold", fontSize: 11, width: 30 },
          b: { fontSize: 10 },
          plus: { fontSize: 10, padding: [0, 2] },
          g: { color: "#7DC242", fontSize: 10, fontWeight: "bold" },
        },
      },
      formatter: (name: string) => {
        const d = donutData.find((x) => x.name === name);
        if (!d) return name;
        return `{n|${name}}  {b|${fmt(d.base)}} {plus|+} {g|${fmt(d.ganho)}}`;
      },
    },
    series: [
      {
        type: "pie",
        radius: ["52%", "82%"],
        center: ["32%", "52%"],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
        label: {
          show: true,
          position: "inside",
          fontWeight: "bold",
          color: "#fff",
          fontSize: 11,
          formatter: (p: { value: number; name: string }) => {
            const pct = totalGeral ? (p.value / totalGeral) * 100 : 0;
            if (pct < 5) return "";
            return `${p.name}\n${fmt(p.value)}`;
          },
        },
        labelLine: { show: false },
        data: donutData,
      },
    ],
  };
}

/** Donut com total no centro, legenda simples (R3 vendors). */
export function vendorDonutSideOption(items: LabeledValue[]): EChartsCoreOption {
  if (items.length === 0) return {};
  const total = items.reduce((s, d) => s + (d.value || 0), 0);
  const sorted = [...items].sort((a, b) => b.value - a.value);

  return {
    title: {
      text: fmt(total),
      subtext: "Sites totais",
      left: "32%",
      top: "42%",
      textAlign: "center",
      textStyle: { fontSize: 22, fontWeight: "bold", color: "#003399" },
      subtextStyle: { fontSize: 10 },
    },
    tooltip: {
      trigger: "item",
      formatter: (p: unknown) => {
        const d = p as { name: string; value: number };
        const pct = total ? ((d.value / total) * 100).toFixed(1) : "0";
        return `<b>${d.name}</b><br/>${fmt(d.value)} sites (${pct}%)`;
      },
    },
    legend: {
      type: "scroll",
      orient: "vertical",
      right: 8,
      top: "center",
      itemGap: 10,
      icon: "circle",
      textStyle: { fontSize: 10 },
    },
    series: [
      {
        type: "pie",
        radius: ["52%", "82%"],
        center: ["32%", "52%"],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
        label: {
          show: true,
          position: "inside",
          fontWeight: "bold",
          color: "#fff",
          fontSize: 11,
          formatter: (p: { value: number }) => {
            const pct = total ? (p.value / total) * 100 : 0;
            return pct < 5 ? "" : fmt(p.value);
          },
        },
        labelLine: { show: false },
        data: sorted.map((d) => ({ name: d.label, value: d.value, itemStyle: { color: d.color || "#888" } })),
      },
    ],
  };
}

export const SMALL_MULTIPLE_COLORS: Record<string, string> = {
  "Base 25": "#B0BEC5",
  "Casa Nova": "#26C281",
  "Casa Existente": "#1565C0",
};

export interface NamedTimeSeries {
  name: string;
  color: string;
  values: number[];
}

/**
 * Linhas ao longo do tempo (ex.: municípios acumulados por tecnologia).
 * Tooltip mostra a variação vs. o período anterior de cada série — não
 * só o nível, o movimento, que é o que interessa numa leitura executiva.
 */
export function timeSeriesOption(periods: string[], series: NamedTimeSeries[]): EChartsCoreOption {
  if (series.length === 0 || periods.length === 0) return {};

  return {
    grid: { left: 55, right: 30, top: 30, bottom: 60 },
    tooltip: {
      trigger: "axis",
      formatter: (raw: unknown) => {
        const params = raw as {
          seriesIndex: number;
          dataIndex: number;
          seriesName: string;
          value: number;
          color: string;
          axisValue: string;
        }[];
        if (!params.length) return "";
        const rows = [...params]
          .sort((a, b) => b.value - a.value)
          .map((p) => {
            const prev = series[p.seriesIndex]?.values[p.dataIndex - 1];
            const delta = prev !== undefined ? p.value - prev : null;
            const deltaHtml =
              delta === null
                ? ""
                : delta === 0
                  ? ` <span style="opacity:0.55">(sem variação)</span>`
                  : ` <span style="color:${delta > 0 ? "#2e7d32" : "#c62828"}">(${delta > 0 ? "+" : ""}${fmt(delta)} no período)</span>`;
            return `<div style="display:flex; align-items:center; gap:8px; margin:2px 0;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
              <b>${p.seriesName}</b>
              <span style="margin-left:auto; font-weight:bold;">${fmt(p.value)}</span>
              ${deltaHtml}
            </div>`;
          })
          .join("");
        return `<div style="font-weight:bold; margin-bottom:4px;">${params[0].axisValue}</div>${rows}`;
      },
    },
    legend: {
      data: series.map((s) => s.name),
      bottom: 0,
      icon: "circle",
      textStyle: { fontWeight: "bold" },
    },
    xAxis: {
      type: "category",
      data: periods,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#999" } },
    },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#eee" } } },
    series: series.map((s) => ({
      name: s.name,
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
}

export type { TechSeries };
