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

export interface MunicipioRow {
  uf: string;
  municipio: string;
  ibge: string;
  presenca: number;
  presenca_5g: number;
  presenca_4g: number;
  presenca_3g: number;
  presenca_2g: number;
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

  venn: (filters: ActiveFilters) =>
    fetchJson<VennResponse>(`${BASE}/venn?${filtersToQuery(filters)}`),

  frequencies: (filters: ActiveFilters) =>
    fetchJson<FrequenciesResponse>(`${BASE}/frequencies?${filtersToQuery(filters)}`),

  timeseries: (filters: ActiveFilters) =>
    fetchJson<TimeseriesResponse>(`${BASE}/timeseries?${filtersToQuery(filters)}`),

  table: (filters: ActiveFilters) =>
    fetchJson<MunicipioRow[]>(`${BASE}/table?${filtersToQuery(filters)}`),
};
