import { fetchJson } from "./client";

const BASE = "/mobile-access/api/sites";

/** Aba Sites: inventário de sites físicos (TB_FT_BASE_UNICA_SITES) — só
 * geo (uf/município/regional), sem ano/tecnologia/projeto (não é plano,
 * é o que já está instalado hoje). */
export interface SitesFilters {
  uf: string[];
  municipio: string[];
  regionais?: string[];
}

function query(filters: SitesFilters): string {
  const params = new URLSearchParams();
  filters.uf.forEach((v) => params.append("uf", v));
  filters.municipio.forEach((v) => params.append("municipio", v));
  (filters.regionais ?? []).forEach((v) => params.append("regional", v));
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

export interface SitesPivotRow {
  regional: string | null;
  uf: string;
  municipio: string;
  max_2g: number;
  max_3g: number;
  max_4g: number;
  max_5g: number;
  tec_2g: number;
  tec_3g: number;
  tec_4g: number;
  tec_5g: number;
  total_sites: number;
}

export interface SitesPivotResponse {
  rows: SitesPivotRow[];
}

export interface SitesTipoResponse {
  mobile_tx: number;
  mobile_no_tx: number;
  nonmobile_tx: number;
  nonmobile_no_tx: number;
  total_sites: number;
}

export const sitesApi = {
  byMaxTech: (f: SitesFilters) =>
    fetchJson<TechBarsResponse>(`${BASE}/by-max-tech?${query(f)}`),
  byTecnologia: (f: SitesFilters) =>
    fetchJson<TechBarsResponse>(`${BASE}/by-tecnologia?${query(f)}`),
  pivot: (f: SitesFilters) =>
    fetchJson<SitesPivotResponse>(`${BASE}/pivot?${query(f)}`),
  tipo: (f: SitesFilters) =>
    fetchJson<SitesTipoResponse>(`${BASE}/tipo?${query(f)}`),
};
