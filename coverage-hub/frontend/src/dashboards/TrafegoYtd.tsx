import { useQuery } from "@tanstack/react-query";
import { ChartPanel } from "../components/ChartPanel";
import { KpiDeltaCard } from "../components/KpiDeltaCard";
import { SourceBadge } from "../components/SourceBadge";
import { timeSeriesOption } from "../charts/optionBuilders";
import { trafficApi } from "../api/traffic";
import { useTrafficFilterStore } from "../store/trafficFilters";

const fmtPb = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const fmtPct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

/** Cor da aderência: verde perto/acima de 100%, âmbar em atenção, vermelho baixo. */
function aderColor(pct: number | null): string {
  if (pct === null) return "#6C757D";
  if (pct >= 95) return "#2E7D32";
  if (pct >= 80) return "#F5A623";
  return "#E53935";
}

export function TrafegoYtd() {
  const { uf, municipio } = useTrafficFilterStore();
  const filters = { uf, municipio };

  const { data, isFetching: loading, error } = useQuery({
    queryKey: ["traffic-ytd", uf, municipio],
    queryFn: () => trafficApi.ytd(filters),
    retry: false,
  });

  const serie = data?.serie_acumulada ?? [];
  const periods = serie.map((p) => p.mes);
  const timeOption = timeSeriesOption(periods, [
    { name: "Planejado", color: "#94A3B8", values: serie.map((p) => p.planejado_pb) },
    { name: "Realizado", color: "#003399", values: serie.map((p) => p.realizado_pb) },
  ]);

  return (
    <div className="tim-page-enter">
      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div>
            <strong>Falha ao carregar o Tráfego YTD.</strong>
            <div className="small mt-1">{(error as Error).message}</div>
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-md-4">
          <KpiDeltaCard label="Planejado YTD" icon="bi bi-graph-up" accentColor="#94A3B8"
            value={data ? fmtPb(data.planejado_ytd_pb) : "—"} unit="PB"
            secondaryValue={data?.mes_ate ? `Jan–${data.mes_ate}/${data.ano}` : undefined} deltas={[]} />
        </div>
        <div className="col-md-4">
          <KpiDeltaCard label="Realizado YTD (TIM)" icon="bi bi-reception-4" accentColor="#003399"
            value={data ? fmtPb(data.realizado_ytd_pb) : "—"} unit="PB"
            secondaryValue={data?.mes_ate ? `Jan–${data.mes_ate}/${data.ano}` : undefined} deltas={[]} />
        </div>
        <div className="col-md-4">
          <KpiDeltaCard label="Aderência ao Plano" icon="bi bi-bullseye" accentColor={aderColor(data?.aderencia_pct ?? null)}
            value={data ? fmtPct(data.aderencia_pct) : "—"} secondaryValue="Realizado ÷ Planejado" deltas={[]} />
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <ChartPanel title="Acumulado do Ano — Planejado × Realizado" subtitle="Tráfego TIM acumulado mês a mês (PB)"
            sourceTable={["REL_TRAFEGO_CIDADES_WIDE", "REL_DS013_TRAFEGO_REALIZADO"]} height={340}
            option={timeOption} loading={loading} imageFilename="trafego-ytd-acumulado.png"
            exportSheet={{
              name: "YTD Acumulado",
              columns: [
                { header: "Mês", key: "mes" },
                { header: "Planejado (PB)", key: "planejado_pb" },
                { header: "Realizado (PB)", key: "realizado_pb" },
                { header: "Aderência (%)", key: "aderencia_pct" },
              ],
              rows: serie,
            }} />
        </div>
      </div>

      {/* Plano × Realizado por UF */}
      <div className="card shadow-sm mt-3">
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 mb-3">
            <h6 className="fw-bold mb-0">Plano × Realizado por UF (YTD)</h6>
            <SourceBadge table={["REL_TRAFEGO_CIDADES_WIDE", "REL_DS013_TRAFEGO_REALIZADO"]} />
          </div>
          <div className="table-responsive" style={{ maxHeight: 420 }}>
            <table className="table table-sm table-striped table-hover align-middle mb-0">
              <thead className="sticky-top bg-body">
                <tr>
                  <th>UF</th>
                  <th className="text-end">Planejado (PB)</th>
                  <th className="text-end">Realizado (PB)</th>
                  <th className="text-end">Aderência</th>
                </tr>
              </thead>
              <tbody>
                {(data?.por_uf ?? []).map((u) => (
                  <tr key={u.uf}>
                    <td className="fw-semibold">{u.uf}</td>
                    <td className="text-end">{fmtPb(u.planejado_pb)}</td>
                    <td className="text-end">{fmtPb(u.realizado_pb)}</td>
                    <td className="text-end">
                      <span className="badge" style={{ backgroundColor: aderColor(u.aderencia_pct) }}>
                        {fmtPct(u.aderencia_pct)}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && (data?.por_uf ?? []).length === 0 && (
                  <tr><td colSpan={4} className="text-center text-muted py-4">Sem dados no recorte atual.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
