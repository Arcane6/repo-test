/* =============================================================================
 * B2B Mobile — Dashboard
 * ============================================================================= */

const API_BASE = "/b2b-mobile/api";
const ACTUAL_BASE = "/mobile-access/api/actual";   // reaproveita UFs

let verticalChoices, clienteChoices, ufChoices, tecnologiaChoices;
let topClientesChart, verticalChart, techChart, mapChart;

// Tabela
let tableData = [];
let filteredTable = [];
let sortState = { col: null, dir: 1 };
let currentPage = 1;
const PAGE_SIZE = 20;

const TECH_COLORS = {
    "2G": "#1E88E5",
    "3G": "#E53935",
    "4G": "#F5C518",
    "5G": "#7DC242",
};

const VERTICAL_COLORS = {
    "Agronegócio":    "#7DC242",
    "Logística":      "#F5C518",
    "Indústria":      "#E53935",
    "Mineração":      "#795548",
    "Corporate Top":  "#003399",
    "Genérico":       "#6c757d",
};

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


// -----------------------------------------------------------------------------
// Filtros
// -----------------------------------------------------------------------------

function selectedValues(instance) {
    if (!instance) return [];
    return instance.getValue(true) || [];
}


function buildQuery() {
    const params = new URLSearchParams();
    selectedValues(verticalChoices).forEach(v => params.append("vertical", v));
    selectedValues(clienteChoices).forEach(v => params.append("cliente", v));
    selectedValues(ufChoices).forEach(v => params.append("uf", v));
    selectedValues(tecnologiaChoices).forEach(v => params.append("tecnologia", v));

    const ano = document.getElementById("filter-ano").value;
    if (ano) params.append("ano", ano);

    if (document.getElementById("filter-canceladas").checked) {
        params.append("include_closed", "1");
    }
    return params.toString();
}


// -----------------------------------------------------------------------------
// Carga dos dropdowns
// -----------------------------------------------------------------------------

async function loadVerticais() {
    const response = await fetch(`${API_BASE}/verticais`);
    const items = await response.json();
    verticalChoices.setChoices(
        items.map(v => ({ value: v, label: v })),
        "value", "label", true
    );
}


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


async function searchClientes(query) {
    const params = new URLSearchParams();
    if (query) params.append("q", query);
    const response = await fetch(`${API_BASE}/clientes/search?${params.toString()}`);
    const rows = await response.json();
    return rows.map(c => ({ value: c, label: c }));
}


async function ensureBrazilGeo() {
    if (brazilGeoLoaded) return;
    const resp = await fetch("/static/geo/brazil-states.geojson");
    const geojson = await resp.json();
    echarts.registerMap("brazil", geojson);
    brazilGeoLoaded = true;
}


// -----------------------------------------------------------------------------
// KPIs
// -----------------------------------------------------------------------------

async function loadKPIs() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/kpis?${q}`);
    const data = await response.json();

    const container = document.getElementById("b2b-kpis");
    container.innerHTML = "";

    data.cards.forEach(card => {
        const col = document.createElement("div");
        col.className = "col";
        col.innerHTML = `
            <div class="card shadow-sm h-100" style="border-top: 3px solid ${card.color};">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-2">
                        <i class="bi bi-${card.icon} me-2"
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
// Top Clientes (bar horizontal colorido por vertical)
// -----------------------------------------------------------------------------

function renderTopClientesChart(data) {
    if (!topClientesChart) {
        topClientesChart = echarts.init(document.getElementById("b2b-top-clientes-chart"));
        window.addEventListener("resize", () => topClientesChart.resize());
    }

    if (!data || data.length === 0) {
        topClientesChart.clear();
        topClientesChart.setOption({
            title: {
                text: "Sem dados para os filtros selecionados",
                left: "center", top: "center",
                textStyle: { color: "#999", fontSize: 14 },
            },
        });
        return;
    }

    // Reverse para maior no topo
    const sliced = [...data].reverse();

    // Renderiza cada barra com sua cor (por vertical)
    const barData = sliced.map(d => ({
        value: d.value,
        itemStyle: { color: d.color },
        vertical: d.vertical,
        municipios: d.municipios,
    }));

    // Labels combinam cliente + vertical (para distinguir "OUTROS CLIENTES" de cada vertical)
    const labels = sliced.map(d =>
        d.cliente === "OUTROS CLIENTES" || d.cliente === "GENÉRICO"
            ? `${d.cliente} · ${d.vertical}`
            : d.cliente
    );

    const option = {
        grid: { left: 220, right: 60, top: 20, bottom: 30 },
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params) => {
                const p = params[0];
                const item = barData[p.dataIndex];
                return `
                    <b>${p.name}</b><br/>
                    Vertical: <span style="color:${item.itemStyle.color}">
                        <b>${item.vertical}</b>
                    </span><br/>
                    <b>${p.value.toLocaleString('pt-BR')}</b> OCs<br/>
                    em ${item.municipios.toLocaleString('pt-BR')} município(s)
                `;
            },
        },
        xAxis: {
            type: "value",
            axisLabel: { formatter: (v) => v.toLocaleString('pt-BR') },
            splitLine: { lineStyle: { color: "#eee" } },
        },
        yAxis: {
            type: "category",
            data: labels,
            axisLabel: {
                fontSize: 11,
                width: 210,
                overflow: "truncate",
            },
        },
        series: [{
            type: "bar",
            data: barData,
            barMaxWidth: 20,
            label: {
                show: true,
                position: "right",
                formatter: (p) => p.value.toLocaleString('pt-BR'),
                fontWeight: "bold",
                color: "#333",
            },
        }],
    };

    topClientesChart.setOption(option, true);
}


async function loadTopClientes() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/top-clientes?${q}`);
    const data = await response.json();
    renderTopClientesChart(data);
}


// -----------------------------------------------------------------------------
// Distribuição por Vertical (donut)
// -----------------------------------------------------------------------------

function renderVerticalChart(data) {
    if (!verticalChart) {
        verticalChart = echarts.init(document.getElementById("b2b-vertical-chart"));
        window.addEventListener("resize", () => verticalChart.resize());
    }

    const nonZero = data.filter(d => d.value > 0);
    if (nonZero.length === 0) {
        verticalChart.clear();
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

    verticalChart.setOption(option, true);
}


async function loadVertical() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/by-vertical?${q}`);
    const data = await response.json();
    renderVerticalChart(data);
}


// -----------------------------------------------------------------------------
// Mix Tecnologia (donut)
// -----------------------------------------------------------------------------

function renderTechChart(data) {
    if (!techChart) {
        techChart = echarts.init(document.getElementById("b2b-tech-chart"));
        window.addEventListener("resize", () => techChart.resize());
    }

    const nonZero = data.filter(d => d.value > 0);
    if (nonZero.length === 0) {
        techChart.clear();
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
// Mapa
// -----------------------------------------------------------------------------

function renderMapChart(data) {
    if (!mapChart) {
        mapChart = echarts.init(document.getElementById("b2b-map-chart"));
        window.addEventListener("resize", () => mapChart.resize());
    }

    const mapped = data.map(d => ({
        name: UF_TO_NAME[d.uf] || d.uf,
        value: d.value,
        uf: d.uf,
        municipios: d.municipios,
        clientes: d.clientes,
    }));

    const total = data.reduce((s, d) => s + (d.value || 0), 0);
    const maxVal = Math.max(...data.map(d => d.value || 0), 1);

    document.getElementById("b2b-map-total").textContent =
        `Total: ${total.toLocaleString('pt-BR')} OCs em ${data.length} UF(s)`;

    const option = {
        tooltip: {
            trigger: "item",
            formatter: (p) => {
                if (p.value === undefined || Number.isNaN(p.value)) {
                    return `<b>${p.name}</b><br/><span style="color:#999">Sem OCs B2B</span>`;
                }
                const record = mapped.find(m => m.name === p.name);
                const muns = record ? record.municipios : "-";
                const clis = record ? record.clientes : "-";
                const uf = record ? record.uf : "";
                return `
                    <b>${p.name} ${uf ? "(" + uf + ")" : ""}</b><br/>
                    <b>${p.value.toLocaleString('pt-BR')}</b> OCs B2B<br/>
                    ${clis} cliente(s) em ${muns} município(s)
                `;
            },
        },
        visualMap: {
            min: 0,
            max: maxVal,
            left: "left",
            bottom: 20,
            text: ["Mais", "Menos"],
            calculable: true,
            inRange: {
                color: ["#f3e5f5", "#ba68c8", "#7B1FA2", "#4A148C"],
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
                    const record = mapped.find(m => m.name === p.name);
                    return record ? record.uf : "";
                },
            },
            emphasis: {
                label: { show: true, fontSize: 14, color: "#000" },
                itemStyle: {
                    areaColor: "#F5C518",
                    borderColor: "#7B1FA2",
                    borderWidth: 2,
                },
            },
            itemStyle: { borderColor: "#fff", borderWidth: 1 },
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
// Tabela
// -----------------------------------------------------------------------------

async function loadTable() {
    const q = buildQuery();
    const response = await fetch(`${API_BASE}/table?${q}`);
    tableData = await response.json();
    applyTableFilters();
}


function applyTableFilters() {
    const term = (document.getElementById("b2b-table-search").value || "").toLowerCase();

    filteredTable = tableData.filter(r => {
        if (!term) return true;
        return Object.values(r).some(val =>
            String(val || "").toLowerCase().includes(term)
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
    const body = document.getElementById("b2b-table-body");
    body.innerHTML = "";

    const totalPages = Math.max(1, Math.ceil(filteredTable.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredTable.slice(start, start + PAGE_SIZE);

    pageRows.forEach(r => {
        const tr = document.createElement("tr");
        const tec = (r.tecnologia || "").toUpperCase();
        const techBadge = TECH_COLORS[tec]
            ? `<span class="badge" style="background:${TECH_COLORS[tec]};">${tec}</span>`
            : (tec || "-");

        const verticalColor = VERTICAL_COLORS[r.vertical] || "#6c757d";
        const verticalBadge = r.vertical
            ? `<span class="badge" style="background:${verticalColor};">${r.vertical}</span>`
            : '-';

        const statusBadge = r.status_oc === "CLOSED"
            ? `<span class="badge bg-secondary">Cancelada</span>`
            : `<span class="badge bg-success">Ativa</span>`;

        tr.innerHTML = `
            <td class="small">${r.ordem_complexa || '-'}</td>
            <td>${statusBadge}</td>
            <td>${verticalBadge}</td>
            <td class="small fw-bold">${r.cliente || '-'}</td>
            <td class="small">${r.classificacao_casa || '-'}</td>
            <td>${techBadge}</td>
            <td class="text-center small fw-bold">${r.uf || '-'}</td>
            <td class="small">${r.municipio || '-'}</td>
        `;
        body.appendChild(tr);
    });

    document.getElementById("b2b-table-info").textContent =
        `${filteredTable.length.toLocaleString('pt-BR')} OCs`;
    document.getElementById("b2b-page-indicator").textContent =
        `Página ${currentPage} / ${totalPages}`;
}


function initTableEvents() {
    document.getElementById("b2b-table-search")
        .addEventListener("input", applyTableFilters);

    document.querySelectorAll("th.sortable").forEach(th => {
        if (!th.closest("table")) return;
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
            const col = th.dataset.col;
            if (!col) return;
            if (sortState.col === col) {
                sortState.dir *= -1;
            } else {
                sortState.col = col;
                sortState.dir = 1;
            }
            applyTableFilters();
        });
    });

    document.getElementById("b2b-prev-page").addEventListener("click", () => {
        if (currentPage > 1) { currentPage--; renderTable(); }
    });
    document.getElementById("b2b-next-page").addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(filteredTable.length / PAGE_SIZE));
        if (currentPage < totalPages) { currentPage++; renderTable(); }
    });
}


// -----------------------------------------------------------------------------
// Refresh & Init
// -----------------------------------------------------------------------------

async function refreshAll() {
    await Promise.all([
        loadKPIs(),
        loadTopClientes(),
        loadVertical(),
        loadTech(),
        loadMap(),
        loadTable(),
    ]);
}


function initChoices() {
    verticalChoices = new Choices("#filter-vertical", {
        removeItemButton: true, placeholder: true,
        placeholderValue: "Todas as verticais",
        searchPlaceholderValue: "Buscar vertical...",
        shouldSort: false,
    });

    clienteChoices = new Choices("#filter-cliente", {
        removeItemButton: true, placeholder: true,
        placeholderValue: "Todos os clientes",
        searchPlaceholderValue: "Digite para buscar...",
        shouldSort: false,
    });

    ufChoices = new Choices("#filter-uf", {
        removeItemButton: true, placeholder: true,
        placeholderValue: "Todas as UFs",
        searchPlaceholderValue: "Buscar UF...",
        shouldSort: false,
    });

    tecnologiaChoices = new Choices("#filter-tecnologia", {
        removeItemButton: true, placeholder: true,
        placeholderValue: "Todas as tecnologias",
        shouldSort: false,
    });

    // Lazy load do cliente
    let debounce;
    const cliEl = document.getElementById("filter-cliente");
    cliEl.addEventListener("search", async (e) => {
        clearTimeout(debounce);
        const query = e.detail.value;
        debounce = setTimeout(async () => {
            const items = await searchClientes(query);
            clienteChoices.setChoices(items, "value", "label", true);
        }, 250);
    });

    // Qualquer mudança recarrega
    ["filter-vertical", "filter-cliente", "filter-uf", "filter-tecnologia",
     "filter-ano", "filter-canceladas"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", refreshAll);
    });

    document.getElementById("btn-clear").addEventListener("click", async () => {
        verticalChoices.removeActiveItems();
        clienteChoices.removeActiveItems();
        ufChoices.removeActiveItems();
        tecnologiaChoices.removeActiveItems();
        document.getElementById("filter-canceladas").checked = false;
        await refreshAll();
    });
}


(async function init() {
    initChoices();
    initTableEvents();
    await Promise.all([loadVerticais(), loadUFs(), loadYears()]);
    await refreshAll();
})();