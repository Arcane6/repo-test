import type { CSSProperties, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChartPanel } from "../components/ChartPanel";
import { KpiDeltaCard } from "../components/KpiDeltaCard";
import { donutOption, horizontalBarsOption, trafficPlanVsRealOption } from "../charts/optionBuilders";
import { trafficApi, type LabeledValue } from "../api/traffic";
import { useTrafficFilterStore } from "../store/trafficFilters";
import { techColor } from "../theme";

const fmtPb = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const fmtPct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

// Mesmas cores das raias do Resumo do Acesso Móvel: R1 azul, R2 amarelo, R3 verde.
const RAIA = {
  r1: "#003399",
  r2: "#F5C518",
  r3: "#7DC242",
};

// Cores de tecnologia = mapa canônico do portal (theme.ts). "2G/3G" (camada
// combinada do planejado) herda o tom do 3G — é legado agrupado.
function techColorTraffic(label: string): string {
  return label === "2G/3G" ? "#E53935" : techColor(label);
}

function toDonut(items: LabeledValue[]) {
  return items.map((i) => ({ label: i.label, value: i.value, color: techColorTraffic(i.label) }));
}

/** Bloco de raia com o mesmo destaque visual do Resumo do Acesso Móvel
 * (borda lateral + tint via `.summary-raia`, badge `.raia-badge`). */
function Raia({
  tag,
  color,
  title,
  subtitle,
  badgeTextColor,
  children,
}: {
  tag: string;
  color: string;
  title: string;
  subtitle: string;
  badgeTextColor?: string;
  children: ReactNode;
}) {
  return (
    <div className="summary-raia mb-4" style={{ "--raia-color": color } as CSSProperties}>
      <div className="d-flex align-items-center mb-3">
        <span className="raia-badge me-2" style={{ background: color, color: badgeTextColor }}>{tag}</span>
        <h5 className="fw-bold mb-0">{title}</h5>
        <small className="text-muted ms-3">{subtitle}</small>
      </div>
      {children}
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

  const serie = p26?.serie_mensal ?? [];
  const vsPlanoMes = f26?.aderencia_pct != null ? Number((f26.aderencia_pct - 100).toFixed(1)) : null;

  return (
    <div className="tim-page-enter">
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
      <Raia tag="R1" color={RAIA.r1} title="Fechamento 2025" subtitle="Volumetria de referência: dezembro/2025 (mês de corte, não soma do ano)">
        <div className="row g-3">
          <div className="col-md-4">
            <KpiDeltaCard label="Tráfego (Dez/2025)" icon="bi bi-reception-4" accentColor={RAIA.r1}
              value={f25 ? fmtPb(f25.trafego_pb) : "—"} unit="PB" deltas={[]} />
          </div>
          <div className="col-md-4">
            <KpiDeltaCard label="Mix 5G" icon="bi bi-broadcast" accentColor="#7DC242"
              value={f25 ? fmtPct(f25.mix_5g_pct) : "—"} secondaryValue="do tráfego de dez/25 já é 5G" deltas={[]} />
          </div>
          <div className="col-md-4">
            <KpiDeltaCard label="Top Município (Dez/2025)" icon="bi bi-geo-alt" accentColor="#7B1FA2"
              value={f25?.ranking_municipios?.[0]?.label ?? "—"}
              secondaryValue={f25?.ranking_municipios?.[0] ? `${fmtPb(f25.ranking_municipios[0].value)} PB` : undefined}
              deltas={[]} />
          </div>
        </div>
        <div className="row g-3 mt-1">
          <div className="col-lg-5">
            <ChartPanel title="Tráfego por Tecnologia" subtitle="Realizado Dez/2025 (PB)" sourceTable="REL_DS013_TRAFEGO_REALIZADO"
              height={300} option={donutOption(toDonut(f25?.por_tecnologia ?? []))} loading={loading}
              imageFilename="trafego-2025-por-tecnologia.png" />
          </div>
          <div className="col-lg-7">
            <ChartPanel title="Top 15 Municípios — Tráfego 2025" subtitle="Dezembro/2025 (PB)" sourceTable="REL_DS013_TRAFEGO_REALIZADO"
              height={300}
              option={horizontalBarsOption((f25?.ranking_municipios ?? []).map((i) => ({ name: i.label, value: i.value, color: RAIA.r1 })), 15)}
              loading={loading} imageFilename="trafego-2025-top-municipios.png" />
          </div>
        </div>
      </Raia>

      {/* ============ Raia 2 — Plano 26 ============ */}
      <Raia tag="R2" color={RAIA.r2} badgeTextColor="#000" title="Plano 26"
        subtitle={p26?.mes_ate ? `Planejado 2026, com realizado acompanhando até ${p26.mes_ate}` : "Tráfego planejado 2026"}>
        <div className="row g-3">
          <div className="col-12">
            <ChartPanel title="Curva Mensal — Planejado × Realizado" subtitle="Consolidado 2026 (PB); realizado para no mês corrente"
              sourceTable={["REL_TRAFEGO_CIDADES_WIDE", "REL_DS013_TRAFEGO_REALIZADO"]} height={280}
              option={trafficPlanVsRealOption(
                serie.map((s) => s.mes),
                serie.map((s) => s.planejado_pb),
                serie.map((s) => s.realizado_pb),
              )}
              loading={loading} imageFilename="trafego-plano26-curva.png"
              exportSheet={{
                name: "Curva Plano x Realizado",
                columns: [
                  { header: "Mês", key: "mes" },
                  { header: "Planejado (PB)", key: "planejado_pb" },
                  { header: "Realizado (PB)", key: "realizado_pb" },
                ],
                rows: serie,
              }} />
          </div>
        </div>
        <div className="row g-3 mt-1">
          <div className="col-lg-5">
            <ChartPanel title="Planejado por Tecnologia" subtitle="Split {2G/3G, 4G, 5G} = Consolidado — Dez/2026" sourceTable="REL_TRAFEGO_CIDADES_WIDE"
              height={300} option={donutOption(toDonut(p26?.por_camada ?? []))} loading={loading}
              imageFilename="trafego-plano26-por-tecnologia.png" />
          </div>
          <div className="col-lg-7">
            <ChartPanel title="Top 15 Municípios — Plano 26" subtitle="Dezembro/2026 (PB)" sourceTable="REL_TRAFEGO_CIDADES_WIDE"
              height={300}
              option={horizontalBarsOption((p26?.ranking_municipios ?? []).map((i) => ({ name: i.label, value: i.value, color: "#003399" })), 15)}
              loading={loading} imageFilename="trafego-plano26-top-municipios.png" />
          </div>
        </div>
      </Raia>

      {/* ============ Raia 3 — Fechamento 26 ============ */}
      <Raia tag="R3" color={RAIA.r3} title="Fechamento 26"
        subtitle={f26?.mes_ate ? `Realizado de ${f26.mes_ate}/26 × plano do mesmo mês (mês de corte, não acumulado)` : "Realizado do mês × plano"}>
        <div className="row g-3">
          <div className="col-md-4">
            <KpiDeltaCard label="Realizado do Mês" icon="bi bi-reception-4" accentColor={RAIA.r3}
              value={f26 ? fmtPb(f26.trafego_mes_pb) : "—"} unit="PB"
              secondaryValue={f26?.mes_ate ? `${f26.mes_ate}/${f26.ano}` : undefined}
              deltas={[
                { label: "vs Plano (mês)", pct: vsPlanoMes },
                { label: "vs mesmo mês 2025 (YoY)", pct: f26?.crescimento_yoy_pct ?? null },
              ]} />
          </div>
          <div className="col-md-4">
            <KpiDeltaCard label="Aderência ao Plano" icon="bi bi-bullseye" accentColor="#E53935"
              value={f26 ? fmtPct(f26.aderencia_pct) : "—"} secondaryValue="Realizado ÷ Planejado (mês de corte)" deltas={[]} />
          </div>
          <div className="col-md-4">
            <KpiDeltaCard label="Mix 5G" icon="bi bi-broadcast" accentColor="#7DC242"
              value={f26 ? fmtPct(f26.mix_5g_pct) : "—"} secondaryValue="do tráfego do mês já é 5G" deltas={[]} />
          </div>
        </div>
        <div className="row g-3 mt-1">
          <div className="col-lg-5">
            <ChartPanel title="Realizado do Mês por Tecnologia" subtitle="Grupo TIM (PB)" sourceTable="REL_DS013_TRAFEGO_REALIZADO"
              height={300} option={donutOption(toDonut(f26?.por_tecnologia ?? []))} loading={loading}
              imageFilename="trafego-fech26-por-tecnologia.png" />
          </div>
          <div className="col-lg-7">
            <ChartPanel title="Top 15 Municípios — Realizado do Mês" subtitle={f26?.mes_ate ? `${f26.mes_ate}/${f26.ano} (PB)` : "Realizado do mês (PB)"}
              sourceTable="REL_DS013_TRAFEGO_REALIZADO" height={300}
              option={horizontalBarsOption((f26?.ranking_municipios ?? []).map((i) => ({ name: i.label, value: i.value, color: RAIA.r3 })), 15)}
              loading={loading} imageFilename="trafego-fech26-top-municipios.png" />
          </div>
        </div>
      </Raia>
    </div>
  );
}
