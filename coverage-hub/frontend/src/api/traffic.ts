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

export interface RaiaFechamento2025 {
  ano: number;
  trafego_pb: number;
  por_tecnologia: LabeledValue[];
  mix_5g_pct: number | null;
  ranking_municipios: LabeledValue[];
}

export interface SerieMensalPonto {
  mes: string;
  planejado_pb: number;
  /** Realizado só até o mês corrente; meses futuros vêm null (a linha para). */
  realizado_pb: number | null;
}

export interface RaiaPlano26 {
  ano: number;
  trafego_planejado_pb: number;
  mes_ate: string | null;
  serie_mensal: SerieMensalPonto[];
  por_camada: LabeledValue[];
  ranking_municipios: LabeledValue[];
}

export interface RaiaFechamento26 {
  ano: number;
  mes_ate: string | null;
  trafego_ytd_pb: number;
  planejado_ytd_pb: number;
  aderencia_pct: number | null;
  crescimento_yoy_pct: number | null;
  projecao_ano_pb: number;
  atingimento_plano_pct: number | null;
  por_tecnologia: LabeledValue[];
  mix_5g_pct: number | null;
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
