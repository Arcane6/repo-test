/* =============================================================================
 * Mobile Access — Aba SUMMARY (3 raias)
 * ============================================================================= */

const API_BASE = "/mobile-access/api/summary";
const ACTUAL_BASE = "/mobile-access/api/actual";
const PLAN_BASE = "/mobile-access/api/plan";

let ufChoices, municipioChoices, tecnologiaChoices;

// Instâncias dos charts (uma por card)
const CHARTS = {};

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
    const ano = document.getElementById("filter-ano").value;
    if (ano) params.append("ano", ano);
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
// Renders — reutilizáveis
// -----------------------------------------------------------------------------

function chart(id) {
    if (!CHARTS[id]) {
        CHARTS[id] = echarts.init(document.getElementById(id));
        window.addEventListener("resize", () => CHARTS[id].resize());
    }
    return CHARTS[id];
}


function renderBarsByTech(chartId, data) {
    const c = chart(chartId);
    if (!data.bars || data.bars.length === 0) {
        c.clear();
        return;
    }
    c.setOption({
        grid: { left: 45, right: 30, top: 20, bottom: 40 },
        tooltip: {
            trigger: "axis",
            formatter: (params) => {
                const p = params[0];
                return `<b>${p.name}</b><br/>${p.value.toLocaleString('pt-BR')}`;
            },
        },
        xAxis: {
            type: "category",
            data: data.bars.map(b => b.tec),
            axisLabel: { fontWeight: "bold" },
        },
        yAxis: {
            type: "value",
            splitLine: { lineStyle: { color: "#eee" } },
        },
        series: [{
            type: "bar",
            data: data.bars.map(b => ({
                value: b.value,
                itemStyle: { color: b.color },
            })),
            barMaxWidth: 40,
            label: {
                show: true,
                position: "top",
                fontWeight: "bold",
                formatter: (p) => p.value.toLocaleString('pt-BR'),
            },
        }],
    }, true);
}


function renderHorizontalBars(chartId, data, colorFn) {
    const c = chart(chartId);
    if (!data || data.length === 0) {
        c.clear();
        return;
    }
    const sliced = [...data].slice(0, 12).reverse();
    c.setOption({
        grid: { left: 140, right: 50, top: 10, bottom: 20 },
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params) => {
                const p = params[0];
                return `<b>${p.name}</b><br/>${p.value.toLocaleString('pt-BR')}`;
            },
        },
        xAxis: { type: "value", axisLabel: { formatter: v => v.toLocaleString('pt-BR') } },
        yAxis: {
            type: "category",
            data: sliced.map(d => d.label || d.projeto),
            axisLabel: { fontSize: 10, width: 130, overflow: "truncate" },
        },
        series: [{
            type: "bar",
            data: sliced.map((d, i) => ({
                value: d.value,
                itemStyle: { color: colorFn ? colorFn(d, i) : "#003399" },
            })),
            barMaxWidth: 16,
            label: {
                show: true,
                position: "right",
                formatter: (p) => p.value.toLocaleString('pt-BR'),
                fontWeight: "bold",
                fontSize: 10,
            },
        }],
    }, true);
}


function renderDonut(chartId, data) {
    const c = chart(chartId);
    if (!data || data.length === 0) {
        c.clear();
        return;
    }
    const total = data.reduce((s, d) => s + (d.value || 0), 0);
    c.setOption({
        tooltip: {
            trigger: "item",
            formatter: (p) => {
                const pct = total ? ((p.value / total) * 100).toFixed(1) : 0;
                return `<b>${p.name}</b><br/>${p.value.toLocaleString('pt-BR')} (${pct}%)`;
            },
        },
        legend: { bottom: 0, icon: "circle", textStyle: { fontSize: 11 } },
        series: [{
            type: "pie",
            radius: ["45%", "70%"],
            center: ["50%", "42%"],
            itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 },
            label: {
                show: true, position: "outside",
                formatter: (p) => `${p.name}\n${p.value.toLocaleString('pt-BR')}`,
                fontSize: 10, lineHeight: 14,
            },
            labelLine: { length: 6, length2: 6 },
            data: data.map(d => ({
                name: d.label,
                value: d.value,
                itemStyle: { color: d.color || "#888" },
            })),
        }],
    }, true);
}


function renderPie(chartId, data) {
    const c = chart(chartId);
    if (!data.slices || data.slices.length === 0) {
        c.clear();
        return;
    }
    const total = data.slices.reduce((s, d) => s + (d.value || 0), 0);

    // Paleta cíclica para ANFs
    const palette = [
        "#003399", "#7DC242", "#F5C518", "#E53935", "#1E88E5",
        "#795548", "#7B1FA2", "#00897B", "#FB8C00", "#5D4037",
    ];

    c.setOption({
        tooltip: {
            trigger: "item",
            formatter: (p) => {
                const pct = total ? ((p.value / total) * 100).toFixed(1) : 0;
                return `<b>${p.name}</b><br/>${p.value.toLocaleString('pt-BR')} cidades (${pct}%)`;
            },
        },
        series: [{
            type: "pie",
            radius: "70%",
            center: ["50%", "50%"],
            itemStyle: { borderColor: "#fff", borderWidth: 2 },
            label: {
                show: true, position: "outside",
                formatter: (p) => `${p.name}\n${p.value.toLocaleString('pt-BR')}`,
                fontSize: 10, lineHeight: 14,
            },
            labelLine: { length: 6, length2: 6 },
            data: data.slices.map((d, i) => ({
                name: d.label,
                value: d.value,
                itemStyle: { color: palette[i % palette.length] },
            })),
        }],
    }, true);
}


function renderRegionalSunburst(chartId, data) {
    const c = chart(chartId);
    if (!data.categories || data.categories.length === 0) {
        c.clear();
        return;
    }

    const palette = [
        "#003399", "#7DC242", "#F5C518", "#E53935", "#1E88E5",
        "#795548", "#7B1FA2", "#00897B", "#FB8C00", "#5D4037",
    ];

    const base = data.series.find(s => s.name === "Base 25").data;
    const ganho = data.series.find(s => s.name === "Ganho 26").data;
    const totalGeral = data.total || 0;

    // Prepara dados: total por regional (fatia do donut)
    const donutData = data.categories.map((cat, i) => ({
        name: cat,
        value: (base[i] || 0) + (ganho[i] || 0),
        base: base[i] || 0,
        ganho: ganho[i] || 0,
        itemStyle: { color: palette[i % palette.length] },
    }));

    // Ordena por total desc (fica mais bonito visualmente)
    donutData.sort((a, b) => b.value - a.value);

    c.setOption({
        title: {
            text: totalGeral.toLocaleString('pt-BR'),
            subtext: 'EoY 26 · Total',
            left: '32%',
            top: '42%',
            textAlign: 'center',
            textStyle: { fontSize: 22, fontWeight: 'bold', color: '#003399' },
            subtextStyle: { fontSize: 10, color: '#6c757d' },
        },
        tooltip: {
            trigger: 'item',
            formatter: (p) => {
                const d = p.data;
                const pct = totalGeral ? ((d.value / totalGeral) * 100).toFixed(1) : 0;
                return `
                    <b>${d.name}</b> (${pct}%)<br/>
                    <span style="opacity:0.6">▪ Base 25:</span>
                    <b>${d.base.toLocaleString('pt-BR')}</b><br/>
                    <span style="color:${d.itemStyle.color}">▪ Ganho 26:</span>
                    <b>${d.ganho.toLocaleString('pt-BR')}</b><br/>
                    <b>Total: ${d.value.toLocaleString('pt-BR')}</b>
                `;
            },
        },
        legend: {
            type: 'scroll',
            orient: 'vertical',
            right: 8,
            top: 'center',
            itemGap: 8,
            textStyle: { fontSize: 10 },
            formatter: (name) => {
                const d = donutData.find(x => x.name === name);
                if (!d) return name;
                // Formata: "TSL  259 + 53"
                const b = d.base.toLocaleString('pt-BR');
                const g = d.ganho.toLocaleString('pt-BR');
                return `{n|${name}}  {b|${b}} {plus|+} {g|${g}}`;
            },
            textStyle: {
                rich: {
                    n: { fontWeight: 'bold', fontSize: 11, color: '#333', width: 30 },
                    b: { color: '#6c757d', fontSize: 10 },
                    plus: { color: '#adb5bd', fontSize: 10, padding: [0, 2] },
                    g: { color: '#7DC242', fontSize: 10, fontWeight: 'bold' },
                },
            },
        },
        series: [{
            type: 'pie',
            radius: ['52%', '82%'],
            center: ['32%', '52%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 4,
                borderColor: '#fff',
                borderWidth: 2,
            },
            label: {
                show: true,
                position: 'inside',
                fontWeight: 'bold',
                color: '#fff',
                fontSize: 11,
                formatter: (p) => {
                    // Só mostra fatia > 5% pra não poluir
                    const pct = totalGeral ? (p.value / totalGeral) * 100 : 0;
                    if (pct < 5) return '';
                    return `${p.name}\n${p.value.toLocaleString('pt-BR')}`;
                },
            },
            labelLine: { show: false },
            data: donutData,
        }],
    }, true);
}

function renderStackedBarsByTech(chartId, data) {
    const c = chart(chartId);
    if (!data.series || data.series.length === 0) {
        c.clear();
        return;
    }

    // Paleta contrastada
    const SERIES_COLORS = {
        "Base 25":        "#B0BEC5",
        "Casa Nova":      "#26C281",
        "Casa Existente": "#1565C0",
    };

    // Séries LADO A LADO (sem stack) — cada uma escala individual
    const series = data.series.map(s => ({
        name: s.name,
        type: "bar",
        data: s.data,
        itemStyle: {
            color: SERIES_COLORS[s.name] || s.color,
            borderRadius: [3, 3, 0, 0],
        },
        barMaxWidth: 30,
        barGap: "10%",
        emphasis: { focus: "series" },
        label: {
            show: true,
            position: "top",
            fontWeight: "bold",
            fontSize: 11,
            color: "#333",
            formatter: (p) => p.value > 0 ? p.value.toLocaleString('pt-BR') : "",
        },
    }));

    // Total por tec (soma das séries)
    const totals = data.categories.map((_, i) =>
        data.series.reduce((s, serie) => s + (serie.data[i] || 0), 0)
    );

    c.setOption({
        grid: { left: 55, right: 25, top: 60, bottom: 55 },
        legend: {
            top: 5,
            icon: "roundRect",
            itemWidth: 14,
            itemHeight: 14,
            textStyle: { fontSize: 12, fontWeight: "bold" },
        },
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params) => {
                const total = params.reduce((s, p) => s + p.value, 0);
                const rows = params.map(p =>
                    `<div style="display:flex; gap:8px; align-items:center;">
                        <span style="display:inline-block;width:12px;height:12px;background:${p.color};border-radius:2px"></span>
                        <span>${p.seriesName}</span>
                        <b style="margin-left:auto">${p.value.toLocaleString('pt-BR')}</b>
                     </div>`
                ).join("");
                return `<b>${params[0].axisValue}</b><br/>${rows}
                        <hr style="margin:6px 0;border:0;border-top:1px solid #ccc"/>
                        <div style="display:flex; gap:8px">
                            <b>Total</b>
                            <b style="margin-left:auto">${total.toLocaleString('pt-BR')}</b>
                        </div>`;
            },
        },
        xAxis: {
            type: "category",
            data: data.categories,
            axisLabel: {
                fontWeight: "bold",
                fontSize: 13,
                // Mostra o total embaixo do nome da tec
                formatter: (name, idx) => {
                    return `{tec|${name}}`;
                },
                rich: {
                    tec: { fontWeight: "bold", fontSize: 13, color: "#212529", lineHeight: 18 },
                    total: { fontSize: 10, color: "#6c757d", fontWeight: "normal" },
                },
            },
        },
        yAxis: {
            type: "value",
            splitLine: { lineStyle: { color: "#eee" } },
            axisLabel: {
                formatter: (v) => v.toLocaleString('pt-BR'),
                fontSize: 11,
            },
        },
        series: series,
    }, true);
}


function renderVendorDonutSide(chartId, data) {
    const c = chart(chartId);
    if (!data || data.length === 0) {
        c.clear();
        return;
    }

    const total = data.reduce((s, d) => s + (d.value || 0), 0);

    // Ordena por valor desc
    const sorted = [...data].sort((a, b) => b.value - a.value);

    c.setOption({
        title: {
            text: total.toLocaleString('pt-BR'),
            subtext: 'Sites totais',
            left: '32%',
            top: '42%',
            textAlign: 'center',
            textStyle: { fontSize: 22, fontWeight: 'bold', color: '#003399' },
            subtextStyle: { fontSize: 10, color: '#6c757d' },
        },
        tooltip: {
            trigger: 'item',
            formatter: (p) => {
                const pct = total ? ((p.value / total) * 100).toFixed(1) : 0;
                return `
                    <b>${p.name}</b><br/>
                    ${p.value.toLocaleString('pt-BR')} sites (${pct}%)
                `;
            },
        },
        legend: {
            type: 'scroll',
            orient: 'vertical',
            right: 8,
            top: 'center',
            itemGap: 10,
            icon: 'circle',
            textStyle: { fontSize: 10 },
            formatter: (name) => {
                const d = sorted.find(x => x.label === name);
                if (!d) return name;
                return `{n|${name}}`;
            },
            textStyle: {
                rich: {
                    n: { fontWeight: 'bold', fontSize: 11, color: '#333', width: 62 },
                    v: { color: '#333', fontSize: 10, fontWeight: 'bold' },
                    p: { color: '#6c757d', fontSize: 9, padding: [0, 0, 0, 4] },
                },
            },
        },
        series: [{
            type: 'pie',
            radius: ['52%', '82%'],
            center: ['32%', '52%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 4,
                borderColor: '#fff',
                borderWidth: 2,
            },
            label: {
                show: true,
                position: 'inside',
                fontWeight: 'bold',
                color: '#fff',
                fontSize: 11,
                formatter: (p) => {
                    const pct = total ? (p.value / total) * 100 : 0;
                    if (pct < 5) return '';
                    return `${p.value.toLocaleString('pt-BR')}`;
                },
            },
            labelLine: { show: false },
            data: sorted.map(d => ({
                name: d.label,
                value: d.value,
                itemStyle: { color: d.color || '#888' },
            })),
        }],
    }, true);
}

function renderSmallMultiplesByTech(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!data.series || data.series.length === 0) return;

    const SERIES_COLORS = {
        "Base 25":        "#B0BEC5",
        "Casa Nova":      "#26C281",
        "Casa Existente": "#1565C0",
    };

    // Descobre o valor máximo GLOBAL considerando todas as tecs e séries
    // pra que as barras de tecs pequenas sejam visíveis mesmo comparadas com 5G
    // (mas cada tec tem seu total no topo — a barra é só proporcional dentro do card)
    // Escala INDIVIDUAL: cada card usa seu próprio máximo
    const perTecMax = data.categories.map((_, i) => {
        return Math.max(1, ...data.series.map(s => s.data[i] || 0));
    });

    // Preenche cada mini-card
    data.categories.forEach((tec, i) => {
        const cardEl = container.querySelector(`[data-tec="${tec}"]`);
        if (!cardEl) return;

        const total = data.series.reduce((s, ser) => s + (ser.data[i] || 0), 0);
        const maxForCard = perTecMax[i];

        // Monta o HTML interno do mini-card
        let html = `
            <div class="sm-tec-title">${tec}</div>
            <div class="sm-tec-total">${total.toLocaleString('pt-BR')}</div>
        `;

        data.series.forEach(ser => {
            const val = ser.data[i] || 0;
            const pct = (val / maxForCard) * 100;
            const color = SERIES_COLORS[ser.name] || ser.color;

            html += `
                <div class="sm-tec-row" title="${ser.name}: ${val.toLocaleString('pt-BR')}">
                    <span class="sm-tec-bar-wrap">
                        <span class="sm-tec-bar-fill"
                              style="width:${pct}%; background:${color};"></span>
                    </span>
                    <span class="sm-tec-value">${val.toLocaleString('pt-BR')}</span>
                </div>
            `;
        });

        cardEl.innerHTML = html;
    });
}


// -----------------------------------------------------------------------------
// Loaders por raia
// -----------------------------------------------------------------------------

async function loadR1() {
    const q = buildQuery();
    const [sites, cities, vendors] = await Promise.all([
        fetch(`${API_BASE}/r1/sites-by-tech?${q}`).then(r => r.json()),
        fetch(`${API_BASE}/r1/cities-by-tech?${q}`).then(r => r.json()),
        fetch(`${API_BASE}/r1/vendors?${q}`).then(r => r.json()),
    ]);
    renderBarsByTech("r1-sites-chart", sites);
    renderBarsByTech("r1-cities-chart", cities);
    renderHorizontalBars("r1-vendors-chart", vendors, (d) => d.color);
}


async function loadR2() {
    const q = buildQuery();
    const [sites, citiesAnf, vendors, projects] = await Promise.all([
        fetch(`${API_BASE}/r2/sites-by-tech?${q}`).then(r => r.json()),
        fetch(`${API_BASE}/r2/new-cities-by-anf?${q}`).then(r => r.json()),
        fetch(`${API_BASE}/r2/vendors-new-sites?${q}`).then(r => r.json()),
        fetch(`${API_BASE}/r2/top-projects?${q}`).then(r => r.json()),
    ]);
    renderSmallMultiplesByTech("r2-sites-mini", sites);
    renderPie("r2-cities-anf-chart", citiesAnf);
    renderDonut("r2-vendors-chart", vendors);
    renderHorizontalBars("r2-projects-chart", projects);
}


async function loadR3() {
    const q = buildQuery();
    const [sites, citiesAnf, vendors, projects] = await Promise.all([
        fetch(`${API_BASE}/r3/sites-by-tech?${q}`).then(r => r.json()),
        fetch(`${API_BASE}/r3/new-cities-by-anf?${q}`).then(r => r.json()),
        fetch(`${API_BASE}/r3/vendors?${q}`).then(r => r.json()),
        fetch(`${API_BASE}/r3/top-projects?${q}`).then(r => r.json()),
    ]);
    renderSmallMultiplesByTech("r3-sites-mini", sites);
    renderRegionalSunburst("r3-cities-anf-chart", citiesAnf);
    renderVendorDonutSide("r3-vendors-chart", vendors);
    renderHorizontalBars("r3-projects-chart", projects);
}


async function refreshAll() {
    await Promise.all([loadR1(), loadR2(), loadR3()]);
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
        placeholderValue: "N/A no Summary",
        shouldSort: false,
    });

    // Bloqueia tecnologia no Summary (conforme decisão)
    const tecEl = document.getElementById("filter-tecnologia");
    tecEl.disabled = true;
    tecEl.parentElement.style.opacity = "0.5";

    // Lazy load do município
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

    ["filter-uf", "filter-municipio", "filter-ano"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", refreshAll);
    });

    document.getElementById("btn-clear").addEventListener("click", async () => {
        ufChoices.removeActiveItems();
        municipioChoices.removeActiveItems();
        await refreshAll();
    });
}


(async function init() {
    initChoices();
    await Promise.all([loadUFs(), loadYears()]);
    await refreshAll();
})();