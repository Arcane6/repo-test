import type { CSSProperties, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartPanel } from "../components/ChartPanel";
import { KpiDeltaCard } from "../components/KpiDeltaCard";
import { donutOption, horizontalBarsOption } from "../charts/optionBuilders";
import { transportApi, type LabeledValue } from "../api/transport";
import { useTransportFilterStore } from "../store/transportFilters";
import { TRANSPORT_COLORS } from "../theme";

const fmtInt = (v: number) => v.toLocaleString("pt-BR");
const fmtPct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const RAIA = { r1: "#003399", r2: "#F5C518", r3: "#7DC242" };
const CAP_COLOR: Record<string, string> = { "10G": "#003399", "1G": "#4C8DFF", "<1G": "#9DBEF0", Outros: "#B0BEC5" };

function mediaDonut(items: LabeledValue[]) {
  return items.map((i) => ({ label: i.label, value: i.value, color: TRANSPORT_COLORS[i.label] ?? "#90A4AE" }));
}
function capBars(items: LabeledValue[]) {
  return horizontalBarsOption(items.map((i) => ({ name: i.label, value: i.value, color: CAP_COLOR[i.label] ?? "#90A4AE" })), 4);
}

function Raia({ tag, color, title, subtitle, badgeText, children }: {
  tag: string; color: string; title: string; subtitle: string; badgeText?: string; children: ReactNode;
}) {
  return (
    <div className="summary-raia mb-4" style={{ "--raia-color": color } as CSSProperties}>
      <div className="d-flex align-items-center mb-3">
        <span className="raia-badge me-2" style={{ background: color, color: badgeText }}>{tag}</span>
        <h5 className="fw-bold mb-0">{title}</h5>
        <small className="text-muted ms-3">{subtitle}</small>
      </div>
      {children}
    </div>
  );
}

export function TransporteResumoExecutivo() {
  const { uf, municipio, regional } = useTransportFilterStore();
  const filters = { uf, municipio, regional };

  const { data, isFetching: loading, error } = useQuery({
    queryKey: ["transport-resumo", uf, municipio, regional],
    queryFn: () => transportApi.resumoExecutivo(filters),
    retry: false,
  });

  const r1 = data?.fechamento_2025;
  const r2 = data?.plano_26;
  const r3 = data?.fechamento_26;

  // Delta de fiberização 25→26 pro badge do KPI da raia 3.
  const deltaFibra =
    r3?.pct_fibra != null && r1?.pct_fibra != null ? Number((r3.pct_fibra - r1.pct_fibra).toFixed(1)) : null;

  return (
    <div className="tim-page-enter">
      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div><strong>Falha ao carregar o Transporte.</strong>
            <div className="small mt-1">{(error as Error).message}</div></div>
        </div>
      )}

      {/* ===== R1 — Fechamento 2025 ===== */}
      <Raia tag="R1" color={RAIA.r1} title="Fechamento 2025" subtitle="Perfil de transporte no fim de 2025">
        <div className="row g-3">
          <div className="col-md-4">
            <KpiDeltaCard label="Sites de Transporte" icon="bi bi-hdd-network" accentColor={RAIA.r1}
              value={r1 ? fmtInt(r1.total_sites) : "—"} deltas={[]} />
          </div>
          <div className="col-md-4">
            <KpiDeltaCard label="Fiberização" icon="bi bi-bezier2" accentColor="#2E9E5B"
              value={r1 ? fmtPct(r1.pct_fibra) : "—"} secondaryValue="dos sites definidos são FO" deltas={[]} />
          </div>
          <div className="col-md-4">
            <KpiDeltaCard label="Alta Capacidade (10G)" icon="bi bi-lightning-charge" accentColor="#003399"
              value={r1 ? fmtPct(r1.pct_10g) : "—"} secondaryValue="do transporte já é 10G" deltas={[]} />
          </div>
        </div>
        <div className="row g-3 mt-1">
          <div className="col-lg-5">
            <ChartPanel title="Composição por Mídia" subtitle="Fechamento 2025" sourceTable="TB_FT_BASE_UNICA_SITES"
              height={300} option={donutOption(mediaDonut(r1?.por_midia ?? []))} loading={loading}
              imageFilename="transporte-2025-midia.png" />
          </div>
          <div className="col-lg-7">
            <ChartPanel title="Capacidade do Backhaul" subtitle="Fechamento 2025 (nº de sites)" sourceTable="TB_FT_BASE_UNICA_SITES"
              height={300} option={capBars(r1?.por_capacidade ?? [])} loading={loading}
              imageFilename="transporte-2025-capacidade.png" />
          </div>
        </div>
      </Raia>

      {/* ===== R2 — Plano 26 ===== */}
      <Raia tag="R2" color={RAIA.r2} badgeText="#000" title="Plano 26"
        subtitle="Backlog de transformação de transporte planejada (destino)">
        <div className="row g-3">
          <div className="col-md-4">
            <KpiDeltaCard label="Sites no Plano" icon="bi bi-tools" accentColor="#F5A623"
              value={r2 ? fmtInt(r2.total_sites) : "—"} secondaryValue="transformação de TX planejada" deltas={[]} />
          </div>
          <div className="col-md-8">
            <ChartPanel title="Destino Planejado por Mídia" subtitle="Para onde os sites do plano vão" sourceTable="TB_FT_BASE_UNICA_SITES"
              height={220} option={donutOption(mediaDonut(r2?.por_midia ?? []))} loading={loading}
              imageFilename="transporte-plano26-midia.png" />
          </div>
        </div>
      </Raia>

      {/* ===== R3 — Fechamento 26 ===== */}
      <Raia tag="R3" color={RAIA.r3} title="Fechamento 26" subtitle="Perfil atual + variação de composição vs 2025">
        <div className="row g-3">
          <div className="col-md-4">
            <KpiDeltaCard label="Sites de Transporte" icon="bi bi-hdd-network" accentColor={RAIA.r3}
              value={r3 ? fmtInt(r3.total_sites) : "—"} deltas={[]} />
          </div>
          <div className="col-md-4">
            <KpiDeltaCard label="Fiberização" icon="bi bi-bezier2" accentColor="#2E9E5B"
              value={r3 ? fmtPct(r3.pct_fibra) : "—"} secondaryValue="dos sites definidos são FO"
              deltas={[{ label: "vs 2025 (p.p.)", pct: deltaFibra }]} />
          </div>
          <div className="col-md-4">
            <KpiDeltaCard label="Alta Capacidade (10G)" icon="bi bi-lightning-charge" accentColor="#003399"
              value={r3 ? fmtPct(r3.pct_10g) : "—"} secondaryValue="do transporte já é 10G" deltas={[]} />
          </div>
        </div>
        <div className="row g-3 mt-1">
          <div className="col-lg-5">
            <ChartPanel title="Composição por Mídia" subtitle="Fechamento 26" sourceTable="TB_FT_BASE_UNICA_SITES"
              height={300} option={donutOption(mediaDonut(r3?.por_midia ?? []))} loading={loading}
              imageFilename="transporte-26-midia.png" />
          </div>
          <div className="col-lg-7">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h6 className="fw-bold mb-1">Variação de Composição 25 → 26</h6>
                <small className="text-muted d-block mb-3">Quantos sites cada mídia ganhou/perdeu no ano</small>
                <div className="d-flex flex-column gap-2">
                  {(r3?.variacao ?? []).map((v) => {
                    const up = v.delta >= 0;
                    return (
                      <div key={v.label} className="d-flex align-items-center justify-content-between">
                        <span className="d-inline-flex align-items-center gap-2">
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: TRANSPORT_COLORS[v.label] ?? "#90A4AE", display: "inline-block" }} />
                          <span className="fw-semibold">{v.label}</span>
                        </span>
                        <span className="fw-bold" style={{ color: v.delta === 0 ? "var(--tim-text-muted)" : up ? "#2e7d32" : "#c62828" }}>
                          {up ? "+" : ""}{fmtInt(v.delta)}
                        </span>
                      </div>
                    );
                  })}
                  {!loading && (r3?.variacao ?? []).length === 0 && (
                    <span className="text-muted small">Sem dados no recorte atual.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Raia>
    </div>
  );
}
