import { fetchJson } from "./client";

const BASE = "/mobile-access/api/summary";

/** Resumo não usa filtro de tecnologia (é "N/A" nessa aba) — só geo + ano. */
export interface SummaryFilters {
  uf: string[];
  municipio: string[];
  ano: string | null;
}

function query(filters: SummaryFilters): string {
  const params = new URLSearchParams();
  filters.uf.forEach((v) => params.append("uf", v));
  filters.municipio.forEach((v) => params.append("municipio", v));
  if (filters.ano) params.append("ano", filters.ano);
  return params.toString();
}

export interface TechBar {
  tec: string;
  value: number;
  color: string;
}

export interface TechBarsResponse {
  bars: TechBar[];
  total: number;
}

export interface LabeledValue {
  label: string;
  value: number;
  color: string;
}

export interface TechSeries {
  name: string;
  color: string;
  data: number[];
  is_info_only?: boolean;
}

export interface StackedByTechResponse {
  categories: string[];
  series: TechSeries[];
  total: number;
  total_com_upgrades?: number;
}

export interface Slice {
  label: string;
  value: number;
}

export interface SlicesResponse {
  slices: Slice[];
  total: number;
}

export interface RegionalSeriesResponse {
  categories: string[];
  series: TechSeries[];
  total_base: number;
  total_ganho: number;
  total: number;
}

export interface ProjectItem {
  projeto: string;
  value: number;
}

export const summaryApi = {
  years: () => fetchJson<number[]>(`${BASE}/years`),

  r1SitesByTech: (f: SummaryFilters) =>
    fetchJson<TechBarsResponse>(`${BASE}/r1/sites-by-tech?${query(f)}`),
  r1CitiesByTech: (f: SummaryFilters) =>
    fetchJson<TechBarsResponse>(`${BASE}/r1/cities-by-tech?${query(f)}`),
  r1Vendors: (f: SummaryFilters) =>
    fetchJson<LabeledValue[]>(`${BASE}/r1/vendors?${query(f)}`),

  r2SitesByTech: (f: SummaryFilters) =>
    fetchJson<StackedByTechResponse>(`${BASE}/r2/sites-by-tech?${query(f)}`),
  r2NewCitiesByAnf: (f: SummaryFilters) =>
    fetchJson<SlicesResponse>(`${BASE}/r2/new-cities-by-anf?${query(f)}`),
  r2VendorsNewSites: (f: SummaryFilters) =>
    fetchJson<LabeledValue[]>(`${BASE}/r2/vendors-new-sites?${query(f)}`),
  r2TopProjects: (f: SummaryFilters) =>
    fetchJson<ProjectItem[]>(`${BASE}/r2/top-projects?${query(f)}`),

  r3SitesByTech: (f: SummaryFilters) =>
    fetchJson<StackedByTechResponse>(`${BASE}/r3/sites-by-tech?${query(f)}`),
  r3NewCitiesByAnf: (f: SummaryFilters) =>
    fetchJson<RegionalSeriesResponse>(`${BASE}/r3/new-cities-by-anf?${query(f)}`),
  r3Vendors: (f: SummaryFilters) =>
    fetchJson<LabeledValue[]>(`${BASE}/r3/vendors?${query(f)}`),
  r3TopProjects: (f: SummaryFilters) =>
    fetchJson<ProjectItem[]>(`${BASE}/r3/top-projects?${query(f)}`),
};
