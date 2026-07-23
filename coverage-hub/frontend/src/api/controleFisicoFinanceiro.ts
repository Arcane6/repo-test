import { fetchJson, postJson } from "./client";

const BASE = "/controle-fisico-financeiro/api";

export type Camada = "acesso" | "transporte";

export interface DimensaoMeta {
  campo: string;
  label: string;
  opcoes: string[];
}

export interface CamadaMeta {
  key: Camada;
  label: string;
  dimensao_1: DimensaoMeta;
  dimensao_2: DimensaoMeta;
}

export interface CamadasResponse {
  camadas: CamadaMeta[];
  status_options: string[];
  tipo_evento_options: string[];
}

export interface EventoRow {
  id_evento: number;
  item_id: string;
  projeto: string | null;
  ano_plano: number | null;
  ibge_id: number | null;
  uf: string | null;
  municipio: string | null;
  regional: string | null;
  dimensao_1: string | null;
  dimensao_2: string | null;
  status: string | null;
  data_planejada: string | null;
  data_realizada: string | null;
  valor_planejado: number | null;
  valor_realizado: number | null;
  moeda: string | null;
  tipo_evento: string | null;
  data_evento: string | null;
  usuario_lancamento: string | null;
  observacao: string | null;
}

export interface EstadoAtualResponse {
  rows: EventoRow[];
  total: number;
}

export interface OpcoesResponse {
  [column: string]: string[];
}

export interface GeoFilters {
  uf: string[];
  municipio: string[];
  regional: string[];
  projeto: string[];
  status: string[];
  ano_plano?: string | null;
}

function query(f: GeoFilters): string {
  const p = new URLSearchParams();
  f.uf.forEach((v) => p.append("uf", v));
  f.municipio.forEach((v) => p.append("municipio", v));
  f.regional.forEach((v) => p.append("regional", v));
  f.projeto.forEach((v) => p.append("projeto", v));
  f.status.forEach((v) => p.append("status", v));
  if (f.ano_plano) p.append("ano_plano", f.ano_plano);
  return p.toString();
}

/** Novo lançamento pra gravar (ITEM_ID omitido = item novo). Cada POST vira
 * um evento novo — nunca sobrescreve o anterior. */
export interface NovoEvento {
  item_id?: string;
  projeto: string;
  ano_plano: number;
  ibge_id?: number | null;
  uf?: string | null;
  municipio?: string | null;
  regional?: string | null;
  dimensao_1?: string | null;
  dimensao_2?: string | null;
  status: string;
  data_planejada?: string | null;
  data_realizada?: string | null;
  valor_planejado?: number | null;
  valor_realizado?: number | null;
  moeda?: string | null;
  tipo_evento: string;
  observacao?: string | null;
}

export const controleFisicoFinanceiroApi = {
  camadas: () => fetchJson<CamadasResponse>(`${BASE}/camadas`),
  estadoAtual: (camada: Camada, f: GeoFilters) =>
    fetchJson<EstadoAtualResponse>(`${BASE}/${camada}/atual?${query(f)}`),
  historico: (camada: Camada, itemId: string) =>
    fetchJson<EstadoAtualResponse>(`${BASE}/${camada}/historico/${encodeURIComponent(itemId)}`),
  opcoes: (camada: Camada) => fetchJson<OpcoesResponse>(`${BASE}/${camada}/opcoes`),
  criarEventos: (camada: Camada, usuario: string, eventos: NovoEvento[]) =>
    postJson<{ inseridos: number }>(`${BASE}/${camada}/eventos`, { usuario, eventos }),
};
