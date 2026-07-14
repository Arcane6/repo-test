import { create } from "zustand";

/**
 * Filtros do módulo Core — separados do `useFilterStore` (Acesso Móvel)
 * de propósito: são domínios de dado diferentes, então um filtro
 * escolhido aqui não deve "vazar" pro outro módulo quando o usuário
 * troca de aba (mesmo raciocínio de `resumoFocus.ts` ser um store à
 * parte pro cross-filter só do Resumo).
 */
interface CoreFilterState {
  uf: string[];
  municipio: string[];
  regional: string[];
  setValues: (dimension: "uf" | "municipio", values: string[]) => void;
  toggleRegional: (value: string) => void;
  clear: () => void;
}

export const useCoreFilterStore = create<CoreFilterState>((set) => ({
  uf: [],
  municipio: [],
  regional: [],

  setValues: (dimension, values) =>
    set(() => ({ [dimension]: values }) as Partial<CoreFilterState>),

  toggleRegional: (value) =>
    set((state) => ({
      regional: state.regional.includes(value)
        ? state.regional.filter((v) => v !== value)
        : [...state.regional, value],
    })),

  clear: () => set({ uf: [], municipio: [], regional: [] }),
}));
