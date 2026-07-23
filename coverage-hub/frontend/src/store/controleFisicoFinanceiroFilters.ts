import { create } from "zustand";
import type { Camada } from "../api/controleFisicoFinanceiro";

/** Filtro do módulo Controle Físico-Financeiro. `camada` troca a tabela
 * inteira (Acesso × Transporte têm dimensões diferentes); os demais são os
 * filtros "de banco" (resolvidos no backend, iguais aos outros módulos). Os
 * filtros complexos por coluna (dimensão, status, valor, data) ficam locais
 * na grid, via TanStack Table, não aqui. */
export type FilterDimension = "uf" | "municipio" | "regional" | "projeto" | "status";

interface ControleFisicoFinanceiroFilterState {
  camada: Camada;
  uf: string[];
  municipio: string[];
  regional: string[];
  projeto: string[];
  status: string[];
  anoPlano: string | null;
  setCamada: (camada: Camada) => void;
  setValues: (d: FilterDimension, values: string[]) => void;
  setAnoPlano: (ano: string | null) => void;
  clear: () => void;
}

export const useControleFisicoFinanceiroFilterStore = create<ControleFisicoFinanceiroFilterState>((set) => ({
  camada: "acesso",
  uf: [],
  municipio: [],
  regional: [],
  projeto: [],
  status: [],
  anoPlano: null,
  setCamada: (camada) => set({ camada }),
  setValues: (d, values) => set(() => ({ [d]: values }) as Partial<ControleFisicoFinanceiroFilterState>),
  setAnoPlano: (ano) => set({ anoPlano: ano }),
  clear: () => set({ uf: [], municipio: [], regional: [], projeto: [], status: [], anoPlano: null }),
}));
