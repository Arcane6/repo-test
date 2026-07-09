import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mobileAccessApi, type MunicipioRow } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";
import { ChartToolbar } from "./ChartToolbar";
import { Skeleton } from "./Skeleton";
import { downloadSheet } from "../utils/excelExport";
import { municipiosColumns, municipiosToRows } from "../utils/municipiosColumns";
import { SourceBadge } from "./SourceBadge";

const PAGE_SIZE = 20;

/** Rótulos EOY dinâmicos, espelhando modules/mobile_access/actual/service.py
 * _year_labels() — em 2026 → ("EOY25", "EOY26"). */
function yearLabels() {
  const year = new Date().getFullYear();
  return {
    prev: `EOY${String((year - 1) % 100).padStart(2, "0")}`,
    curr: `EOY${String(year % 100).padStart(2, "0")}`,
  };
}

function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted">—</span>;
  const { curr } = yearLabels();
  const className = value === curr ? "badge bg-warning text-dark" : "badge bg-success";
  return <span className={className}>{value}</span>;
}

export function MunicipiosTable() {
  const { uf, municipio, tecnologia } = useFilterStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["actual-table", uf, municipio, tecnologia],
    queryFn: () => mobileAccessApi.table({ uf, municipio, tecnologia }),
  });
  const rows = data ?? [];

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r: MunicipioRow) =>
        r.uf.toLowerCase().includes(term) ||
        r.municipio.toLowerCase().includes(term),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
          <div className="d-flex align-items-center gap-2">
            <h5 className="card-title mb-0">Municípios</h5>
            <SourceBadge table="MUNICIPIOS_FECHAMENTO" />
          </div>
          <div className="d-flex align-items-center gap-2">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Buscar..."
              style={{ maxWidth: 160 }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <ChartToolbar
              onExportData={() => {
                if (exporting) return;
                setExporting(true);
                mobileAccessApi
                  .tableExport()
                  .then((full) =>
                    downloadSheet("municipios.xlsx", {
                      name: "Municípios",
                      columns: municipiosColumns,
                      rows: municipiosToRows(full),
                    }),
                  )
                  .finally(() => setExporting(false));
              }}
            />
          </div>
        </div>

        <div className="table-responsive flex-grow-1" style={{ maxHeight: 380 }}>
          <table className="table table-sm table-striped table-hover">
            <thead className="sticky-top bg-white">
              <tr>
                <th>IBGE</th>
                <th>UF</th>
                <th>Município</th>
                <th className="text-center">5G</th>
                <th className="text-center">4G</th>
                <th className="text-center">3G</th>
                <th className="text-center">2G</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton height={12} width="70%" /></td>
                      <td><Skeleton height={12} width="70%" /></td>
                      <td><Skeleton height={12} width="85%" /></td>
                      <td><Skeleton height={12} width="85%" /></td>
                      <td className="text-center"><Skeleton height={18} width={36} className="mx-auto" /></td>
                      <td className="text-center"><Skeleton height={18} width={36} className="mx-auto" /></td>
                      <td className="text-center"><Skeleton height={18} width={36} className="mx-auto" /></td>
                      <td className="text-center"><Skeleton height={18} width={36} className="mx-auto" /></td>
                    </tr>
                  ))
                : pageRows.map((r) => (
                    <tr key={r.ibge}>
                      <td>{r.ibge}</td>
                      <td>{r.uf}</td>
                      <td>{r.municipio}</td>
                      <td className="text-center"><StatusBadge value={r.status_5g} /></td>
                      <td className="text-center"><StatusBadge value={r.status_4g} /></td>
                      <td className="text-center"><StatusBadge value={r.status_3g} /></td>
                      <td className="text-center"><StatusBadge value={r.status_2g} /></td>
                    </tr>
                  ))}
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
