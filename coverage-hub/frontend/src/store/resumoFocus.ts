import { create } from "zustand";

/**
 * Cross-filter do Resumo: as APIs de R1/R2/R3 não aceitam filtro de
 * tecnologia/regional (só uf/município/ano), então "filtrar" aqui
 * significa realçar a seleção nas outras raias — clicar numa barra de
 * tecnologia ou numa fatia de regional sincroniza o destaque em todos
 * os painéis que têm aquela mesma dimensão, sem precisar refazer a
 * consulta ao banco.
 */
interface ResumoFocusState {
  tecnologia: string | null;
  regional: string | null;
  toggleTecnologia: (tec: string) => void;
  toggleRegional: (regional: string) => void;
  clear: () => void;
}

export const useResumoFocusStore = create<ResumoFocusState>((set, get) => ({
  tecnologia: null,
  regional: null,
  toggleTecnologia: (tec) =>
    set({ tecnologia: get().tecnologia === tec ? null : tec }),
  toggleRegional: (regional) =>
    set({ regional: get().regional === regional ? null : regional }),
  clear: () => set({ tecnologia: null, regional: null }),
}));
