/* =============================================================================
 * Helper de tema para ECharts
 * =============================================================================
 * - Define paleta de texto/eixos conforme tema atual
 * - Recolora todos os gráficos ativos quando o tema muda
 * =============================================================================
 */

(function () {

    // Retorna as cores base para o tema atual
    function getThemePalette() {
        const theme = (window.TIM && window.TIM.getTheme && window.TIM.getTheme()) || "light";
        if (theme === "dark") {
            return {
                theme: "dark",
                text:      "#e6edf3",
                textMuted: "#8b949e",
                axisLine:  "#3d444d",
                splitLine: "#262c37",
                tooltipBg: "#1a1f28",
                tooltipBorder: "#3d444d",
            };
        }
        return {
            theme: "light",
            text:      "#212529",
            textMuted: "#6c757d",
            axisLine:  "#999999",
            splitLine: "#eeeeee",
            tooltipBg: "#ffffff",
            tooltipBorder: "#dddddd",
        };
    }

    // Aplica overrides gerais em um option antes do setOption
    function applyThemeToOption(option) {
        const p = getThemePalette();

        // Texto padrão
        option.textStyle = Object.assign({ color: p.text }, option.textStyle || {});

        // Tooltip
        if (option.tooltip) {
            const t = Array.isArray(option.tooltip) ? option.tooltip : [option.tooltip];
            t.forEach(tp => {
                tp.backgroundColor = tp.backgroundColor || p.tooltipBg;
                tp.borderColor = tp.borderColor || p.tooltipBorder;
                tp.textStyle = Object.assign({ color: p.text }, tp.textStyle || {});
            });
        }

        // Legend
        if (option.legend) {
            const l = Array.isArray(option.legend) ? option.legend : [option.legend];
            l.forEach(lg => {
                lg.textStyle = Object.assign({ color: p.text }, lg.textStyle || {});
            });
        }

        // xAxis / yAxis
        ["xAxis", "yAxis"].forEach(axisKey => {
            if (!option[axisKey]) return;
            const arr = Array.isArray(option[axisKey]) ? option[axisKey] : [option[axisKey]];
            arr.forEach(ax => {
                ax.axisLine = ax.axisLine || {};
                ax.axisLine.lineStyle = Object.assign({ color: p.axisLine }, ax.axisLine.lineStyle || {});
                ax.axisLabel = Object.assign({ color: p.text }, ax.axisLabel || {});
                ax.splitLine = ax.splitLine || {};
                ax.splitLine.lineStyle = Object.assign({ color: p.splitLine }, ax.splitLine.lineStyle || {});
            });
        });

        return option;
    }

    // Wrapper de setOption que aplica o tema
    function themedSetOption(chart, option, notMerge) {
        applyThemeToOption(option);
        chart.setOption(option, notMerge);
    }

    // Reaplica o tema em todos os gráficos ECharts existentes na página
    function reapplyToAllCharts() {
        if (!window.echarts) return;
        document.querySelectorAll("div").forEach(el => {
            const inst = echarts.getInstanceByDom(el);
            if (!inst) return;
            const current = inst.getOption();
            applyThemeToOption(current);
            inst.setOption(current, false);
        });
    }

    // Ao trocar de tema, recolore tudo
    window.addEventListener("tim:theme-changed", reapplyToAllCharts);

    // Expõe API global
    window.TIMCharts = {
        getThemePalette: getThemePalette,
        applyThemeToOption: applyThemeToOption,
        themedSetOption: themedSetOption,
        reapplyToAllCharts: reapplyToAllCharts,
    };
})();