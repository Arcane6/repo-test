import { create } from "zustand";

/**
 * Estado global de seleção/filtro compartilhado entre todos os gráficos
 * de um dashboard. Qualquer componente pode ler uma dimensão (para
 * consultar dados) e qualquer componente pode escrever nela (ao ser
 * clicado) — isso é o mecanismo de cross-filtering entre visuais.
 */
export type FilterListDimension = "uf" | "municipio" | "tecnologia";

interface FilterState {
  uf: string[];
  municipio: string[];
  tecnologia: string[];
  ano: string | null;
  toggle: (dimension: FilterListDimension, value: string) => void;
  setValues: (dimension: FilterListDimension, values: string[]) => void;
  setAno: (ano: string | null) => void;
  clear: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  uf: [],
  municipio: [],
  tecnologia: [],
  ano: null,

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

  clear: () => set({ uf: [], municipio: [], tecnologia: [] }),
}));
