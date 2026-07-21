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

export const transportApi = {
  resumoExecutivo: (f: TransportFilters) =>
    fetchJson<TransportResumoResponse>(`${BASE}/resumo-executivo?${query(f)}`),
  composicao: (f: TransportFilters) =>
    fetchJson<TransportComposicaoResponse>(`${BASE}/composicao?${query(f)}`),
};
