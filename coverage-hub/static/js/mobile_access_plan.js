/* =============================================================================
 * Mobile Access — Aba PLANO
 * ============================================================================= */

const API_BASE = "/mobile-access/api/plan";
const ACTUAL_BASE = "/mobile-access/api/actual";

let ufChoices, municipioChoices, tecnologiaChoices;
let compositionChart, techChart, heatmapChart, topChart, mapChart;

// Estado da tabela
let planTableData = [];
let planFilteredTable = [];
let planSortState = { col: null, dir: 1 };
let planCurrentPage = 1;
const PLAN_PAGE_SIZE = 20;

// Cores por tecnologia
const TECH_COLORS = {
    "2G": "#1E88E5",
    "3G": "#E53935",
    "4G": "#F5C518",
    "5G": "#7DC242",
};

// Cores por classificação (paleta institucional TIM)
const CATEGORY_COLORS = {
    "NEW SITE": "#003399",
    "CASA EXISTENTE": "#7DC242",
    "CO SITE CASA NOVA": "#F5C518",
    "NÃO CLASSIFICADO": "#6c757d",
};


// -----------------------------------------------------------------------------
// Helpers de filtro
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
// Carga inicial (UFs e Anos)
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
    const response = await fetch(`${API_BASE}/years`);
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
// KPIs
// -----------------------------------------------------------------------------

async function loadKPIs() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/kpis?${q}`);
    const data = await response.json();

    const container = document.getElementById("plan-kpis");
    container.innerHTML = "";

    data.cards.forEach(card => {
        const col = document.createElement("div");
        col.className = "col";
        col.innerHTML = `
            <div class="card shadow-sm h-100">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-2">
                        <i class="bi bi-${card.icon || 'circle'} me-2"
                           style="color:${card.color}; font-size:1.2rem;"></i>
                        <span class="fw-bold text-muted small">${card.label}</span>
                    </div>
                    <h3 class="fw-bold mb-1" style="color:${card.color}">
                        ${card.value.toLocaleString('pt-BR')}
                    </h3>
                    <small class="text-muted">${card.hint || '&nbsp;'}</small>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}


// -----------------------------------------------------------------------------
// Gráfico 1 — Composição por Prioridade
// -----------------------------------------------------------------------------

function renderCompositionChart(data) {
    if (!compositionChart) {
        compositionChart = echarts.init(document.getElementById("plan-composition-chart"));
        window.addEventListener("resize", () => compositionChart.resize());
    }

    if (!data || data.length === 0) {
        compositionChart.clear();
        compositionChart.setOption({
            title: {
                text: "Sem dados para os filtros selecionados",
                left: "center", top: "center",
                textStyle: { color: "#999", fontSize: 14, fontWeight: "normal" },
            },
        });
        return;
    }

    const sliced = data.slice(0, 15).reverse();

    const option = {
        grid: { left: 200, right: 60, top: 20, bottom: 30 },
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params) => {
                const p = params[0];
                return `<b>${p.name}</b><br/>${p.value.toLocaleString('pt-BR')} OCs`;
            },
        },
        xAxis: {
            type: "value",
            axisLabel: { formatter: (v) => v.toLocaleString('pt-BR') },
            splitLine: { lineStyle: { color: "#eee" } },
        },
        yAxis: {
            type: "category",
            data: sliced.map(d => d.categoria),
            axisLabel: { fontSize: 11, width: 190, overflow: "truncate" },
        },
        series: [{
            type: "bar",
            data: sliced.map(d => d.value),
            itemStyle: {
                color: (params) => {
                    const total = sliced.length;
                    const ratio = params.dataIndex / (total - 1 || 1);
                    return `rgb(${Math.round(0 + (200 - 0) * (1 - ratio))},
                                ${Math.round(51 + (200 - 51) * (1 - ratio))},
                                ${Math.round(153 + (200 - 153) * (1 - ratio))})`;
                },
            },
            label: {
                show: true,
                position: "right",
                formatter: (p) => p.value.toLocaleString('pt-BR'),
                fontWeight: "bold",
                color: "#333",
            },
            barMaxWidth: 22,
        }],
    };

    compositionChart.setOption(option, true);
}


async function loadComposition() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/composition?${q}`);
    const data = await response.json();
    renderCompositionChart(data);
}


// -----------------------------------------------------------------------------
// Gráfico 2 — Donut Tecnologia
// -----------------------------------------------------------------------------

function renderTechChart(data) {
    if (!techChart) {
        techChart = echarts.init(document.getElementById("plan-tech-chart"));
        window.addEventListener("resize", () => techChart.resize());
    }

    const nonZero = data.filter(d => d.value > 0);

    if (nonZero.length === 0) {
        techChart.clear();
        techChart.setOption({
            title: {
                text: "Sem dados", left: "center", top: "center",
                textStyle: { color: "#999", fontSize: 14, fontWeight: "normal" },
            },
        });
        return;
    }

    const total = nonZero.reduce((s, d) => s + d.value, 0);

    const option = {
        tooltip: {
            trigger: "item",
            formatter: (p) => {
                const pct = ((p.value / total) * 100).toFixed(1);
                return `<b>${p.name}</b><br/>${p.value.toLocaleString('pt-BR')} OCs (${pct}%)`;
            },
        },
        legend: {
            bottom: 0, icon: "circle",
            textStyle: { fontWeight: "bold" },
        },
        series: [{
            type: "pie",
            radius: ["45%", "70%"],
            center: ["50%", "45%"],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 6, borderColor: "#fff", borderWidth: 2 },
            label: {
                show: true, position: "outside",
                formatter: (p) => `${p.name}\n${p.value.toLocaleString('pt-BR')}`,
                fontWeight: "bold", lineHeight: 16,
            },
            labelLine: { show: true, length: 8, length2: 8 },
            data: nonZero.map(d => ({
                name: d.label,
                value: d.value,
                itemStyle: { color: d.color },
            })),
        }],
    };

    techChart.setOption(option, true);
}


async function loadTech() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/by-tech?${q}`);
    const data = await response.json();
    renderTechChart(data);
}


// -----------------------------------------------------------------------------
// Gráfico 3 — Matrix Heatmap (Perfil × Tecnologia)
// -----------------------------------------------------------------------------

// Rótulos curtos para o eixo Y
const CATEGORY_SHORT = {
    "NEW SITE": "Novo Site",
    "CASA EXISTENTE": "Casa Existente",
    "CO SITE CASA NOVA": "Co-Site",
    "NÃO CLASSIFICADO": "N/C",
};


function renderHeatmapChart(data) {
    if (!heatmapChart) {
        heatmapChart = echarts.init(document.getElementById("plan-treemap-chart"));
        window.addEventListener("resize", () => heatmapChart.resize());
    }

    if (!data || data.length === 0) {
        heatmapChart.clear();
        heatmapChart.setOption({
            title: {
                text: "Sem dados", left: "center", top: "center",
                textStyle: { color: "#999", fontSize: 14, fontWeight: "normal" },
            },
        });
        return;
    }

    // Ordem fixa das colunas (tecnologias)
    const techs = ["2G", "3G", "4G", "5G"];

    // Ordem das linhas (perfis) — na ordem do payload (já vem por volume desc)
    const categorias = data.map(d => d.name);
    const categoriasShort = categorias.map(c => CATEGORY_SHORT[c] || c);

    // Monta matriz [colIdx, rowIdx, value]
    const points = [];
    let maxVal = 0;
    data.forEach((cat, rowIdx) => {
        (cat.children || []).forEach(child => {
            const colIdx = techs.indexOf(child.name);
            if (colIdx === -1) return;
            const val = child.value || 0;
            if (val > maxVal) maxVal = val;
            points.push([colIdx, rowIdx, val]);
        });
    });

    // Preenche células vazias com 0 (pra sempre aparecer o "0" nas ausentes)
    for (let r = 0; r < categorias.length; r++) {
        for (let c = 0; c < techs.length; c++) {
            const exists = points.some(p => p[0] === c && p[1] === r);
            if (!exists) points.push([c, r, 0]);
        }
    }

    // Totais por linha e coluna (para labels de resumo)
    const rowTotals = categorias.map((_, rowIdx) =>
        points.filter(p => p[1] === rowIdx).reduce((s, p) => s + p[2], 0)
    );
    const colTotals = techs.map((_, colIdx) =>
        points.filter(p => p[0] === colIdx).reduce((s, p) => s + p[2], 0)
    );

    const option = {
        grid: {
            left: 130,
            right: 60,
            top: 60,
            bottom: 60,
        },
        tooltip: {
            position: "top",
            formatter: (p) => {
                const cat = categorias[p.value[1]];
                const tec = techs[p.value[0]];
                const val = p.value[2];
                return `
                    <b>${CATEGORY_SHORT[cat] || cat} × ${tec}</b><br/>
                    ${val.toLocaleString('pt-BR')} OCs
                `;
            },
        },
        xAxis: {
            type: "category",
            data: techs.map((t, i) =>
                `{tec|${t}}\n{tot|${colTotals[i].toLocaleString('pt-BR')}}`
            ),
            position: "top",
            axisLine: { show: false },
            axisTick: { show: false },
            splitArea: { show: true },
            axisLabel: {
                rich: {
                    tec: { fontWeight: "bold", fontSize: 14, color: "#333", lineHeight: 20 },
                    tot: { fontSize: 10, color: "#999" },
                },
            },
        },
        yAxis: {
            type: "category",
            data: categoriasShort.map((c, i) =>
                `{name|${c}}\n{tot|${rowTotals[i].toLocaleString('pt-BR')}}`
            ),
            axisLine: { show: false },
            axisTick: { show: false },
            splitArea: { show: true },
            axisLabel: {
                rich: {
                    name: { fontWeight: "bold", fontSize: 13, color: "#333", lineHeight: 18 },
                    tot: { fontSize: 10, color: "#999" },
                },
            },
        },
        visualMap: {
            min: 0,
            max: maxVal || 1,
            calculable: true,
            orient: "horizontal",
            left: "center",
            bottom: 10,
            inRange: {
                color: ["#f4f6f8", "#c7e0a2", "#7DC242", "#3f8f1a"],
            },
            textStyle: { fontWeight: "bold" },
            text: ["Mais OCs", "Menos"],
        },
        series: [{
            type: "heatmap",
            data: points,
            label: {
                show: true,
                fontWeight: "bold",
                fontSize: 14,
                formatter: (p) => {
                    const v = p.value[2];
                    if (v === 0) return "—";
                    return v.toLocaleString('pt-BR');
                },
                color: "#212529",
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: "rgba(0,0,0,0.3)",
                    borderColor: "#003399",
                    borderWidth: 2,
                },
            },
            itemStyle: {
                borderColor: "#fff",
                borderWidth: 2,
            },
        }],
    };

    heatmapChart.setOption(option, true);
}


async function loadHeatmap() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/sunburst?${q}`);
    const data = await response.json();
    renderHeatmapChart(data);
}


// -----------------------------------------------------------------------------
// Gráfico 5 — Mapa de Calor por UF
// -----------------------------------------------------------------------------

// Mapeamento UF -> nome (formato do GeoJSON)
const UF_TO_NAME = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas",
    "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo",
    "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul",
    "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná",
    "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina",
    "SP": "São Paulo", "SE": "Sergipe", "TO": "Tocantins",
};

let brazilGeoLoaded = false;


async function ensureBrazilGeo() {
    if (brazilGeoLoaded) return;
    const resp = await fetch("/static/geo/brazil-states.geojson");
    const geojson = await resp.json();
    echarts.registerMap("brazil", geojson);
    brazilGeoLoaded = true;
}


function renderMapChart(data) {
    if (!mapChart) {
        mapChart = echarts.init(document.getElementById("plan-map-chart"));
        window.addEventListener("resize", () => mapChart.resize());
    }

    // Transforma UF -> nome do GeoJSON
    const mapped = data.map(d => ({
        name: UF_TO_NAME[d.uf] || d.uf,
        value: d.value,
        uf: d.uf,
        municipios: d.municipios,
    }));

    const total = data.reduce((s, d) => s + (d.value || 0), 0);
    const maxVal = Math.max(...data.map(d => d.value || 0), 1);

    document.getElementById("plan-map-total").textContent =
        `Total: ${total.toLocaleString('pt-BR')} OCs em ${data.length} UF(s)`;

    const option = {
        tooltip: {
            trigger: "item",
            formatter: (p) => {
                if (p.value === undefined || Number.isNaN(p.value)) {
                    return `<b>${p.name}</b><br/><span style="color:#999">Sem OCs no plano</span>`;
                }
                const record = mapped.find(m => m.name === p.name);
                const muns = record ? record.municipios : "-";
                const uf = record ? record.uf : "";
                return `
                    <b>${p.name} ${uf ? "(" + uf + ")" : ""}</b><br/>
                    <b>${p.value.toLocaleString('pt-BR')}</b> OCs<br/>
                    <span style="color:#999">em ${muns.toLocaleString('pt-BR')} município(s)</span>
                `;
            },
        },
        visualMap: {
            min: 0,
            max: maxVal,
            left: "left",
            bottom: 20,
            text: ["Mais OCs", "Menos OCs"],
            calculable: true,
            inRange: {
                color: ["#e6f0ff", "#5c9fff", "#003399"],
            },
            textStyle: { fontWeight: "bold" },
        },
        series: [{
            type: "map",
            map: "brazil",
            roam: true,
            zoom: 1.1,
            label: {
                show: true,
                fontSize: 10,
                fontWeight: "bold",
                color: "#333",
                formatter: (p) => {
                    // mostra só sigla UF quando existir
                    const record = mapped.find(m => m.name === p.name);
                    return record ? record.uf : "";
                },
            },
            emphasis: {
                label: {
                    show: true,
                    fontSize: 14,
                    color: "#000",
                },
                itemStyle: {
                    areaColor: "#F5C518",
                    borderColor: "#003399",
                    borderWidth: 2,
                },
            },
            itemStyle: {
                borderColor: "#fff",
                borderWidth: 1,
            },
            data: mapped,
        }],
    };

    mapChart.setOption(option, true);
}


async function loadMap() {
    await ensureBrazilGeo();
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/by-uf?${q}`);
    const data = await response.json();
    renderMapChart(data);
}


// -----------------------------------------------------------------------------
// Gráfico 4 — Top 20 Municípios
// -----------------------------------------------------------------------------

function renderTopChart(data) {
    if (!topChart) {
        topChart = echarts.init(document.getElementById("plan-top-chart"));
        window.addEventListener("resize", () => topChart.resize());
    }

    if (!data || data.length === 0) {
        topChart.clear();
        topChart.setOption({
            title: {
                text: "Sem dados", left: "center", top: "center",
                textStyle: { color: "#999", fontSize: 14, fontWeight: "normal" },
            },
        });
        return;
    }

    // Reverse para o maior aparecer no topo
    const sliced = [...data].reverse();

    const option = {
        grid: { left: 180, right: 60, top: 20, bottom: 30 },
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params) => {
                const p = params[0];
                return `<b>${p.name}</b><br/>${p.value.toLocaleString('pt-BR')} OCs planejadas`;
            },
        },
        xAxis: {
            type: "value",
            axisLabel: { formatter: (v) => v.toLocaleString('pt-BR') },
            splitLine: { lineStyle: { color: "#eee" } },
        },
        yAxis: {
            type: "category",
            data: sliced.map(d => `${d.municipio} · ${d.uf}`),
            axisLabel: { fontSize: 11, width: 170, overflow: "truncate" },
        },
        series: [{
            type: "bar",
            data: sliced.map(d => d.value),
            itemStyle: {
                color: (params) => {
                    // Verde TIM com gradiente
                    const total = sliced.length;
                    const ratio = params.dataIndex / (total - 1 || 1);
                    const alpha = 0.55 + 0.45 * ratio;
                    return `rgba(125, 194, 66, ${alpha})`;
                },
            },
            label: {
                show: true, position: "right",
                formatter: (p) => p.value.toLocaleString('pt-BR'),
                fontWeight: "bold", color: "#333",
            },
            barMaxWidth: 20,
        }],
    };

    topChart.setOption(option, true);
}


async function loadTopMunicipios() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/top-municipios?${q}`);
    const data = await response.json();
    renderTopChart(data);
}


// -----------------------------------------------------------------------------
// Tabela de OCs
// -----------------------------------------------------------------------------

async function loadPlanTable() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/table?${q}`);
    planTableData = await response.json();
    applyPlanTableFilters();
}


function applyPlanTableFilters() {
    const term = (document.getElementById("plan-table-search").value || "").toLowerCase();

    planFilteredTable = planTableData.filter(r => {
        if (!term) return true;
        return Object.values(r).some(val =>
            String(val || "").toLowerCase().includes(term)
        );
    });

    if (planSortState.col) {
        planFilteredTable.sort((a, b) => {
            const va = a[planSortState.col];
            const vb = b[planSortState.col];
            if (va < vb) return -1 * planSortState.dir;
            if (va > vb) return 1 * planSortState.dir;
            return 0;
        });
    }

    planCurrentPage = 1;
    renderPlanTable();
}


function renderPlanTable() {
    const body = document.getElementById("plan-table-body");
    body.innerHTML = "";

    const totalPages = Math.max(1, Math.ceil(planFilteredTable.length / PLAN_PAGE_SIZE));
    if (planCurrentPage > totalPages) planCurrentPage = totalPages;

    const start = (planCurrentPage - 1) * PLAN_PAGE_SIZE;
    const pageRows = planFilteredTable.slice(start, start + PLAN_PAGE_SIZE);

    pageRows.forEach(r => {
        const tr = document.createElement("tr");
        const tec = (r.tecnologia || "").toUpperCase();
        const techBadge = TECH_COLORS[tec]
            ? `<span class="badge" style="background:${TECH_COLORS[tec]};">${tec}</span>`
            : (tec || "-");

        const statusBadge = r.status_oc === "CLOSED"
            ? `<span class="badge bg-secondary">Cancelada</span>`
            : `<span class="badge bg-success">Ativa</span>`;

        tr.innerHTML = `
            <td class="small">${r.ordem_complexa || '-'}</td>
            <td>${statusBadge}</td>
            <td class="small">${r.prioridade || '-'}</td>
            <td class="small text-muted">${r.macro_class || '-'}</td>
            <td class="small">${r.classificacao_casa || '-'}</td>
            <td>${techBadge}</td>
            <td class="text-center small fw-bold">${r.uf || '-'}</td>
            <td class="small">${r.municipio || '-'}</td>
        `;
        body.appendChild(tr);
    });

    document.getElementById("plan-table-info").textContent =
        `${planFilteredTable.length.toLocaleString('pt-BR')} OCs`;
    document.getElementById("plan-page-indicator").textContent =
        `Página ${planCurrentPage} / ${totalPages}`;
}


function initPlanTableEvents() {
    document.getElementById("plan-table-search")
        .addEventListener("input", applyPlanTableFilters);

    document.querySelectorAll("#plan-table-body")
        .forEach(() => {}); // noop, sortable é no thead

    document.querySelectorAll("th.sortable").forEach(th => {
        // apenas para os th dentro do container da aba plano
        if (!th.closest("table")) return;
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
            const col = th.dataset.col;
            if (!col) return;
            if (planSortState.col === col) {
                planSortState.dir *= -1;
            } else {
                planSortState.col = col;
                planSortState.dir = 1;
            }
            applyPlanTableFilters();
        });
    });

    document.getElementById("plan-prev-page").addEventListener("click", () => {
        if (planCurrentPage > 1) { planCurrentPage--; renderPlanTable(); }
    });
    document.getElementById("plan-next-page").addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(planFilteredTable.length / PLAN_PAGE_SIZE));
        if (planCurrentPage < totalPages) { planCurrentPage++; renderPlanTable(); }
    });
}


// -----------------------------------------------------------------------------
// Refresh geral
// -----------------------------------------------------------------------------

async function refreshAll() {
    await Promise.all([
        loadKPIs(),
        loadComposition(),
        loadTech(),
        loadHeatmap(),        // <-- antes era loadSunburst
        loadTopMunicipios(),
        loadPlanTable(),
        loadMap(),            // <-- novo
    ]);
}

// -----------------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------------

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
    initPlanTableEvents();
    await Promise.all([loadUFs(), loadYears()]);
    await refreshAll();
})();