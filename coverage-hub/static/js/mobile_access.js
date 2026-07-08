const API_BASE = "/mobile-access/api/actual";

let ufChoices, municipioChoices, tecnologiaChoices;
let tableData = [];
let filteredTable = [];
let sortState = { col: null, dir: 1 };
let currentPage = 1;
const PAGE_SIZE = 15;

let freqChart;
let timelineChart;


function selectedValues(instance) {
    if (!instance) return [];
    return instance.getValue(true) || [];
}


function buildQuery() {
    const params = new URLSearchParams();
    selectedValues(ufChoices).forEach(v => params.append("uf", v));
    selectedValues(municipioChoices).forEach(v => params.append("municipio", v));
    selectedValues(tecnologiaChoices).forEach(v => params.append("tecnologia", v));
    return params.toString();
}


async function loadUFs() {
    const response = await fetch(`${API_BASE}/ufs`);
    const ufs = await response.json();
    ufChoices.setChoices(
        ufs.map(u => ({ value: u, label: u })),
        "value", "label", true
    );
}


async function searchMunicipios(query) {
    const params = new URLSearchParams();
    if (query) params.append("q", query);
    selectedValues(ufChoices).forEach(v => params.append("uf", v));

    const response = await fetch(`${API_BASE}/municipios/search?${params.toString()}`);
    const rows = await response.json();

    return rows.map(r => ({
        value: r.municipio,
        label: `${r.municipio} (${r.uf})`
    }));
}


async function loadKPIs() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/kpis?${q}`);
    const data = await response.json();

    const container = document.getElementById("kpis");
    container.innerHTML = "";

    data.cards.forEach(card => {
        const col = document.createElement("div");
        col.className = "col";
        col.innerHTML = `
            <div class="card shadow-sm h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-2">
                        <span class="fw-bold text-muted">${card.label}</span>
                    </div>
                    <h2 class="fw-bold" style="color:${card.color}">
                        ${card.value.toLocaleString('pt-BR')}
                    </h2>
                    <div class="progress mb-2" style="height:8px">
                        <div class="progress-bar"
                             role="progressbar"
                             style="width:${card.percent}%; background:${card.color}">
                        </div>
                    </div>
                    <small class="fw-bold" style="color:${card.color}">
                        ${card.percent}%
                    </small>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}


function renderVennLegend(legend) {
    const container = document.getElementById("venn-legend");
    container.innerHTML = "";
    legend.forEach(item => {
        const box = document.createElement("div");
        box.className = "small";
        box.innerHTML = `
            <div class="d-flex align-items-center gap-2 fw-bold" style="color:${item.color}">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${item.color}"></span>
                ${item.label}
            </div>
            <div class="fw-bold" style="color:${item.color}">${item.value.toLocaleString('pt-BR')}</div>
            <div style="color:${item.color}">${item.percent}%</div>
        `;
        container.appendChild(box);
    });
}


function renderVennDiagram(regions) {
    const svg = d3.select("#venn-svg");
    svg.selectAll("*").remove();

    const COLOR_2G = "#1E88E5";
    const COLOR_3G = "#E53935";
    const COLOR_5G = "#7DC242";

    const R = 130;
    const c2g = { x: 180, y: 170 };
    const c3g = { x: 320, y: 170 };
    const c5g = { x: 250, y: 280 };

    [
        { c: c2g, color: COLOR_2G },
        { c: c3g, color: COLOR_3G },
        { c: c5g, color: COLOR_5G },
    ].forEach(circle => {
        svg.append("circle")
            .attr("cx", circle.c.x)
            .attr("cy", circle.c.y)
            .attr("r", R)
            .attr("fill", circle.color)
            .attr("fill-opacity", 0.55)
            .attr("stroke", circle.color)
            .attr("stroke-width", 1);
    });

    const labels = [
        { x: 110, y: 170, value: regions.only_2g,     bold: true  },
        { x: 390, y: 170, value: regions.only_3g,     bold: true  },
        { x: 250, y: 355, value: regions.only_5g,     bold: true  },
        { x: 250, y: 130, value: regions.inter_2g_3g, bold: false },
        { x: 175, y: 260, value: regions.inter_2g_5g, bold: false },
        { x: 325, y: 260, value: regions.inter_3g_5g, bold: false },
        { x: 250, y: 220, value: regions.inter_all,   bold: true  },
    ];

    labels.forEach(l => {
        svg.append("text")
            .attr("x", l.x)
            .attr("y", l.y)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#1a1a1a")
            .attr("font-weight", l.bold ? "700" : "600")
            .attr("font-size", l.bold ? "18" : "16")
            .text((l.value || 0).toLocaleString('pt-BR'));
    });
}


async function loadVenn() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/venn?${q}`);
    const data = await response.json();

    renderVennLegend(data.legend);
    renderVennDiagram(data.regions);
}


function renderFrequencyChart(data) {
    if (!freqChart) {
        freqChart = echarts.init(document.getElementById("freq-chart"));
        window.addEventListener("resize", () => freqChart.resize());
    }

    if (!data.bars || data.bars.length === 0) {
        freqChart.clear();
        freqChart.setOption({
            title: {
                text: "Sem dados para os filtros selecionados",
                left: "center",
                top: "center",
                textStyle: { color: "#999", fontSize: 14, fontWeight: "normal" },
            },
        });
        return;
    }

    const categories = data.bars.map(b => `${b.banda}|${b.tec}`);
    const values = data.bars.map(b => ({
        value: b.value,
        itemStyle: { color: b.color },
    }));

    const option = {
        grid: { left: 50, right: 20, top: 40, bottom: 70 },
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params) => {
                const p = params[0];
                const [band, tec] = p.name.split("|");
                return `<b>${tec} — ${band} MHz</b><br/>${p.value.toLocaleString('pt-BR')} municípios`;
            },
        },
        xAxis: {
            type: "category",
            data: categories,
            axisTick: { show: false },
            axisLine: { lineStyle: { color: "#999" } },
            axisLabel: {
                interval: 0,
                lineHeight: 20,
                formatter: (value) => {
                    const [band, tec] = value.split("|");
                    return `{band|${band}}\n{${tec}|${tec}}`;
                },
                rich: {
                    band: { color: "#333", fontSize: 12 },
                    "2G": { color: "#1E88E5", fontWeight: "bold", fontSize: 12 },
                    "3G": { color: "#E53935", fontWeight: "bold", fontSize: 12 },
                    "4G": { color: "#F5C518", fontWeight: "bold", fontSize: 12 },
                    "5G": { color: "#7DC242", fontWeight: "bold", fontSize: 12 },
                },
            },
        },
        yAxis: {
            type: "value",
            splitLine: { lineStyle: { color: "#eee" } },
        },
        series: [{
            type: "bar",
            data: values,
            barMaxWidth: 42,
            label: {
                show: true,
                position: "top",
                fontWeight: "bold",
                color: "#333",
                formatter: (p) => p.value.toLocaleString('pt-BR'),
            },
        }],
    };

    freqChart.setOption(option, true);
}


async function loadFrequencies() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/frequencies?${q}`);
    const data = await response.json();
    renderFrequencyChart(data);
}


async function loadTable() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/table?${q}`);
    tableData = await response.json();
    applyTableFilters();
}


function applyTableFilters() {
    const term = (document.getElementById("table-search").value || "").toLowerCase();

    filteredTable = tableData.filter(r => {
        if (!term) return true;
        return (
            (r.uf || "").toLowerCase().includes(term) ||
            (r.municipio || "").toLowerCase().includes(term)
        );
    });

    if (sortState.col) {
        filteredTable.sort((a, b) => {
            const va = a[sortState.col];
            const vb = b[sortState.col];
            if (va < vb) return -1 * sortState.dir;
            if (va > vb) return 1 * sortState.dir;
            return 0;
        });
    }

    currentPage = 1;
    renderTable();
}


function renderTable() {
    const body = document.getElementById("table-body");
    body.innerHTML = "";

    const totalPages = Math.max(1, Math.ceil(filteredTable.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredTable.slice(start, start + PAGE_SIZE);

    pageRows.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.uf}</td>
            <td>${r.municipio}</td>
            <td class="text-center">${badge(r.presenca)}</td>
            <td class="text-center">${badge(r.presenca_5g)}</td>
            <td class="text-center">${badge(r.presenca_4g)}</td>
            <td class="text-center">${badge(r.presenca_3g)}</td>
            <td class="text-center">${badge(r.presenca_2g)}</td>
        `;
        body.appendChild(tr);
    });

    document.getElementById("table-info").textContent =
        `${filteredTable.length.toLocaleString('pt-BR')} municípios`;
    document.getElementById("page-indicator").textContent =
        `Página ${currentPage} / ${totalPages}`;
}


function badge(value) {
    if (value === 1) {
        return `<span class="badge bg-success">Sim</span>`;
    }
    return `<span class="badge bg-secondary">Não</span>`;
}

function renderTimelineChart(data) {
    if (!timelineChart) {
        timelineChart = echarts.init(document.getElementById("timeline-chart"));
        window.addEventListener("resize", () => timelineChart.resize());
    }

    if (!data.series || data.series.length === 0 || data.periods.length === 0) {
        timelineChart.clear();
        timelineChart.setOption({
            title: {
                text: "Sem dados para os filtros selecionados",
                left: "center",
                top: "center",
                textStyle: { color: "#999", fontSize: 14, fontWeight: "normal" },
            },
        });
        return;
    }

    const series = data.series.map(s => ({
        name: s.tec,
        type: "line",
        smooth: false,
        step: "end",
        showSymbol: false,
        stack: null,
        lineStyle: { width: 2, color: s.color },
        itemStyle: { color: s.color },
        areaStyle: { color: s.color, opacity: 0.25 },
        emphasis: { focus: "series" },
        data: s.values,
    }));

    const option = {
        grid: { left: 55, right: 30, top: 30, bottom: 60 },
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "line" },
            formatter: (params) => {
                if (!params || !params.length) return "";
                const date = params[0].axisValue;
                const rows = params
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
            data: data.series.map(s => s.tec),
            bottom: 0,
            icon: "circle",
            textStyle: { fontWeight: "bold" },
        },
        xAxis: {
            type: "category",
            data: data.periods.map(p => p.slice(0, 7)),  // YYYY-MM
            boundaryGap: false,
            axisLine: { lineStyle: { color: "#999" } },
            axisTick: {
                alignWithLabel: true,
                // marca no eixo só nos anos múltiplos de 5, em janeiro
                interval: (index, value) => {
                    const [year, month] = value.split("-");
                    return month === "01" && (parseInt(year, 10) % 5 === 0);
                },
            },
            axisLabel: {
                // mostra o rótulo só nos anos múltiplos de 5, em janeiro
                interval: (index, value) => {
                    const [year, month] = value.split("-");
                    return month === "01" && (parseInt(year, 10) % 5 === 0);
                },
                formatter: (value) => value.slice(0, 4),
                fontWeight: "bold",
            },
        },
        yAxis: {
            type: "value",
            splitLine: { lineStyle: { color: "#eee" } },
            axisLabel: {
                formatter: (v) => v.toLocaleString('pt-BR'),
            },
        },
        series: series,
    };

    timelineChart.setOption(option, true);
}


async function loadTimeline() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/timeseries?${q}`);
    const data = await response.json();
    renderTimelineChart(data);
}


async function refreshAll() {
    await Promise.all([
        loadKPIs(),
        loadVenn(),
        loadTable(),
        loadTimeline(),
        loadFrequencies(),
    ]);
}


function initChoices() {
    ufChoices = new Choices("#filter-uf", {
        removeItemButton: true,
        placeholder: true,
        placeholderValue: "Todas as UFs",
        searchPlaceholderValue: "Buscar UF...",
        shouldSort: false,
    });

    municipioChoices = new Choices("#filter-municipio", {
        removeItemButton: true,
        placeholder: true,
        placeholderValue: "Digite um município...",
        searchPlaceholderValue: "Digite para buscar...",
        shouldSort: false,
    });

    tecnologiaChoices = new Choices("#filter-tecnologia", {
        removeItemButton: true,
        placeholder: true,
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

    ["filter-uf", "filter-municipio", "filter-tecnologia"].forEach(id => {
        document.getElementById(id).addEventListener("change", refreshAll);
    });
}


function initTableEvents() {
    document.getElementById("table-search").addEventListener("input", applyTableFilters);

    document.querySelectorAll("th.sortable").forEach(th => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
            const col = th.dataset.col;
            if (sortState.col === col) {
                sortState.dir *= -1;
            } else {
                sortState.col = col;
                sortState.dir = 1;
            }
            applyTableFilters();
        });
    });

    document.getElementById("prev-page").addEventListener("click", () => {
        if (currentPage > 1) { currentPage--; renderTable(); }
    });
    document.getElementById("next-page").addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(filteredTable.length / PAGE_SIZE));
        if (currentPage < totalPages) { currentPage++; renderTable(); }
    });

    document.getElementById("btn-clear").addEventListener("click", async () => {
        ufChoices.removeActiveItems();
        municipioChoices.removeActiveItems();
        tecnologiaChoices.removeActiveItems();
        await refreshAll();
    });
}


(async function init() {
    initChoices();
    initTableEvents();
    await loadUFs();
    await refreshAll();
})();