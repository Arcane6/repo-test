import { fetchJson } from "./client";

const BASE = "/core/api";

/** Módulo Core: volumetria de tráfego da RAN — só geografia (sem
 * tecnologia/ano, esse dado não tem essas dimensões). */
export interface CoreFilters {
  uf: string[];
  municipio: string[];
  regional?: string[];
}

function query(filters: CoreFilters): string {
  const params = new URLSearchParams();
  filters.uf.forEach((v) => params.append("uf", v));
  filters.municipio.forEach((v) => params.append("municipio", v));
  (filters.regional ?? []).forEach((v) => params.append("regional", v));
  return params.toString();
}

export interface CoreEntityKpi {
  label: string;
  volumetria_pb: number;
  mom_pct: number | null;
  yoy_pct: number | null;
}

export interface CoreKpisResponse {
  total: {
    volumetria_pb: number;
    mom_pct: number | null;
    yoy_pct: number | null;
  };
  top_municipio: CoreEntityKpi | null;
  top_uf: CoreEntityKpi | null;
}

export interface CoreHistoricoPoint {
  mes: string;
  label: string;
  volumetria_pb: number;
  variacao_pct: number | null;
}

export interface CoreHistoricoResponse {
  points: CoreHistoricoPoint[];
}

export interface CoreVariacaoItem {
  label: string;
  pct: number;
  delta_pb: number;
  total_pb: number;
}

export interface CoreDestaquesResponse {
  mes_atual: string | null;
  mes_anterior: string | null;
  municipios_alta: CoreVariacaoItem[];
  municipios_queda: CoreVariacaoItem[];
  ufs_alta: CoreVariacaoItem[];
  ufs_queda: CoreVariacaoItem[];
}

export interface CoreRankingItem {
  label: string;
  value: number;
}

export interface CoreRankingResponse {
  items: CoreRankingItem[];
}

export interface CoreGeoPoint {
  ibge: string;
  municipio: string;
  uf: string;
  regional: string | null;
  lat: number;
  lon: number;
  volumetria_pb: number;
}

export interface CoreGeoPointsResponse {
  points: CoreGeoPoint[];
}

export const coreApi = {
  kpis: (f: CoreFilters) => fetchJson<CoreKpisResponse>(`${BASE}/kpis?${query(f)}`),
  historicoMensal: (f: CoreFilters) =>
    fetchJson<CoreHistoricoResponse>(`${BASE}/historico-mensal?${query(f)}`),
  destaquesVariacao: (f: CoreFilters) =>
    fetchJson<CoreDestaquesResponse>(`${BASE}/destaques-variacao?${query(f)}`),
  rankingMunicipios: (f: CoreFilters) =>
    fetchJson<CoreRankingResponse>(`${BASE}/ranking/municipios?${query(f)}`),
  rankingUfs: (f: CoreFilters) =>
    fetchJson<CoreRankingResponse>(`${BASE}/ranking/ufs?${query(f)}`),
  rankingRegionais: (f: CoreFilters) =>
    fetchJson<CoreRankingResponse>(`${BASE}/ranking/regionais?${query(f)}`),
  geoPoints: (f: CoreFilters) =>
    fetchJson<CoreGeoPointsResponse>(`${BASE}/geo-points?${query(f)}`),
};
