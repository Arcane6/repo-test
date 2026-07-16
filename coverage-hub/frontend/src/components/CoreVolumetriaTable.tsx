import { useMemo, useState } from "react";
import { ChartToolbar } from "./ChartToolbar";
import { Skeleton } from "./Skeleton";
import { SourceBadge } from "./SourceBadge";
import { downloadSheet } from "../utils/excelExport";
import type { CoreTabelaItem } from "../api/core";

const PAGE_SIZE = 20;

const fmtPb = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Tabela de volumetria de tráfego por município — substituiu o mapa de
 * bolhas (que carregava ~5500 marcadores e um payload pesado com lat/lon).
 * Mesma leitura de "onde está o tráfego", com busca + paginação e uma
 * fração do peso. Presentational: recebe as linhas já vindas do
 * /core/api/overview (não faz fetch próprio, pra não disparar as queries
 * pesadas de novo).
 */
export function CoreVolumetriaTable({
  items,
  loading = false,
}: {
  items: CoreTabelaItem[];
  loading?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (r) =>
        r.municipio.toLowerCase().includes(term) ||
        r.uf.toLowerCase().includes(term) ||
        (r.regional ?? "").toLowerCase().includes(term),
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-3 gap-2 flex-wrap">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h6 className="fw-bold mb-0">Volumetria de Tráfego por Município</h6>
              <SourceBadge table="TB_AUX_INFO_MUNICIPIOS" />
            </div>
            <small className="text-muted d-block">Último mês disponível, ordenado por volumetria</small>
          </div>
          <div className="d-flex align-items-center gap-2">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Buscar município/UF/regional..."
              style={{ maxWidth: 220 }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <ChartToolbar
              onExportData={() =>
                downloadSheet("core-volumetria-por-municipio.xlsx", {
                  name: "Volumetria por Município",
                  columns: [
                    { header: "Município", key: "municipio" },
                    { header: "UF", key: "uf" },
                    { header: "Regional", key: "regional" },
                    { header: "Volumetria (PB)", key: "volumetria_pb" },
                  ],
                  rows: filtered,
                })
              }
            />
          </div>
        </div>

        <div className="table-responsive flex-grow-1" style={{ maxHeight: 420 }}>
          <table className="table table-sm table-striped table-hover align-middle mb-0">
            <thead className="sticky-top bg-body">
              <tr>
                <th style={{ width: 48 }} className="text-end">#</th>
                <th>Município</th>
                <th className="text-center">UF</th>
                <th>Regional</th>
                <th className="text-end">Volumetria (PB)</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="text-end"><Skeleton height={12} width="60%" /></td>
                      <td><Skeleton height={12} width="80%" /></td>
                      <td className="text-center"><Skeleton height={12} width={28} className="mx-auto" /></td>
                      <td><Skeleton height={12} width="70%" /></td>
                      <td className="text-end"><Skeleton height={12} width="50%" /></td>
                    </tr>
                  ))
                : pageRows.map((r, i) => (
                    <tr key={`${r.municipio}-${r.uf}-${startIdx + i}`}>
                      <td className="text-end text-muted">{startIdx + i + 1}</td>
                      <td>{r.municipio}</td>
                      <td className="text-center">{r.uf}</td>
                      <td>{r.regional ?? "—"}</td>
                      <td className="text-end fw-semibold">{fmtPb(r.volumetria_pb)}</td>
                    </tr>
                  ))}
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Nenhum município encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-2">
          <small className="text-muted">
            {filtered.length.toLocaleString("pt-BR")} municípios
          </small>
          <div>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹
            </button>
            <span className="mx-2 small">
              Página {currentPage} / {totalPages}
            </span>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
