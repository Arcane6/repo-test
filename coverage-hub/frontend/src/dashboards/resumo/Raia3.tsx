import { useQuery } from "@tanstack/react-query";
import { summaryApi, type SummaryFilters } from "../../api/summary";
import { horizontalBarsOption, regionalSunburstOption, vendorDonutSideOption } from "../../charts/optionBuilders";
import { ChartPanel } from "../../components/ChartPanel";
import { SmallMultiplesTech } from "../../components/SmallMultiplesTech";
import { ChartToolbar } from "../../components/ChartToolbar";
import { downloadSheet } from "../../utils/excelExport";
import { useResumoFocusStore } from "../../store/resumoFocus";

export function Raia3({ filters }: { filters: SummaryFilters }) {
  const { uf, municipio, ano } = filters;
  const { tecnologia: focusedTec, regional: focusedRegional, toggleTecnologia, toggleRegional } =
    useResumoFocusStore();

  const { data: sites } = useQuery({
    queryKey: ["summary-r3-sites", uf, municipio, ano],
    queryFn: () => summaryApi.r3SitesByTech(filters),
  });

  const { data: citiesAnf, isFetching: loadingCitiesAnf } = useQuery({
    queryKey: ["summary-r3-cities-anf", uf, municipio, ano],
    queryFn: () => summaryApi.r3NewCitiesByAnf(filters),
  });

  const { data: vendors, isFetching: loadingVendors } = useQuery({
    queryKey: ["summary-r3-vendors", uf, municipio, ano],
    queryFn: () => summaryApi.r3Vendors(filters),
  });

  const { data: projects, isFetching: loadingProjects } = useQuery({
    queryKey: ["summary-r3-projects", uf, municipio, ano],
    queryFn: () => summaryApi.r3TopProjects(filters),
  });

  return (
    <div className="summary-raia mb-4">
      <div className="d-flex align-items-center mb-3">
        <span className="raia-badge me-2" style={{ background: "#7DC242" }}>R3</span>
        <h5 className="fw-bold mb-0">Fechamento 26 (Projeção)</h5>
        <small className="text-muted ms-3">Baseline + Plano — onde vamos fechar o ano</small>
      </div>

      <div className="row g-3">
        <div className="col-lg-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-1">
                <div>
                  <h6 className="fw-bold mb-2">Sites Físicos EoY 26</h6>
                  <small className="text-muted d-block mb-3">
                    Base 25 + Casa Nova · Upgrades não somam (já existem na Base)
                  </small>
                </div>
                <ChartToolbar
                  onExportData={
                    sites
                      ? () =>
                          downloadSheet("r3-sites-fisicos-eoy26.xlsx", {
                            name: "R3 Sites Físicos EoY 26",
                            columns: [
                              { header: "Tecnologia", key: "tec" },
                              { header: "Base 25", key: "base" },
                              { header: "Casa Nova", key: "nova" },
                              { header: "Upgrade (Casa Existente)", key: "upgrade" },
                            ],
                            rows: sites.categories.map((tec, i) => ({
                              tec,
                              base: sites.series[0]?.data[i] ?? 0,
                              nova: sites.series[1]?.data[i] ?? 0,
                              upgrade: sites.series[2]?.data[i] ?? 0,
                            })),
                          })
                      : undefined
                  }
                />
              </div>

              <SmallMultiplesTech data={sites} focusedTec={focusedTec} onSelectTec={toggleTecnologia} />

              <div className="d-flex justify-content-center gap-2 mt-3 small flex-wrap">
                <span><i className="sm-legend-box" style={{ background: "#B0BEC5" }} /> Base 25</span>
                <span><i className="sm-legend-box" style={{ background: "#26C281" }} /> Nova</span>
                <span><i className="sm-legend-box" style={{ background: "#1565C0" }} /> Existente</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-3">
          <ChartPanel
            title="Cidades 5G por Regional (Projeção EoY)"
            subtitle="Clique num regional pra destacar na Raia 2"
            height={340}
            option={citiesAnf ? regionalSunburstOption(citiesAnf, focusedRegional) : {}}
            loading={loadingCitiesAnf}
            onClick={(e) => toggleRegional(e.name)}
            imageFilename="r3-cidades-5g-por-regional.png"
            exportSheet={{
              name: "R3 Cidades por Regional",
              columns: [
                { header: "Regional", key: "regional" },
                { header: "Base 25", key: "base" },
                { header: "Ganho 26", key: "ganho" },
              ],
              rows: (citiesAnf?.categories ?? []).map((regional, i) => ({
                regional,
                base: citiesAnf?.series[0]?.data[i] ?? 0,
                ganho: citiesAnf?.series[1]?.data[i] ?? 0,
              })),
            }}
          />
        </div>

        <div className="col-lg-3">
          <ChartPanel
            title="Fornecedores EoY 26"
            subtitle="Sites físicos · Base 25 existentes + Casa Nova a contratar"
            height={340}
            option={vendorDonutSideOption(vendors ?? [])}
            loading={loadingVendors}
            imageFilename="r3-fornecedores-eoy26.png"
            exportSheet={{
              name: "R3 Fornecedores",
              columns: [
                { header: "Fornecedor", key: "label" },
                { header: "Sites", key: "value" },
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
            imageFilename="r3-top-projetos.png"
            exportSheet={{
              name: "R3 Top Projetos",
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
