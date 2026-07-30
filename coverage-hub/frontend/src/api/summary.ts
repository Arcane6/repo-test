import { fetchJson } from "./client";

const BASE = "/mobile-access/api/summary";

/** Resumo não usa filtro de tecnologia (é "N/A" nessa aba) — geo + ano +
 * regional/projeto (cross-filter: clicar num regional ou projeto refiltra
 * todos os gráficos da aba, não só realça visualmente). */
export interface SummaryFilters {
  uf: string[];
  municipio: string[];
  ano: string | null;
  regionais?: string[];
  projetos?: string[];
}

function query(filters: SummaryFilters): string {
  const params = new URLSearchParams();
  filters.uf.forEach((v) => params.append("uf", v));
  filters.municipio.forEach((v) => params.append("municipio", v));
  if (filters.ano) params.append("ano", filters.ano);
  (filters.regionais ?? []).forEach((v) => params.append("regional", v));
  (filters.projetos ?? []).forEach((v) => params.append("projeto", v));
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
}

export interface Slice {
  label: string;
  value: number;
}

export interface SlicesResponse {
  slices: Slice[];
  total: number;
}

export interface CasaNovaNexusResponse {
  total: number;
  por_tech: { tech: string; qtd: number }[];
}

export interface RegionalSeriesResponse {
  categories: string[];
  series: TechSeries[];
  total_base: number;
  total_ganho: number;
  total: number;
}

export interface StackedByGroupResponse {
  categories: string[];
  series: { name: string; color: string; data: number[] }[];
  total: number;
}

/** Um cenário do combo de "Endereço por Tecnologia" (CAC por 4G/5G x
 * CN/CE, rateado por OC — responde a filtro geográfico/ano). */
export interface EnderecoPorTecnologiaCenario {
  cenario: string;
  categories: string[];
  series: { name: string; color: string; data: number[] }[];
  total: number;
}

export interface EnderecoPorTecnologiaResponse {
  cenarios: EnderecoPorTecnologiaCenario[];
  cenario_default: string | null;
}

/** Uma linha (projeto) da tabela de CAC por projeto. `total_cac` é só a
 * soma das 3 camadas pivotadas (5G/4G/4G in 5G) — "outras camadas" fica
 * de fora do cálculo por pedido explícito do usuário (ver CLAUDE.md).
 * Sem `valor_mm`: a coluna "Valor (R$ mi)" saiu desta tabela (o valor
 * financeiro voltou a aparecer, mas só no resumo `CacResumoTech` ao
 * lado — ver `CacResumoTecnologia.tsx`). */
export interface CacProjetoLinha {
  projeto: string;
  cac_5g: number;
  cac_4g: number;
  cac_4g_in_5g: number;
  total_cac: number;
}

export type CacProjetoAgg = Omit<CacProjetoLinha, "projeto">;

/** Segundo nível da pivot: SOURCE_AJUSTADO (TIM, B2B Mobile...). */
export interface CacProjetoSegmento {
  segmento: string;
  linhas: CacProjetoLinha[];
  subtotal: CacProjetoAgg;
}

export interface CacProjetoGrupo {
  tipo_casa: "CN" | "CE";
  label: string;
  segmentos: CacProjetoSegmento[];
  subtotal: CacProjetoAgg;
}

/** Uma célula do resumo 5G x 4G: valor de cada tech + % daquele tech
 * sobre o total da linha (CAPEX ou Layers), e o total da linha. */
export interface CacResumoCelula {
  v5g: number;
  pct5g: number;
  v4g: number;
  pct4g: number;
  total: number;
}

/** Resumo nacional CAPEX + Layers por tecnologia (5G x 4G) do mesmo
 * cenário do CAC por Projeto — "4G in 5G Layers" entra dentro de "4G". */
export interface CacResumoTech {
  capex: CacResumoCelula;
  layers: CacResumoCelula;
  casa_nova: CacResumoCelula;
  casa_existente: CacResumoCelula;
}

export interface CacPorProjetoCenario {
  cenario: string;
  grupos: CacProjetoGrupo[];
  total: CacProjetoAgg;
  resumo_tech: CacResumoTech;
}

export interface CacPorProjetoResponse {
  cenarios: CacPorProjetoCenario[];
  cenario_default: string | null;
}

/** Contagem de sites por combinação exata de tecnologias (2G/3G/4G/5G) —
 * as 15 regiões não vazias de um diagrama de Venn de 4 conjuntos. */
export interface SitesVennResponse {
  regions: Record<string, number>;
  total_sites: number;
}

/** Árvore de composição de sites (Total de Sites Ativos), mesmo universo
 * de r1SitesVenn/r1Vendors — ver shared/site_universe.py no backend. */
export interface SitesHierarchyResponse {
  total_ativos: number;
  total_tim_rf_tx: number;
  sem_rf: number;
  mobile_sites: number;
  tim: number;
  macro: number;
  small_cell_movel_sls: number;
  ran_sharing: number;
  roaming_vivo: number;
}

export const summaryApi = {
  years: () => fetchJson<number[]>(`${BASE}/years`),

  r1SitesVenn: (f: SummaryFilters, siteVennRegion?: string | null) => {
    const params = query(f);
    const extra = siteVennRegion ? `&sitevenn=${encodeURIComponent(siteVennRegion)}` : "";
    return fetchJson<SitesVennResponse>(`${BASE}/r1/sites-venn?${params}${extra}`);
  },

  r1CitiesByTech: (f: SummaryFilters) =>
    fetchJson<TechBarsResponse>(`${BASE}/r1/cities-by-tech?${query(f)}`),
  r1Vendors: (f: SummaryFilters) =>
    fetchJson<LabeledValue[]>(`${BASE}/r1/vendors?${query(f)}`),
  r1SitesHierarchy: (f: SummaryFilters) =>
    fetchJson<SitesHierarchyResponse>(`${BASE}/r1/sites-hierarchy?${query(f)}`),

  r2NewCitiesByAnf: (f: SummaryFilters) =>
    fetchJson<SlicesResponse>(`${BASE}/r2/new-cities-by-anf?${query(f)}`),
  r2VendorsNewSites: (f: SummaryFilters) =>
    fetchJson<LabeledValue[]>(`${BASE}/r2/vendors-new-sites?${query(f)}`),
  /** Meta NEXUS de Casa Nova, rateada geograficamente pelo rollout — responde a UF/município/regional. */
  r2CasaNovaNexus: (f: SummaryFilters) =>
    fetchJson<CasaNovaNexusResponse>(`${BASE}/r2/casa-nova-nexus?${query(f)}`),
  /** CAC em 3 níveis (Casa Nova/Existente > segmento > projeto) — nacional,
   * sem rateio (a view não tem dimensão geográfica); o combo de cenário é
   * escolhido no front, sem request novo. */
  r2CacPorProjeto: () =>
    fetchJson<CacPorProjetoResponse>(`${BASE}/r2/cac-por-projeto`),
  r2OrcamentoPorTecnologia: (f: SummaryFilters) =>
    fetchJson<StackedByGroupResponse>(`${BASE}/r2/orcamento-por-tecnologia?${query(f)}`),
  /** CAC rateado por OC (geo/ano respondem a filtro, igual Orçamento por
   * Tecnologia) e por cenário (VW_CAPEX_MASTER_FULL) — o combo de cenário
   * é escolhido no front, sem request novo. */
  r2EnderecoPorTecnologia: (f: SummaryFilters) =>
    fetchJson<EnderecoPorTecnologiaResponse>(`${BASE}/r2/endereco-por-tecnologia?${query(f)}`),

  r3NewCitiesByAnf: (f: SummaryFilters) =>
    fetchJson<RegionalSeriesResponse>(`${BASE}/r3/new-cities-by-anf?${query(f)}`),
  r3Vendors: (f: SummaryFilters) =>
    fetchJson<LabeledValue[]>(`${BASE}/r3/vendors?${query(f)}`),
};
