import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sitesApi, type SitesFilters, type SitesPivotRow } from "../api/sites";
import { ChartToolbar } from "./ChartToolbar";
import { Skeleton } from "./Skeleton";
import { SourceBadge } from "./SourceBadge";
import { downloadSheet } from "../utils/excelExport";

const PAGE_SIZE = 20;

type Metric = "max" | "tec";

const METRIC_LABEL: Record<Metric, string> = {
  max: "Tecnologia máxima (cascata 5G>4G>3G>2G)",
  tec: "Por tecnologia (contagem independente)",
};

function metricValue(row: SitesPivotRow, metric: Metric, tec: "2g" | "3g" | "4g" | "5g") {
  return metric === "max" ? row[`max_${tec}`] : row[`tec_${tec}`];
}

/**
 * Tabela agrupada por Regional / UF / Município — não é um pivot
 * arrasta-solta de verdade, é uma tabela plana (o backend já entrega no
 * menor grão) com um seletor pra trocar entre as duas métricas de
 * "sites por tecnologia" (max-tech vs contagem independente).
 */
export function SitesPivotTable({ filters }: { filters: SitesFilters }) {
  const [metric, setMetric] = useState<Metric>("max");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["sites-pivot", filters.uf, filters.municipio, filters.regionais],
    queryFn: () => sitesApi.pivot(filters),
  });
  const rows = data?.rows ?? [];

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.uf.toLowerCase().includes(term) ||
        r.municipio.toLowerCase().includes(term) ||
        (r.regional ?? "").toLowerCase().includes(term),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-3 gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <h6 className="fw-bold mb-0">Sites por Regional / UF / Município</h6>
            <SourceBadge table="TB_FT_BASE_UNICA_SITES" />
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <select
              className="form-select form-select-sm"
              style={{ width: 260 }}
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
            >
              <option value="max">{METRIC_LABEL.max}</option>
              <option value="tec">{METRIC_LABEL.tec}</option>
            </select>
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
                downloadSheet("sites-por-regional-uf-municipio.xlsx", {
                  name: "Sites por Geo",
                  columns: [
                    { header: "Regional", key: "regional" },
                    { header: "UF", key: "uf" },
                    { header: "Município", key: "municipio" },
                    { header: "2G", key: "v2g" },
                    { header: "3G", key: "v3g" },
                    { header: "4G", key: "v4g" },
                    { header: "5G", key: "v5g" },
                    { header: "Total", key: "total_sites" },
                  ],
                  rows: filtered.map((r) => ({
                    regional: r.regional,
                    uf: r.uf,
                    municipio: r.municipio,
                    v2g: metricValue(r, metric, "2g"),
                    v3g: metricValue(r, metric, "3g"),
                    v4g: metricValue(r, metric, "4g"),
                    v5g: metricValue(r, metric, "5g"),
                    total_sites: r.total_sites,
                  })),
                })
              }
            />
          </div>
        </div>

        <div className="table-responsive flex-grow-1" style={{ maxHeight: 380 }}>
          <table className="table table-sm table-striped table-hover">
            <thead className="sticky-top bg-white">
              <tr>
                <th>Regional</th>
                <th>UF</th>
                <th>Município</th>
                <th className="text-center">5G</th>
                <th className="text-center">4G</th>
                <th className="text-center">3G</th>
                <th className="text-center">2G</th>
                <th className="text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton height={12} width="70%" /></td>
                      <td><Skeleton height={12} width="70%" /></td>
                      <td><Skeleton height={12} width="85%" /></td>
                      <td className="text-center"><Skeleton height={12} width={24} className="mx-auto" /></td>
                      <td className="text-center"><Skeleton height={12} width={24} className="mx-auto" /></td>
                      <td className="text-center"><Skeleton height={12} width={24} className="mx-auto" /></td>
                      <td className="text-center"><Skeleton height={12} width={24} className="mx-auto" /></td>
                      <td className="text-center"><Skeleton height={12} width={24} className="mx-auto" /></td>
                    </tr>
                  ))
                : pageRows.map((r, i) => (
                    <tr key={`${r.uf}-${r.municipio}-${i}`}>
                      <td>{r.regional ?? "—"}</td>
                      <td>{r.uf}</td>
                      <td>{r.municipio}</td>
                      <td className="text-center">{metricValue(r, metric, "5g")}</td>
                      <td className="text-center">{metricValue(r, metric, "4g")}</td>
                      <td className="text-center">{metricValue(r, metric, "3g")}</td>
                      <td className="text-center">{metricValue(r, metric, "2g")}</td>
                      <td className="text-center fw-bold">{r.total_sites}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-2">
          <small className="text-muted">{filtered.length.toLocaleString("pt-BR")} municípios</small>
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
