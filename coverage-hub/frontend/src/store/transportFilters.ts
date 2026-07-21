import { create } from "zustand";

/** Estado de filtro do módulo Transporte — próprio (não vaza pros outros).
 * UF + Município + Regional (Transporte tem REGIONAL como dimensão limpa). */
export type TransportFilterDimension = "uf" | "municipio" | "regional";

interface TransportFilterState {
  uf: string[];
  municipio: string[];
  regional: string[];
  setValues: (d: TransportFilterDimension, values: string[]) => void;
  clear: () => void;
}

export const useTransportFilterStore = create<TransportFilterState>((set) => ({
  uf: [],
  municipio: [],
  regional: [],
  setValues: (d, values) => set(() => ({ [d]: values }) as Partial<TransportFilterState>),
  clear: () => set({ uf: [], municipio: [], regional: [] }),
}));
