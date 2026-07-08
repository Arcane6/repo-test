import { useThemeStore } from "../theme/useThemeStore";

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
      title="Alternar tema claro/escuro"
      onClick={toggle}
    >
      <i className={isDark ? "bi bi-sun-fill" : "bi bi-moon-stars-fill"} />
      <span className="d-none d-md-inline">{isDark ? "Claro" : "Escuro"}</span>
    </button>
  );
}
