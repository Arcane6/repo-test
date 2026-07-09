import { create } from "zustand";

/**
 * Estado global de seleção/filtro compartilhado entre todos os gráficos
 * de um dashboard. Qualquer componente pode ler uma dimensão (para
 * consultar dados) e qualquer componente pode escrever nela (ao ser
 * clicado) — isso é o mecanismo de cross-filtering entre visuais.
 */
export type FilterListDimension = "uf" | "municipio" | "tecnologia";

/** Região do diagrama de Venn (Presença nos Municípios): combinação exata
 * de tecnologias presentes/ausentes, ex.: "only_2g" (só 2G, sem 3G/5G) ou
 * "inter_all" (2G+3G+5G). Clicar numa fatia filtra todo o dashboard por
 * essa combinação exata — diferente do filtro de tecnologia (que é "tem
 * pelo menos uma dessas"). */
export type VennRegionKey =
  | "only_2g"
  | "only_3g"
  | "only_5g"
  | "inter_2g_3g"
  | "inter_2g_5g"
  | "inter_3g_5g"
  | "inter_all";

interface FilterState {
  uf: string[];
  municipio: string[];
  tecnologia: string[];
  ano: string | null;
  vennRegion: VennRegionKey | null;
  toggle: (dimension: FilterListDimension, value: string) => void;
  setValues: (dimension: FilterListDimension, values: string[]) => void;
  setAno: (ano: string | null) => void;
  toggleVennRegion: (region: VennRegionKey) => void;
  clear: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  uf: [],
  municipio: [],
  tecnologia: [],
  ano: null,
  vennRegion: null,

  // Clicar num valor já selecionado remove o filtro (comportamento padrão
  // de cross-highlighting: clicar de novo "desliga" o filtro).
  toggle: (dimension, value) =>
    set((state) => {
      const current = state[dimension];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { [dimension]: next } as Partial<FilterState>;
    }),

  setValues: (dimension, values) =>
    set(() => ({ [dimension]: values }) as Partial<FilterState>),

  setAno: (ano) => set({ ano }),

  toggleVennRegion: (region) =>
    set((state) => ({ vennRegion: state.vennRegion === region ? null : region })),

  clear: () => set({ uf: [], municipio: [], tecnologia: [], vennRegion: null }),
}));
