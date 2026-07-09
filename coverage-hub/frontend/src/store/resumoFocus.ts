import { create } from "zustand";

/**
 * Cross-filter do Resumo. Tecnologia continua sendo só destaque visual
 * (nenhuma query aceita filtrar por tecnologia nessa aba — os dados já
 * vêm quebrados por tec). Regional e projeto, porém, são filtros de
 * verdade: clicar num regional (Novas Cidades por Regional, Cidades 5G
 * por Regional) ou num projeto (Top 10 Projetos) entra nos parâmetros da
 * query e refiltra TODOS os gráficos da aba, não só realça.
 */
interface ResumoFocusState {
  tecnologia: string | null;
  regional: string | null;
  projeto: string | null;
  toggleTecnologia: (tec: string) => void;
  toggleRegional: (regional: string) => void;
  toggleProjeto: (projeto: string) => void;
  clear: () => void;
}

export const useResumoFocusStore = create<ResumoFocusState>((set, get) => ({
  tecnologia: null,
  regional: null,
  projeto: null,
  toggleTecnologia: (tec) =>
    set({ tecnologia: get().tecnologia === tec ? null : tec }),
  toggleRegional: (regional) =>
    set({ regional: get().regional === regional ? null : regional }),
  toggleProjeto: (projeto) =>
    set({ projeto: get().projeto === projeto ? null : projeto }),
  clear: () => set({ tecnologia: null, regional: null, projeto: null }),
}));
