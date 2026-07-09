import { fetchJson, filtersToQuery, type ActiveFilters } from "./client";

const BASE = "/mobile-access/api/actual";

export interface KpiCard {
  label: string;
  value: number;
  percent: number;
  color: string;
}

export interface KpisResponse {
  total_municipios: number;
  cards: KpiCard[];
}

export interface FrequencyBar {
  tec: string;
  banda: string;
  value: number;
  color: string;
}

export interface FrequenciesResponse {
  bars: FrequencyBar[];
  groups: { tec: string; color: string; start: number; end: number }[];
}

export interface TimeseriesSeries {
  tec: string;
  color: string;
  values: number[];
}

export interface TimeseriesResponse {
  periods: string[];
  series: TimeseriesSeries[];
}

export interface VennLegendItem {
  label: string;
  value: number;
  percent: number;
  color: string;
}

export interface VennRegions {
  only_2g: number;
  only_3g: number;
  only_5g: number;
  inter_2g_3g: number;
  inter_2g_5g: number;
  inter_3g_5g: number;
  inter_all: number;
}

export interface VennResponse {
  legend: VennLegendItem[];
  regions: VennRegions;
  total_municipios: number;
}

/** Fase de cada tecnologia no município: rótulo dinâmico (ex.: "EOY25",
 * "YTD", "EOY26") ou null se a tecnologia não está prevista/divulgada. */
export interface MunicipioRow {
  ibge: string;
  uf: string;
  municipio: string;
  status_5g: string | null;
  status_4g: string | null;
  status_3g: string | null;
  status_2g: string | null;
}

export interface GaugeCard {
  label: string;
  color: string;
  eoy_prev: number;
  ytd: number;
  eoy_curr: number;
}

export interface GaugesResponse {
  labels: { prev: string; curr: string };
  total_municipios: number;
  cards: GaugeCard[];
}

export const mobileAccessApi = {
  ufs: () => fetchJson<string[]>(`${BASE}/ufs`),

  municipiosSearch: (q: string, uf: string[]) => {
    const params = new URLSearchParams();
    if (q) params.append("q", q);
    uf.forEach((v) => params.append("uf", v));
    return fetchJson<{ municipio: string; uf: string }[]>(
      `${BASE}/municipios/search?${params.toString()}`,
    );
  },

  kpis: (filters: ActiveFilters) =>
    fetchJson<KpisResponse>(`${BASE}/kpis?${filtersToQuery(filters)}`),

  gauges: (filters: ActiveFilters) =>
    fetchJson<GaugesResponse>(`${BASE}/gauges?${filtersToQuery(filters)}`),

  venn: (filters: ActiveFilters) =>
    fetchJson<VennResponse>(`${BASE}/venn?${filtersToQuery(filters)}`),

  frequencies: (filters: ActiveFilters) =>
    fetchJson<FrequenciesResponse>(`${BASE}/frequencies?${filtersToQuery(filters)}`),

  timeseries: (filters: ActiveFilters) =>
    fetchJson<TimeseriesResponse>(`${BASE}/timeseries?${filtersToQuery(filters)}`),

  table: (filters: ActiveFilters) =>
    fetchJson<MunicipioRow[]>(`${BASE}/table?${filtersToQuery(filters)}`),

  /** Base completa (última carga), sem filtro — export sempre traz a
   * versão mais recente inteira. */
  tableExport: () => fetchJson<MunicipioRow[]>(`${BASE}/table/export`),
};
