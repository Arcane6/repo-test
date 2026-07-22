import { fetchJson } from "./client";

const BASE = "/transport/api";

export interface TransportFilters {
  uf: string[];
  municipio: string[];
  regional: string[];
}

function query(f: TransportFilters): string {
  const p = new URLSearchParams();
  f.uf.forEach((v) => p.append("uf", v));
  f.municipio.forEach((v) => p.append("municipio", v));
  f.regional.forEach((v) => p.append("regional", v));
  return p.toString();
}

export interface LabeledValue {
  label: string;
  value: number;
}

export interface PerfilRaia {
  total_sites: number;
  definidos: number;
  pct_fibra: number | null;
  pct_10g: number | null;
  por_midia: LabeledValue[];
  por_capacidade: LabeledValue[];
  /** Só na raia Fechamento 26: variação de mídia 25→26. */
  variacao?: { label: string; delta: number }[];
}

export interface TransportResumoResponse {
  fechamento_2025: PerfilRaia;
  plano_26: PerfilRaia;
  fechamento_26: PerfilRaia;
}

export interface ComposicaoMidia {
  midia: string;
  c25: number;
  c26: number;
  delta: number;
}
export interface MigracaoFluxo {
  de: string;
  para: string;
  value: number;
}
export interface FiberRegional {
  regional: string;
  total: number;
  pct_fibra: number;
}
export interface FiberTecnologia {
  tec: string;
  total: number;
  pct_fibra: number;
}

export interface TransportComposicaoResponse {
  por_midia: ComposicaoMidia[];
  migracao: MigracaoFluxo[];
  make_buy: LabeledValue[];
  por_regional: FiberRegional[];
  por_tecnologia: FiberTecnologia[];
}

export interface RolloutAno {
  ano: string;
  value: number;
}

export interface TransportInfraResponse {
  por_solucao: LabeledValue[];
  por_provedor: LabeledValue[];
  por_status: LabeledValue[];
  por_classificacao: LabeledValue[];
  por_rollout: RolloutAno[];
}

export interface TransportGeoPoint {
  end_id: string;
  uf: string;
  municipio: string;
  lat: number;
  lon: number;
  media: string;
  color: string;
}

export interface TransportGeoResponse {
  points: TransportGeoPoint[];
}

export interface ReconCell {
  tx: string;
  base: string;
  n: number;
}
export interface ReconDivergencia {
  tx: string;
  base: string;
  value: number;
}
export interface TransportReconResponse {
  total_tx: number;
  em_ambas: number;
  so_no_tx: number;
  concordantes: number;
  divergentes: number;
  pct_concordancia: number | null;
  matriz: ReconCell[];
  top_divergencias: ReconDivergencia[];
}

export const transportApi = {
  resumoExecutivo: (f: TransportFilters) =>
    fetchJson<TransportResumoResponse>(`${BASE}/resumo-executivo?${query(f)}`),
  composicao: (f: TransportFilters) =>
    fetchJson<TransportComposicaoResponse>(`${BASE}/composicao?${query(f)}`),
  infraestrutura: (f: TransportFilters) =>
    fetchJson<TransportInfraResponse>(`${BASE}/infraestrutura?${query(f)}`),
  geoPoints: (f: TransportFilters) =>
    fetchJson<TransportGeoResponse>(`${BASE}/geo-points?${query(f)}`),
  reconciliacao: (f: TransportFilters) =>
    fetchJson<TransportReconResponse>(`${BASE}/reconciliacao?${query(f)}`),
};
