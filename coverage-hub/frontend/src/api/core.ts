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
}

export interface CoreKpisResponse {
  total: {
    volumetria_pb: number;
    mom_pct: number | null;
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

export interface CoreTabelaItem {
  municipio: string;
  uf: string;
  regional: string | null;
  volumetria_pb: number;
}

export interface CoreTabelaResponse {
  items: CoreTabelaItem[];
}

/** Resposta consolidada do dashboard — tudo numa chamada só, pra não
 * disparar 8 execuções das queries pesadas em paralelo (ver
 * get_overview no backend). */
export interface CoreOverviewResponse {
  kpis: CoreKpisResponse;
  historico: CoreHistoricoResponse;
  destaques: CoreDestaquesResponse;
  ranking_municipios: CoreRankingResponse;
  ranking_ufs: CoreRankingResponse;
  ranking_regionais: CoreRankingResponse;
  tabela: CoreTabelaResponse;
}

export const coreApi = {
  // Uma chamada só pro dashboard inteiro — os endpoints granulares
  // (/kpis, /historico-mensal, /ranking/*, /tabela-municipios) existem no
  // backend pra debug/REST direto, mas o front não os usa: dispará-los
  // separado rodaria as queries pesadas várias vezes em paralelo (ver
  // get_overview no backend).
  overview: (f: CoreFilters) => fetchJson<CoreOverviewResponse>(`${BASE}/overview?${query(f)}`),
};
