import { useQuery } from "@tanstack/react-query";
import { ChartPanel } from "../components/ChartPanel";
import { KpiDeltaCard } from "../components/KpiDeltaCard";
import { SourceBadge } from "../components/SourceBadge";
import { horizontalBarsOption } from "../charts/optionBuilders";
import { transportApi, type ReconCell } from "../api/transport";
import { useTransportFilterStore } from "../store/transportFilters";
import { TRANSPORT_COLORS, TRANSPORT_ORDER } from "../theme";

const src = "REL_TX_PROFILE × TB_FT_BASE_UNICA_SITES";
const fmtInt = (n: number) => n.toLocaleString("pt-BR");

/** Mídias presentes na matriz, na ordem canônica (só as que aparecem). */
function presentMedias(matriz: ReconCell[]): string[] {
  const seen = new Set<string>();
  for (const c of matriz) { seen.add(c.tx); seen.add(c.base); }
  return TRANSPORT_ORDER.filter((m) => seen.has(m));
}

/** Cor da célula: diagonal (concordância) em verde suave; fora da diagonal
 * (divergência) em vermelho com opacidade proporcional ao volume. */
function cellStyle(n: number, isDiag: boolean, maxOff: number): React.CSSProperties {
  if (n === 0) return { background: "transparent", color: "var(--tim-text-muted)" };
  if (isDiag) return { background: "rgba(46,158,91,0.18)", color: "var(--tim-text)", fontWeight: 700 };
  const a = maxOff > 0 ? 0.12 + 0.55 * (n / maxOff) : 0.3;
  return { background: `rgba(229,57,53,${a.toFixed(3)})`, color: n / maxOff > 0.5 ? "#fff" : "var(--tim-text)" };
}

/** Matriz de confusão TX_PROFILE (linhas) × Base Única (colunas). */
function ConfusionMatrix({ matriz }: { matriz: ReconCell[] }) {
  const medias = presentMedias(matriz);
  const lookup = new Map(matriz.map((c) => [`${c.tx}|${c.base}`, c.n]));
  const maxOff = Math.max(1, ...matriz.filter((c) => c.tx !== c.base).map((c) => c.n));

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex align-items-center gap-2 mb-1">
          <h6 className="fw-bold mb-0">Matriz de Concordância — Mídia</h6>
          <SourceBadge table={src} />
        </div>
        <small className="text-muted d-block mb-3">
          Linha = mídia no TX_PROFILE (Fech. 26) · Coluna = mídia na Base Única (atual).
          A <span style={{ color: "#2E9E5B", fontWeight: 700 }}>diagonal</span> é concordância;
          fora dela, <span style={{ color: "#E53935", fontWeight: 700 }}>divergência</span> de cadastro.
        </small>
        <div style={{ overflowX: "auto" }}>
          <table className="table table-sm mb-0" style={{ textAlign: "center", minWidth: 420 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontSize: 12 }}>TX ↓ / Base →</th>
                {medias.map((m) => (
                  <th key={m} style={{ fontSize: 12, color: TRANSPORT_COLORS[m] }}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {medias.map((tx) => (
                <tr key={tx}>
                  <td style={{ textAlign: "left", fontWeight: 700, fontSize: 12, color: TRANSPORT_COLORS[tx] }}>{tx}</td>
                  {medias.map((base) => {
                    const n = lookup.get(`${tx}|${base}`) ?? 0;
                    return (
                      <td key={base} style={{ fontSize: 12, ...cellStyle(n, tx === base, maxOff) }}>
                        {n === 0 ? "·" : fmtInt(n)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function TransporteReconciliacao() {
  const { uf, municipio, regional } = useTransportFilterStore();
  const filters = { uf, municipio, regional };

  const { data, isFetching: loading, error } = useQuery({
    queryKey: ["transport-reconciliacao", uf, municipio, regional],
    queryFn: () => transportApi.reconciliacao(filters),
    retry: false,
  });

  const pct = data?.pct_concordancia;

  return (
    <div className="tim-page-enter">
      <div className="alert alert-info d-flex align-items-start gap-2" role="alert">
        <i className="bi bi-info-circle-fill mt-1" />
        <div className="small">
          Compara, site a site (<code>END_ID</code>), a mídia de transporte como está no
          <strong> TX_PROFILE</strong> (Fech. 26) versus como está na <strong>Base Única de Sites</strong>
          (inventário atual). Serve pra medir a confiança no dado e caçar divergência de cadastro entre as bases.
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div><strong>Falha ao carregar a reconciliação.</strong>
            <div className="small mt-1">{(error as Error).message}</div></div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-md-3">
          <KpiDeltaCard label="Sites nas Duas Bases" icon="bi bi-diagram-2" accentColor="#003399"
            value={data ? fmtInt(data.em_ambas) : "—"} secondaryValue="com par por END_ID" deltas={[]} />
        </div>
        <div className="col-md-3">
          <KpiDeltaCard label="Concordância de Mídia" icon="bi bi-check2-circle" accentColor="#2E9E5B"
            value={pct != null ? `${pct.toLocaleString("pt-BR")}%` : "—"} secondaryValue="TX_PROFILE = Base Única" deltas={[]} />
        </div>
        <div className="col-md-3">
          <KpiDeltaCard label="Divergências" icon="bi bi-exclamation-diamond" accentColor="#E53935"
            value={data ? fmtInt(data.divergentes) : "—"} secondaryValue="mídia diferente entre bases" deltas={[]} />
        </div>
        <div className="col-md-3">
          <KpiDeltaCard label="Só no TX_PROFILE" icon="bi bi-question-circle" accentColor="#F5A623"
            value={data ? fmtInt(data.so_no_tx) : "—"} secondaryValue="sem par na Base Única" deltas={[]} />
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-7">
          {loading && !data ? (
            <div className="card shadow-sm h-100"><div className="card-body">Carregando…</div></div>
          ) : (
            <ConfusionMatrix matriz={data?.matriz ?? []} />
          )}
        </div>
        <div className="col-lg-5">
          <ChartPanel title="Maiores Divergências" subtitle="TX_PROFILE → Base Única (nº de sites)"
            sourceTable={src} height={340}
            option={horizontalBarsOption((data?.top_divergencias ?? []).map((d) => ({
              name: `${d.tx} → ${d.base}`, value: d.value, color: "#E53935",
            })), 10)}
            loading={loading} imageFilename="transporte-divergencias.png"
            exportSheet={{ name: "Divergências", columns: [
              { header: "TX_PROFILE", key: "tx" }, { header: "Base Única", key: "base" }, { header: "Sites", key: "value" },
            ], rows: data?.top_divergencias ?? [] }} />
        </div>
      </div>
    </div>
  );
}
