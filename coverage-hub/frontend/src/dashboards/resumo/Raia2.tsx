import { useQuery } from "@tanstack/react-query";
import { summaryApi, type SummaryFilters } from "../../api/summary";
import { donutOption, horizontalBarsOption, pieOption } from "../../charts/optionBuilders";
import { ChartPanel } from "../../components/ChartPanel";
import { SmallMultiplesTech } from "../../components/SmallMultiplesTech";
import { ChartToolbar } from "../../components/ChartToolbar";
import { downloadSheet } from "../../utils/excelExport";
import { useResumoFocusStore } from "../../store/resumoFocus";

export function Raia2({ filters }: { filters: SummaryFilters }) {
  const { uf, municipio, ano } = filters;
  const { tecnologia: focusedTec, regional: focusedRegional, toggleTecnologia, toggleRegional } =
    useResumoFocusStore();

  const { data: sites } = useQuery({
    queryKey: ["summary-r2-sites", uf, municipio, ano],
    queryFn: () => summaryApi.r2SitesByTech(filters),
  });

  const { data: citiesAnf, isFetching: loadingCitiesAnf } = useQuery({
    queryKey: ["summary-r2-cities-anf", uf, municipio, ano],
    queryFn: () => summaryApi.r2NewCitiesByAnf(filters),
  });

  const { data: vendors, isFetching: loadingVendors } = useQuery({
    queryKey: ["summary-r2-vendors", uf, municipio, ano],
    queryFn: () => summaryApi.r2VendorsNewSites(filters),
  });

  const { data: projects, isFetching: loadingProjects } = useQuery({
    queryKey: ["summary-r2-projects", uf, municipio, ano],
    queryFn: () => summaryApi.r2TopProjects(filters),
  });

  return (
    <div className="summary-raia mb-4">
      <div className="d-flex align-items-center mb-3">
        <span className="raia-badge me-2" style={{ background: "#F5C518", color: "#000" }}>R2</span>
        <h5 className="fw-bold mb-0">Plano 26</h5>
        <small className="text-muted ms-3">O que planejamos entregar no ano</small>
      </div>

      <div className="row g-3">
        <div className="col-lg-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-1">
                <div>
                  <h6 className="fw-bold mb-2">OCs do Plano por Tecnologia</h6>
                  <small className="text-muted d-block mb-3">
                    Ações do rollout · Casa Nova cria site novo · Casa Existente é upgrade —
                    clique numa tecnologia pra destacar nas outras raias
                  </small>
                </div>
                <ChartToolbar
                  onExportData={
                    sites
                      ? () =>
                          downloadSheet("r2-ocs-por-tecnologia.xlsx", {
                            name: "R2 OCs por Tecnologia",
                            columns: [
                              { header: "Tecnologia", key: "tec" },
                              { header: "Casa Nova", key: "nova" },
                              { header: "Casa Existente", key: "existente" },
                            ],
                            rows: sites.categories.map((tec, i) => ({
                              tec,
                              nova: sites.series[0]?.data[i] ?? 0,
                              existente: sites.series[1]?.data[i] ?? 0,
                            })),
                          })
                      : undefined
                  }
                />
              </div>

              <SmallMultiplesTech data={sites} focusedTec={focusedTec} onSelectTec={toggleTecnologia} />

              <div className="d-flex justify-content-center gap-3 mt-3 small">
                <span><i className="sm-legend-box" style={{ background: "#26C281" }} /> Casa Nova</span>
                <span><i className="sm-legend-box" style={{ background: "#1565C0" }} /> Casa Existente</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-3">
          <ChartPanel
            title="Novas Cidades por Regional"
            subtitle="Clique numa fatia pra destacar o regional na Raia 3"
            height={340}
            option={pieOption(citiesAnf?.slices ?? [], focusedRegional)}
            loading={loadingCitiesAnf}
            onClick={(e) => toggleRegional(e.name)}
            imageFilename="r2-novas-cidades-por-regional.png"
            exportSheet={{
              name: "R2 Novas Cidades por Regional",
              columns: [
                { header: "Regional", key: "label" },
                { header: "Cidades", key: "value" },
              ],
              rows: citiesAnf?.slices ?? [],
            }}
          />
        </div>

        <div className="col-lg-3">
          <ChartPanel
            title="OCs do Plano por Fornecedor"
            subtitle="Casa Nova a contratar · Upgrades pelo vendor do site existente"
            height={340}
            option={donutOption(vendors ?? [])}
            loading={loadingVendors}
            imageFilename="r2-ocs-por-fornecedor.png"
            exportSheet={{
              name: "R2 Fornecedores",
              columns: [
                { header: "Fornecedor", key: "label" },
                { header: "OCs", key: "value" },
              ],
              rows: vendors ?? [],
            }}
          />
        </div>

        <div className="col-lg-3">
          <ChartPanel
            title="Top 10 Projetos"
            height={340}
            option={horizontalBarsOption((projects ?? []).map((p) => ({ name: p.projeto, value: p.value })))}
            loading={loadingProjects}
            imageFilename="r2-top-projetos.png"
            exportSheet={{
              name: "R2 Top Projetos",
              columns: [
                { header: "Projeto", key: "projeto" },
                { header: "OCs", key: "value" },
              ],
              rows: projects ?? [],
            }}
          />
        </div>
      </div>
    </div>
  );
}
