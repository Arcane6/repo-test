import { useQuery } from "@tanstack/react-query";
import { ChartPanel } from "../components/ChartPanel";
import { KpiDeltaCard } from "../components/KpiDeltaCard";
import { SourceBadge } from "../components/SourceBadge";
import { horizontalBarsOption } from "../charts/optionBuilders";
import { downloadSheet } from "../utils/excelExport";
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

const UNDEF = "Não definido";

/** Cor da célula: diagonal (concordância, inclui vazio=vazio) em verde; fora
 * da diagonal com nulo dos dois lados = "falta cadastro" em cinza (não é
 * conflito); divergência real (ambas definidas e ≠) em vermelho graduado. */
function cellStyle(n: number, isDiag: boolean, isGap: boolean, maxOff: number): React.CSSProperties {
  if (n === 0) return { background: "transparent", color: "var(--tim-text-muted)" };
  if (isDiag) return { background: "rgba(46,158,91,0.18)", color: "var(--tim-text)", fontWeight: 700 };
  if (isGap) return { background: "rgba(144,164,174,0.20)", color: "var(--tim-text-muted)" };
  const a = maxOff > 0 ? 0.12 + 0.55 * (n / maxOff) : 0.3;
  return { background: `rgba(229,57,53,${a.toFixed(3)})`, color: n / maxOff > 0.5 ? "#fff" : "var(--tim-text)" };
}

/** Matriz de confusão TX_PROFILE (linhas) × Base Única (colunas). */
function ConfusionMatrix({ matriz }: { matriz: ReconCell[] }) {
  const medias = presentMedias(matriz);
  const lookup = new Map(matriz.map((c) => [`${c.tx}|${c.base}`, c.n]));
  // escala do vermelho só sobre divergência REAL (ambas definidas e ≠)
  const maxOff = Math.max(1, ...matriz.filter((c) => c.tx !== c.base && c.tx !== UNDEF && c.base !== UNDEF).map((c) => c.n));

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex align-items-center gap-2 mb-1">
          <h6 className="fw-bold mb-0">Matriz de Concordância — Mídia</h6>
          <SourceBadge table={src} />
        </div>
        <small className="text-muted d-block mb-3">
          Linha = mídia no TX_PROFILE (Fech. 26) · Coluna = mídia na Base Única (atual).
          <span style={{ color: "#2E9E5B", fontWeight: 700 }}> Verde</span> = concordância (inclui vazio=vazio);
          <span style={{ color: "#E53935", fontWeight: 700 }}> vermelho</span> = divergência real;
          <span style={{ color: "#78909C", fontWeight: 700 }}> cinza</span> = falta cadastro (1 base vazia).
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
                    const isGap = tx !== base && (tx === UNDEF || base === UNDEF);
                    return (
                      <td key={base} style={{ fontSize: 12, ...cellStyle(n, tx === base, isGap, maxOff) }}>
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

  const { data: div } = useQuery({
    queryKey: ["transport-reconciliacao-div", uf, municipio, regional],
    queryFn: () => transportApi.reconciliacaoDivergencias(filters),
    retry: false,
  });

  const pct = data?.pct_concordancia;
  const divRows = div?.rows ?? [];

  function exportDivergencias() {
    downloadSheet("transporte-divergencias-cadastro.xlsx", {
      name: "Divergências",
      columns: [
        { header: "END_ID", key: "end_id" },
        { header: "UF", key: "uf" },
        { header: "Município", key: "municipio" },
        { header: "IBGE", key: "ibge" },
        { header: "Tipo TX_PROFILE", key: "tipo_tx" },
        { header: "Tipo Base Única", key: "tipo_base" },
        { header: "Mídia TX", key: "media_tx" },
        { header: "Mídia Base", key: "media_base" },
      ],
      rows: divRows,
    });
  }

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
            value={pct != null ? `${pct.toLocaleString("pt-BR")}%` : "—"} secondaryValue="mesma mídia (vazio=vazio conta)" deltas={[]} />
        </div>
        <div className="col-md-3">
          <KpiDeltaCard label="Divergências" icon="bi bi-exclamation-diamond" accentColor="#E53935"
            value={data ? fmtInt(data.divergentes) : "—"} secondaryValue="ambas com mídia, e diferente" deltas={[]} />
        </div>
        <div className="col-md-3">
          <KpiDeltaCard label="Falta Cadastro" icon="bi bi-dash-circle" accentColor="#F5A623"
            value={data ? fmtInt(data.falta_cadastro) : "—"} secondaryValue="1 base com mídia, a outra vazia" deltas={[]} />
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

      <div className="row g-3 mt-1">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-1 flex-wrap gap-2">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <h6 className="fw-bold mb-0">Worklist de Correção — Sites Divergentes</h6>
                    <SourceBadge table={src} />
                  </div>
                  <small className="text-muted d-block">
                    Cada linha é um site cuja mídia difere entre as bases — a lista pra time de cadastro corrigir.
                    {div ? ` ${fmtInt(div.total)} sites${div.truncated ? "+ (limitado a 5.000; refine o filtro)" : ""}.` : ""}
                  </small>
                </div>
                <button className="btn btn-sm btn-outline-success" onClick={exportDivergencias} disabled={divRows.length === 0}>
                  <i className="bi bi-file-earmark-excel me-1" /> Exportar Excel
                </button>
              </div>
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ position: "sticky", top: 0, background: "var(--tim-card-bg)", zIndex: 1 }}>
                    <tr>
                      <th>END_ID</th><th>UF</th><th>Município</th><th>IBGE</th>
                      <th>Tipo TX_PROFILE</th><th>Tipo Base Única</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divRows.length === 0 ? (
                      <tr><td colSpan={6} className="text-center text-muted py-3">Nenhuma divergência de cadastro.</td></tr>
                    ) : (
                      divRows.slice(0, 500).map((r, i) => (
                        <tr key={`${r.end_id}-${i}`}>
                          <td className="fw-bold">{r.end_id}</td>
                          <td>{r.uf}</td>
                          <td>{r.municipio}</td>
                          <td>{r.ibge}</td>
                          <td><span style={{ color: TRANSPORT_COLORS[r.media_tx] }}>{r.tipo_tx || r.media_tx}</span></td>
                          <td><span style={{ color: TRANSPORT_COLORS[r.media_base] }}>{r.tipo_base || r.media_base}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {divRows.length > 500 && (
                <small className="text-muted d-block mt-2">
                  Mostrando os primeiros 500 na tela — use <strong>Exportar Excel</strong> pra baixar todos ({fmtInt(divRows.length)}).
                </small>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
