import { fetchJson } from "./client";

const BASE = "/trafego/api";

/** Módulo Tráfego: só geografia (UF/Município). Tempo é fixo por raia. */
export interface TrafficFilters {
  uf: string[];
  municipio: string[];
}

function query(filters: TrafficFilters): string {
  const params = new URLSearchParams();
  filters.uf.forEach((v) => params.append("uf", v));
  filters.municipio.forEach((v) => params.append("municipio", v));
  return params.toString();
}

export interface LabeledValue {
  label: string;
  value: number;
}

export interface MarketShare {
  tim_pb: number;
  total_mercado_pb: number;
  share_tim_pct: number | null;
  por_operadora: Record<string, number>;
}

export interface RaiaFechamento2025 {
  ano: number;
  trafego_tim_pb: number;
  market_share: MarketShare;
  por_tecnologia: LabeledValue[];
  ranking_municipios: LabeledValue[];
}

export interface RaiaPlano26 {
  ano: number;
  trafego_planejado_pb: number;
  serie_mensal: { mes: string; value: number }[];
  por_camada: LabeledValue[];
  ranking_municipios: LabeledValue[];
}

export interface RaiaFechamento26 {
  ano: number;
  mes_ate: string | null;
  trafego_tim_ytd_pb: number;
  planejado_ytd_pb: number;
  aderencia_pct: number | null;
  market_share: MarketShare;
  por_tecnologia: LabeledValue[];
}

export interface ResumoExecutivoResponse {
  fechamento_2025: RaiaFechamento2025;
  plano_26: RaiaPlano26;
  fechamento_26: RaiaFechamento26;
}

export interface YtdPontoAcumulado {
  mes: string;
  planejado_pb: number;
  realizado_pb: number;
  aderencia_pct: number | null;
}

export interface YtdPorUf {
  uf: string;
  planejado_pb: number;
  realizado_pb: number;
  aderencia_pct: number | null;
}

export interface YtdResponse {
  ano: number;
  mes_ate: string | null;
  planejado_ytd_pb: number;
  realizado_ytd_pb: number;
  aderencia_pct: number | null;
  serie_acumulada: YtdPontoAcumulado[];
  por_uf: YtdPorUf[];
}

export const trafficApi = {
  resumoExecutivo: (f: TrafficFilters) =>
    fetchJson<ResumoExecutivoResponse>(`${BASE}/resumo-executivo?${query(f)}`),
  ytd: (f: TrafficFilters) => fetchJson<YtdResponse>(`${BASE}/ytd?${query(f)}`),
};
