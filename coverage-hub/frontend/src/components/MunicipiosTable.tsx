import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mobileAccessApi, type MunicipioRow } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";
import { ChartToolbar } from "./ChartToolbar";
import { downloadSheet } from "../utils/excelExport";
import { municipiosColumns, municipiosToRows } from "../utils/municipiosColumns";

const PAGE_SIZE = 15;

function Badge({ value }: { value: number }) {
  return value === 1 ? (
    <span className="badge bg-success">Sim</span>
  ) : (
    <span className="badge bg-secondary">Não</span>
  );
}

export function MunicipiosTable() {
  const { uf, municipio, tecnologia } = useFilterStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: rows = [] } = useQuery({
    queryKey: ["actual-table", uf, municipio, tecnologia],
    queryFn: () => mobileAccessApi.table({ uf, municipio, tecnologia }),
  });

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
          <h5 className="card-title mb-0">Municípios</h5>
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
              onExportData={() =>
                downloadSheet("municipios.xlsx", {
                  name: "Municípios",
                  columns: municipiosColumns,
                  rows: municipiosToRows(filtered),
                })
              }
            />
          </div>
        </div>

        <div className="table-responsive flex-grow-1" style={{ maxHeight: 380 }}>
          <table className="table table-sm table-striped table-hover">
            <thead className="sticky-top bg-white">
              <tr>
                <th>UF</th>
                <th>Município</th>
                <th className="text-center">TIM</th>
                <th className="text-center">5G</th>
                <th className="text-center">4G</th>
                <th className="text-center">3G</th>
                <th className="text-center">2G</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={`${r.uf}-${r.municipio}`}>
                  <td>{r.uf}</td>
                  <td>{r.municipio}</td>
                  <td className="text-center"><Badge value={r.presenca} /></td>
                  <td className="text-center"><Badge value={r.presenca_5g} /></td>
                  <td className="text-center"><Badge value={r.presenca_4g} /></td>
                  <td className="text-center"><Badge value={r.presenca_3g} /></td>
                  <td className="text-center"><Badge value={r.presenca_2g} /></td>
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
