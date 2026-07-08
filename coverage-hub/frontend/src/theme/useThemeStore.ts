import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "tim-theme";

function readInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // localStorage indisponível (modo privado etc.) — cai no padrão
  }
  return "light";
}

function applyThemeToDocument(theme: Theme) {
  document.documentElement.setAttribute("data-bs-theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

// O tema inicial já foi aplicado ao <html> por um script inline no
// index.html (roda antes do CSS pintar, evitando flash) — aqui só
// espelhamos esse valor e cuidamos das trocas subsequentes.
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readInitialTheme(),
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignora — pior caso, não persiste entre sessões
    }
    applyThemeToDocument(next);
    set({ theme: next });
  },
}));
