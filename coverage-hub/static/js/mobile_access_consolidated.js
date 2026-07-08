/* =============================================================================
 * Mobile Access — Aba CONSOLIDADO (Rede + Plano)
 * ============================================================================= */

const API_BASE = "/mobile-access/api/consolidated";
const ACTUAL_BASE = "/mobile-access/api/actual";
const PLAN_BASE = "/mobile-access/api/plan";

let ufChoices, municipioChoices, tecnologiaChoices;
let gapChart, timelineChart;

// Estado da tabela delta
let deltaData = [];
let deltaFiltered = [];
let deltaSortState = { col: "ganho_total", dir: -1 };

const TECH_COLORS = {
    "2G": "#1E88E5",
    "3G": "#E53935",
    "4G": "#F5C518",
    "5G": "#7DC242",
};


// -----------------------------------------------------------------------------
// Filtros
// -----------------------------------------------------------------------------

function selectedValues(instance) {
    if (!instance) return [];
    return instance.getValue(true) || [];
}


function buildQuery() {
    const params = new URLSearchParams();
    selectedValues(ufChoices).forEach(v => params.append("uf", v));
    selectedValues(municipioChoices).forEach(v => params.append("municipio", v));
    selectedValues(tecnologiaChoices).forEach(v => params.append("tecnologia", v));

    const ano = document.getElementById("filter-ano").value;
    if (ano) params.append("ano", ano);

    if (document.getElementById("filter-canceladas").checked) {
        params.append("include_closed", "1");
    }
    if (document.getElementById("filter-operacoes").checked) {
        params.append("include_ops", "1");
    }
    return params.toString();
}


// -----------------------------------------------------------------------------
// Load dropdowns
// -----------------------------------------------------------------------------

async function loadUFs() {
    const response = await fetch(`${ACTUAL_BASE}/ufs`);
    const ufs = await response.json();
    ufChoices.setChoices(
        ufs.map(u => ({ value: u, label: u })),
        "value", "label", true
    );
}

async function loadYears() {
    const response = await fetch(`${PLAN_BASE}/years`);
    const years = await response.json();
    const select = document.getElementById("filter-ano");
    select.innerHTML = "";
    years.forEach((y, idx) => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        if (idx === 0) opt.selected = true;
        select.appendChild(opt);
    });
}

async function searchMunicipios(query) {
    const params = new URLSearchParams();
    if (query) params.append("q", query);
    selectedValues(ufChoices).forEach(v => params.append("uf", v));
    const response = await fetch(`${ACTUAL_BASE}/municipios/search?${params.toString()}`);
    const rows = await response.json();
    return rows.map(r => ({
        value: r.municipio,
        label: `${r.municipio} (${r.uf})`
    }));
}


// -----------------------------------------------------------------------------
// KPIs "Saímos de X → Y"
// -----------------------------------------------------------------------------

async function loadKPIs() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/summary?${q}`);
    const data = await response.json();

    const container = document.getElementById("cons-kpis");
    container.innerHTML = "";

    data.cards.forEach(card => {
        const delta_pct = card.pct_projetado - card.pct_atual;
        const arrow = card.ganho > 0 ? "↗" : "→";
        const deltaColor = card.ganho > 0 ? "#28a745" : "#6c757d";

        const col = document.createElement("div");
        col.className = "col";
        col.innerHTML = `
            <div class="card shadow-sm h-100" style="border-top: 4px solid ${card.color};">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="fw-bold" style="color:${card.color}; font-size:1.1rem;">${card.label}</span>
                        <span class="badge" style="background:${deltaColor};">
                            ${arrow} +${card.ganho.toLocaleString('pt-BR')}
                        </span>
                    </div>

                    <div class="d-flex align-items-baseline gap-2">
                        <span class="text-muted small">Hoje:</span>
                        <span class="fw-bold">${card.atual.toLocaleString('pt-BR')}</span>
                        <span class="text-muted small">(${card.pct_atual}%)</span>
                    </div>

                    <div class="d-flex align-items-baseline gap-2 mt-1">
                        <span class="text-muted small">Projetado:</span>
                        <span class="fw-bold" style="color:${card.color};">
                            ${card.projetado.toLocaleString('pt-BR')}
                        </span>
                        <span class="small" style="color:${card.color};">(${card.pct_projetado}%)</span>
                    </div>

                    <div class="progress mt-2" style="height: 6px;">
                        <div class="progress-bar" role="progressbar"
                             style="width:${card.pct_atual}%; background:${card.color}; opacity:0.4;"></div>
                        <div class="progress-bar" role="progressbar"
                             style="width:${(card.pct_projetado - card.pct_atual).toFixed(2)}%;
                                    background:${card.color};"></div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(col);
    });

    // Total de municípios da amostra (para badge do gráfico)
    const badge = document.getElementById("cons-total-municipios");
    badge.textContent = `Amostra: ${data.total_municipios.toLocaleString('pt-BR')} municípios`;
}


// -----------------------------------------------------------------------------
// Gráfico Rede + Plano (barras empilhadas)
// -----------------------------------------------------------------------------

function renderGapChart(data) {
    if (!gapChart) {
        gapChart = echarts.init(document.getElementById("cons-gap-chart"));
        window.addEventListener("resize", () => gapChart.resize());
    }

    if (!data.bars || data.bars.length === 0) {
        gapChart.clear();
        gapChart.setOption({
            title: {
                text: "Sem dados", left: "center", top: "center",
                textStyle: { color: "#999", fontSize: 14 },
            },
        });
        return;
    }

    const cats = data.bars.map(b => b.tec);
    const atuais = data.bars.map(b => ({
        value: b.atual,
        itemStyle: { color: b.color },
    }));
    const ganhos = data.bars.map(b => ({
        value: b.ganho,
        itemStyle: { color: "#FD7E14" },
    }));

    const option = {
        grid: { left: 60, right: 40, top: 60, bottom: 60 },
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params) => {
                const tec = params[0].axisValue;
                const bar = data.bars.find(b => b.tec === tec);
                if (!bar) return "";
                return `
                    <b>${tec}</b><br/>
                    <span style="color:#999">Rede atual:</span> ${bar.atual.toLocaleString('pt-BR')} (${bar.pct_atual}%)<br/>
                    <span style="color:${bar.color};">Ganho plano:</span> ${bar.ganho.toLocaleString('pt-BR')}<br/>
                    <b>Projetado:</b> ${bar.projetado.toLocaleString('pt-BR')} (${bar.pct_projetado}%)
                `;
            },
        },
        legend: {
            top: 10,
            data: [
                { name: "Rede Atual", icon: "rect" },
                { name: "Ganho do Plano", icon: "rect" },
            ],
            textStyle: { fontWeight: "bold" },
        },
        xAxis: {
            type: "category",
            data: cats,
            axisLabel: { fontSize: 13, fontWeight: "bold" },
        },
        yAxis: {
            type: "value",
            splitLine: { lineStyle: { color: "#eee" } },
            axisLabel: { formatter: (v) => v.toLocaleString('pt-BR') },
        },
        series: [
            {
                name: "Rede Atual",
                type: "bar",
                stack: "total",
                data: atuais,
                itemStyle: { color: "#003399" },
                barMaxWidth: 60,
                label: {
                    show: true, position: "inside",
                    formatter: (p) => p.value ? p.value.toLocaleString('pt-BR') : "",
                    color: "#fff", fontWeight: "bold",
                },
            },
            {
                name: "Ganho do Plano",
                type: "bar",
                stack: "total",
                data: ganhos,
                barMaxWidth: 60,
                itemStyle: { color: "#FD7E14" },
                label: {
                    show: true, position: "top",
                    formatter: (p) => {
                        const bar = data.bars[p.dataIndex];
                        return bar.projetado.toLocaleString('pt-BR');
                    },
                    fontWeight: "bold", color: "#333", fontSize: 12,
                },
            },
        ],
    };

    gapChart.setOption(option, true);
}


async function loadGap() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/gap?${q}`);
    const data = await response.json();
    renderGapChart(data);
}


// -----------------------------------------------------------------------------
// Timeline Histórica + Projeção
// -----------------------------------------------------------------------------

function renderTimeline(data) {
    if (!timelineChart) {
        timelineChart = echarts.init(document.getElementById("cons-timeline-chart"));
        window.addEventListener("resize", () => timelineChart.resize());
    }

    if (!data.series || data.series.length === 0 || data.periods.length === 0) {
        timelineChart.clear();
        timelineChart.setOption({
            title: {
                text: "Sem dados para os filtros selecionados",
                left: "center", top: "center",
                textStyle: { color: "#999", fontSize: 14 },
            },
        });
        return;
    }

    const xAxis = [...data.periods, data.projection_point];

    // Uma série sólida (histórico) + uma série tracejada (projeção)
    const seriesConfig = [];
    data.series.forEach(s => {
        const solidVals = [...s.historical];
        // Preenche o último ponto (dez/ano) com null na série sólida
        solidVals.push(null);

        // Série tracejada: só 2 pontos (último histórico → projetado)
        const dashVals = new Array(xAxis.length).fill(null);
        const lastIdx = s.historical.length - 1;
        if (lastIdx >= 0) {
            dashVals[lastIdx] = s.historical[lastIdx];
            dashVals[xAxis.length - 1] = s.projected_point.value;
        }

        // Linha sólida (histórico)
        seriesConfig.push({
            name: s.tec,
            type: "line",
            step: "end",
            showSymbol: false,
            data: solidVals,
            lineStyle: { color: s.color, width: 2 },
            itemStyle: { color: s.color },
            areaStyle: { color: s.color, opacity: 0.2 },
        });

        // Linha tracejada (projeção)
        seriesConfig.push({
            name: `${s.tec} (proj.)`,
            type: "line",
            data: dashVals,
            connectNulls: true,
            showSymbol: true,
            symbolSize: 10,
            lineStyle: { color: s.color, width: 2, type: "dashed" },
            itemStyle: { color: s.color, borderColor: "#fff", borderWidth: 2 },
        });
    });

    // Área destacada da projeção (mês corrente → dez)
    const lastRealIdx = data.periods.length - 1;

    const option = {
        grid: { left: 60, right: 40, top: 40, bottom: 80 },
        tooltip: {
            trigger: "axis",
            formatter: (params) => {
                if (!params || !params.length) return "";
                const date = params[0].axisValue;
                const rows = params
                    .filter(p => p.value !== null && p.value !== undefined)
                    .sort((a, b) => b.value - a.value)
                    .map(p => `
                        <div style="display:flex; align-items:center; gap:8px; margin:2px 0;">
                            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
                            <b>${p.seriesName}</b>
                            <span style="margin-left:auto; font-weight:bold;">${p.value.toLocaleString('pt-BR')}</span>
                        </div>
                    `).join("");
                return `<div style="font-weight:bold; margin-bottom:4px;">${date}</div>${rows}`;
            },
        },
        legend: {
            bottom: 5,
            data: data.series.map(s => s.tec),
            icon: "circle",
            textStyle: { fontWeight: "bold" },
        },
        xAxis: {
            type: "category",
            data: xAxis.map(p => p.slice(0, 7)),
            boundaryGap: false,
            axisLine: { lineStyle: { color: "#999" } },
            axisLabel: {
                interval: (index, value) => {
                    const [year, month] = value.split("-");
                    return month === "01" && (parseInt(year, 10) % 5 === 0);
                },
                formatter: (v) => v.slice(0, 4),
                fontWeight: "bold",
            },
        },
        yAxis: {
            type: "value",
            splitLine: { lineStyle: { color: "#eee" } },
            axisLabel: { formatter: (v) => v.toLocaleString('pt-BR') },
        },
        // Marca visual da zona de projeção
        series: seriesConfig,
        graphic: [{
            type: "text",
            right: 45,
            top: 15,
            style: {
                text: "→ Projeção",
                fill: "#999",
                fontSize: 11,
                fontStyle: "italic",
            },
        }],
    };

    timelineChart.setOption(option, true);
}


async function loadTimeline() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/timeline?${q}`);
    const data = await response.json();
    renderTimeline(data);
}


// -----------------------------------------------------------------------------
// Tabela Delta por UF
// -----------------------------------------------------------------------------

async function loadDelta() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/delta-by-uf?${q}`);
    deltaData = await response.json();
    applyDeltaFilters();
    renderDeltaTotals();
}


function applyDeltaFilters() {
    const term = (document.getElementById("cons-delta-search").value || "").toLowerCase();
    deltaFiltered = deltaData.filter(r =>
        !term || (r.uf || "").toLowerCase().includes(term)
    );

    if (deltaSortState.col) {
        deltaFiltered.sort((a, b) => {
            const va = a[deltaSortState.col];
            const vb = b[deltaSortState.col];
            if (va < vb) return -1 * deltaSortState.dir;
            if (va > vb) return 1 * deltaSortState.dir;
            return 0;
        });
    }
    renderDelta();
}


function renderDelta() {
    const body = document.getElementById("cons-delta-body");
    body.innerHTML = "";

    if (deltaFiltered.length === 0) {
        body.innerHTML = `
            <tr><td colspan="6" class="text-center text-muted py-4">
                Nenhuma UF ganha cobertura nova com os filtros atuais
            </td></tr>
        `;
        document.getElementById("cons-delta-info").textContent = "";
        return;
    }

    deltaFiltered.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="fw-bold">${r.uf}</td>
            <td class="text-center">${r.ganho_2g ? r.ganho_2g.toLocaleString('pt-BR') : '<span class="text-muted">—</span>'}</td>
            <td class="text-center">${r.ganho_3g ? r.ganho_3g.toLocaleString('pt-BR') : '<span class="text-muted">—</span>'}</td>
            <td class="text-center">${r.ganho_4g ? r.ganho_4g.toLocaleString('pt-BR') : '<span class="text-muted">—</span>'}</td>
            <td class="text-center">${r.ganho_5g ? r.ganho_5g.toLocaleString('pt-BR') : '<span class="text-muted">—</span>'}</td>
            <td class="text-center fw-bold">${r.ganho_total.toLocaleString('pt-BR')}</td>
        `;
        body.appendChild(tr);
    });

    document.getElementById("cons-delta-info").textContent =
        `${deltaFiltered.length} UF(s) com ganho`;
}


function renderDeltaTotals() {
    // Totais no rodapé sempre baseados no dataset completo (não filtrado)
    const totals = deltaData.reduce((acc, r) => ({
        g2: acc.g2 + (r.ganho_2g || 0),
        g3: acc.g3 + (r.ganho_3g || 0),
        g4: acc.g4 + (r.ganho_4g || 0),
        g5: acc.g5 + (r.ganho_5g || 0),
        gt: acc.gt + (r.ganho_total || 0),
    }), { g2: 0, g3: 0, g4: 0, g5: 0, gt: 0 });

    document.getElementById("cons-total-2g").textContent = totals.g2.toLocaleString('pt-BR');
    document.getElementById("cons-total-3g").textContent = totals.g3.toLocaleString('pt-BR');
    document.getElementById("cons-total-4g").textContent = totals.g4.toLocaleString('pt-BR');
    document.getElementById("cons-total-5g").textContent = totals.g5.toLocaleString('pt-BR');
    document.getElementById("cons-total-total").textContent = totals.gt.toLocaleString('pt-BR');
}


function initDeltaEvents() {
    document.getElementById("cons-delta-search")
        .addEventListener("input", applyDeltaFilters);

    document.querySelectorAll("th.sortable").forEach(th => {
        if (!th.closest("table")) return;
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
            const col = th.dataset.col;
            if (!col) return;
            if (deltaSortState.col === col) {
                deltaSortState.dir *= -1;
            } else {
                deltaSortState.col = col;
                deltaSortState.dir = col === "uf" ? 1 : -1;
            }
            applyDeltaFilters();
        });
    });
}



// -----------------------------------------------------------------------------
// Refresh & Init
// -----------------------------------------------------------------------------

async function refreshAll() {
    await Promise.all([
        loadKPIs(),
        loadGap(),
        loadTimeline(),
        loadDelta(),
    ]);
}


function initChoices() {
    ufChoices = new Choices("#filter-uf", {
        removeItemButton: true, placeholder: true,
        placeholderValue: "Todas as UFs",
        searchPlaceholderValue: "Buscar UF...",
        shouldSort: false,
    });

    municipioChoices = new Choices("#filter-municipio", {
        removeItemButton: true, placeholder: true,
        placeholderValue: "Digite um município...",
        searchPlaceholderValue: "Digite para buscar...",
        shouldSort: false,
    });

    tecnologiaChoices = new Choices("#filter-tecnologia", {
        removeItemButton: true, placeholder: true,
        placeholderValue: "Todas as tecnologias",
        shouldSort: false,
    });

    let debounce;
    const munEl = document.getElementById("filter-municipio");
    munEl.addEventListener("search", async (e) => {
        clearTimeout(debounce);
        const query = e.detail.value;
        debounce = setTimeout(async () => {
            const items = await searchMunicipios(query);
            municipioChoices.setChoices(items, "value", "label", true);
        }, 250);
    });

    ["filter-uf", "filter-municipio", "filter-tecnologia",
     "filter-ano", "filter-canceladas", "filter-operacoes"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", refreshAll);
    });

    document.getElementById("btn-clear").addEventListener("click", async () => {
        ufChoices.removeActiveItems();
        municipioChoices.removeActiveItems();
        tecnologiaChoices.removeActiveItems();
        document.getElementById("filter-canceladas").checked = false;
        document.getElementById("filter-operacoes").checked = false;
        await refreshAll();
    });
}


(async function init() {
    initChoices();
    initDeltaEvents();
    await Promise.all([loadUFs(), loadYears()]);
    await refreshAll();
})();