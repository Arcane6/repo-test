/* =============================================================================
 * TIM Technical Planning — utilitários globais e tema
 * ============================================================================= */

(function () {
    const THEME_KEY = "tim-theme";

    function getTheme() {
        try {
            return localStorage.getItem(THEME_KEY) || "light";
        } catch (e) {
            return "light";
        }
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-bs-theme", theme);
        document.documentElement.setAttribute("data-theme", theme);

        // Atualiza ícone e label do botão
        const icon = document.getElementById("theme-icon");
        const label = document.getElementById("theme-label");

        if (icon) {
            icon.className = theme === "dark"
                ? "bi bi-sun-fill"
                : "bi bi-moon-stars-fill";
        }
        if (label) {
            label.textContent = theme === "dark" ? "Claro" : "Escuro";
        }

        // Notifica quem quiser redesenhar (ex: ECharts)
        window.dispatchEvent(new CustomEvent("tim:theme-changed", {
            detail: { theme: theme },
        }));
    }

    function toggleTheme() {
        const current = getTheme();
        const next = current === "dark" ? "light" : "dark";
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch (e) {}
        applyTheme(next);
    }

    // Aplica ao carregar (o script inline do <head> já fez a primeira parte;
    // aqui só sincronizamos ícone/label)
    document.addEventListener("DOMContentLoaded", function () {
        applyTheme(getTheme());

        const btn = document.getElementById("theme-toggle");
        if (btn) btn.addEventListener("click", toggleTheme);
    });

    // API global
    window.TIM = window.TIM || {};
    window.TIM.getTheme = getTheme;
    window.TIM.setTheme = function (t) {
        try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
        applyTheme(t);
    };
    window.TIM.toggleTheme = toggleTheme;

    window.TIM.fmt = function (n) {
        return (n ?? 0).toLocaleString("pt-BR");
    };
    window.TIM.pct = function (v, total) {
        if (!total) return "0%";
        return ((v / total) * 100).toFixed(2) + "%";
    };
})();