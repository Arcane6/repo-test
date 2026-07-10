import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { summaryApi, type SummaryFilters } from "../../api/summary";
import { horizontalBarsOption, regionalSunburstOption, vendorDonutSideOption } from "../../charts/optionBuilders";
import { ChartPanel } from "../../components/ChartPanel";
import { useResumoFocusStore } from "../../store/resumoFocus";

export function Raia3({ filters }: { filters: SummaryFilters }) {
  const { uf, municipio, ano, regionais, projetos } = filters;
  const {
    regional: focusedRegional,
    toggleRegional,
    toggleProjeto,
  } = useResumoFocusStore();

  const { data: citiesAnf, isFetching: loadingCitiesAnf } = useQuery({
    queryKey: ["summary-r3-cities-anf", uf, municipio, ano, regionais],
    queryFn: () => summaryApi.r3NewCitiesByAnf(filters),
  });

  const { data: vendors, isFetching: loadingVendors } = useQuery({
    queryKey: ["summary-r3-vendors", uf, municipio, ano, regionais, projetos],
    queryFn: () => summaryApi.r3Vendors(filters),
  });

  const { data: projects, isFetching: loadingProjects } = useQuery({
    queryKey: ["summary-r3-projects", uf, municipio, ano, regionais, projetos],
    queryFn: () => summaryApi.r3TopProjects(filters),
  });

  return (
    <div className="summary-raia mb-4" style={{ "--raia-color": "#7DC242" } as CSSProperties}>
      <div className="d-flex align-items-center mb-3">
        <span className="raia-badge me-2" style={{ background: "#7DC242" }}>R3</span>
        <h5 className="fw-bold mb-0">Fechamento 26 (Projeção)</h5>
        <small className="text-muted ms-3">Baseline + Plano — onde vamos fechar o ano</small>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <ChartPanel
            title="Cidades 5G por Regional (Projeção EoY)"
            subtitle="Clique num regional pra filtrar toda a aba"
            sourceTable="MUNICIPIOS_FECHAMENTO"
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

        <div className="col-lg-4">
          <ChartPanel
            title="Top 10 Projetos"
            subtitle="Clique num projeto pra filtrar toda a aba"
            sourceTable="TB_ROLLOUT_ACESSO"
            height={340}
            option={horizontalBarsOption((projects ?? []).map((p) => ({ name: p.projeto, value: p.value })))}
            loading={loadingProjects}
            onClick={(e) => toggleProjeto(e.name)}
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

        <div className="col-lg-4">
          <ChartPanel
            title="Fornecedores EoY 26"
            subtitle="Sites físicos · Base 25 existentes + Casa Nova a contratar"
            sourceTable={["BASE_TB_END_ID_NEW", "TB_ROLLOUT_ACESSO"]}
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
      </div>
    </div>
  );
}
