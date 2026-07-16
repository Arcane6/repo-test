import { create } from "zustand";

/**
 * Estado de filtro do módulo Tráfego — próprio, NÃO reaproveita o
 * useFilterStore do Acesso Móvel (convenção do portal: filtro escolhido
 * num módulo não deve vazar pro outro ao trocar de aba). Só geografia
 * (UF/Município); tempo é fixo por raia (Fechamento 25 / Plano 26 /
 * Fechamento 26), não é filtro de usuário.
 */
export type TrafficFilterDimension = "uf" | "municipio";

interface TrafficFilterState {
  uf: string[];
  municipio: string[];
  setValues: (dimension: TrafficFilterDimension, values: string[]) => void;
  clear: () => void;
}

export const useTrafficFilterStore = create<TrafficFilterState>((set) => ({
  uf: [],
  municipio: [],
  setValues: (dimension, values) =>
    set(() => ({ [dimension]: values }) as Partial<TrafficFilterState>),
  clear: () => set({ uf: [], municipio: [] }),
}));
