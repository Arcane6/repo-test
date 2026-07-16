import { useQuery } from "@tanstack/react-query";
import { ChartPanel } from "../components/ChartPanel";
import { KpiDeltaCard } from "../components/KpiDeltaCard";
import { donutOption, horizontalBarsOption, trafficTrendOption } from "../charts/optionBuilders";
import { trafficApi, type LabeledValue } from "../api/traffic";
import { useTrafficFilterStore } from "../store/trafficFilters";

const fmtPb = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const fmtPct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

const TECH_COLOR: Record<string, string> = {
  "2G": "#9E9E9E",
  "2G/3G": "#9E9E9E",
  "3G": "#B0BEC5",
  "4G": "#1E88E5",
  "5G": "#7DC242",
};

function color(label: string, fallback = "#003399") {
  return TECH_COLOR[label] ?? fallback;
}

function toDonut(items: LabeledValue[]) {
  return items.map((i) => ({ label: i.label, value: i.value, color: color(i.label) }));
}

function RaiaHeader({ tag, tagColor, title, subtitle }: { tag: string; tagColor: string; title: string; subtitle: string }) {
  return (
    <div className="d-flex align-items-center gap-2 mt-4 mb-3">
      <span className="badge" style={{ backgroundColor: tagColor }}>{tag}</span>
      <div>
        <h5 className="fw-bold mb-0">{title}</h5>
        <small className="text-muted">{subtitle}</small>
      </div>
    </div>
  );
}

export function TrafegoResumoExecutivo() {
  const { uf, municipio } = useTrafficFilterStore();
  const filters = { uf, municipio };

  const { data, isFetching: loading, error } = useQuery({
    queryKey: ["traffic-resumo-executivo", uf, municipio],
    queryFn: () => trafficApi.resumoExecutivo(filters),
    retry: false,
  });

  const f25 = data?.fechamento_2025;
  const p26 = data?.plano_26;
  const f26 = data?.fechamento_26;

  return (
    <div>
      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div>
            <strong>Falha ao carregar o Resumo Executivo.</strong>
            <div className="small mt-1">{(error as Error).message}</div>
          </div>
        </div>
      )}

      {/* ============ Raia 1 — Fechamento 2025 ============ */}
      <RaiaHeader tag="Raia 1" tagColor="#6C757D" title="Fechamento 2025" subtitle="Tráfego realizado do ano fechado (TIM)" />
      <div className="row g-3">
        <div className="col-md-4">
          <KpiDeltaCard label="Tráfego TIM 2025" icon="bi bi-reception-4" accentColor="#6C757D"
            value={f25 ? fmtPb(f25.trafego_tim_pb) : "—"} unit="PB" deltas={[]} />
        </div>
        <div className="col-md-4">
          <KpiDeltaCard label="Market Share TIM" icon="bi bi-pie-chart" accentColor="#003399"
            value={f25 ? fmtPct(f25.market_share.share_tim_pct) : "—"}
            secondaryValue={f25 ? `TIM × OI · mercado ${fmtPb(f25.market_share.total_mercado_pb)} PB` : undefined}
            deltas={[]} />
        </div>
        <div className="col-md-4">
          <KpiDeltaCard label="Top Município 2025" icon="bi bi-geo-alt" accentColor="#7DC242"
            value={f25?.ranking_municipios?.[0]?.label ?? "—"}
            secondaryValue={f25?.ranking_municipios?.[0] ? `${fmtPb(f25.ranking_municipios[0].value)} PB` : undefined}
            deltas={[]} />
        </div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-lg-5">
          <ChartPanel title="Tráfego TIM por Tecnologia" subtitle="Realizado 2025 (PB)" sourceTable="REL_DS013_TRAFEGO_REALIZADO"
            height={300} option={donutOption(toDonut(f25?.por_tecnologia ?? []))} loading={loading}
            imageFilename="trafego-2025-por-tecnologia.png" />
        </div>
        <div className="col-lg-7">
          <ChartPanel title="Top 15 Municípios — Tráfego TIM 2025" sourceTable="REL_DS013_TRAFEGO_REALIZADO"
            height={300}
            option={horizontalBarsOption((f25?.ranking_municipios ?? []).map((i) => ({ name: i.label, value: i.value, color: "#6C757D" })), 15)}
            loading={loading} imageFilename="trafego-2025-top-municipios.png" />
        </div>
      </div>

      {/* ============ Raia 2 — Plano 26 ============ */}
      <RaiaHeader tag="Raia 2" tagColor="#003399" title="Plano 26" subtitle="Tráfego planejado 2026 (Consolidado)" />
      <div className="row g-3">
        <div className="col-md-4">
          <KpiDeltaCard label="Tráfego Planejado 2026" icon="bi bi-graph-up" accentColor="#003399"
            value={p26 ? fmtPb(p26.trafego_planejado_pb) : "—"} unit="PB" deltas={[]} />
        </div>
        <div className="col-md-8 d-flex align-items-stretch">
          <div className="w-100">
            <ChartPanel title="Curva Mensal Planejada" subtitle="Consolidado 2026 (PB)" sourceTable="REL_TRAFEGO_CIDADES_WIDE"
              height={220}
              option={trafficTrendOption((p26?.serie_mensal ?? []).map((s) => ({ label: s.mes, volumetria_pb: s.value, variacao_pct: null })))}
              loading={loading} imageFilename="trafego-plano26-curva-mensal.png" />
          </div>
        </div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-lg-5">
          <ChartPanel title="Planejado por Tecnologia" subtitle="Split aditivo {2G/3G, 4G, 5G} = Consolidado" sourceTable="REL_TRAFEGO_CIDADES_WIDE"
            height={300} option={donutOption(toDonut(p26?.por_camada ?? []))} loading={loading}
            imageFilename="trafego-plano26-por-tecnologia.png" />
        </div>
        <div className="col-lg-7">
          <ChartPanel title="Top 15 Municípios — Plano 26" sourceTable="REL_TRAFEGO_CIDADES_WIDE"
            height={300}
            option={horizontalBarsOption((p26?.ranking_municipios ?? []).map((i) => ({ name: i.label, value: i.value, color: "#003399" })), 15)}
            loading={loading} imageFilename="trafego-plano26-top-municipios.png" />
        </div>
      </div>

      {/* ============ Raia 3 — Fechamento 26 ============ */}
      <RaiaHeader tag="Raia 3" tagColor="#7DC242" title="Fechamento 26"
        subtitle={f26?.mes_ate ? `Realizado YTD (Jan–${f26.mes_ate}) × plano` : "Realizado YTD × plano"} />
      <div className="row g-3">
        <div className="col-md-3">
          <KpiDeltaCard label="Realizado YTD (TIM)" icon="bi bi-reception-4" accentColor="#7DC242"
            value={f26 ? fmtPb(f26.trafego_tim_ytd_pb) : "—"} unit="PB" deltas={[]} />
        </div>
        <div className="col-md-3">
          <KpiDeltaCard label="Planejado YTD" icon="bi bi-graph-up" accentColor="#003399"
            value={f26 ? fmtPb(f26.planejado_ytd_pb) : "—"} unit="PB" deltas={[]} />
        </div>
        <div className="col-md-3">
          <KpiDeltaCard label="Aderência ao Plano" icon="bi bi-bullseye" accentColor="#E53935"
            value={f26 ? fmtPct(f26.aderencia_pct) : "—"}
            secondaryValue="Realizado ÷ Planejado (YTD)" deltas={[]} />
        </div>
        <div className="col-md-3">
          <KpiDeltaCard label="Market Share TIM" icon="bi bi-pie-chart" accentColor="#7B1FA2"
            value={f26 ? fmtPct(f26.market_share.share_tim_pct) : "—"}
            secondaryValue={f26 ? `TIM × OI` : undefined} deltas={[]} />
        </div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-lg-5">
          <ChartPanel title="Realizado YTD por Tecnologia" subtitle={`TIM (PB)`} sourceTable="REL_DS013_TRAFEGO_REALIZADO"
            height={300} option={donutOption(toDonut(f26?.por_tecnologia ?? []))} loading={loading}
            imageFilename="trafego-fech26-por-tecnologia.png" />
        </div>
      </div>
    </div>
  );
}
