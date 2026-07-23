import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { summaryApi, type SummaryFilters } from "../../api/summary";
import { horizontalBarsOption, regionalSunburstOption, vendorDonutSideOption } from "../../charts/optionBuilders";
import { ChartPanel } from "../../components/ChartPanel";
import { useResumoFocusStore } from "../../store/resumoFocus";

/** Fonte do nº de "Casa Nova a contratar" no donut de fornecedores:
 *  - rollout: TB_ROLLOUT_ACESSO deduplicado por endereço (responde aos filtros)
 *  - nexus:   meta TB_NEXUS_CN_CE (755 CN 4G + 245 CN 5G = 1000; NACIONAL,
 *             não recorta por UF/regional — por isso o aviso no subtítulo) */
type CasaNovaFonte = "rollout" | "nexus";

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

  const [cnFonte, setCnFonte] = useState<CasaNovaFonte>("rollout");
  const { data: cnNexus } = useQuery({
    queryKey: ["summary-r2-casa-nova-nexus"],
    queryFn: () => summaryApi.r2CasaNovaNexus(),
  });

  // Com a fonte NEXUS, o valor da fatia "A Contratar" vira a meta nacional
  // (o resto do donut — Base 25 por vendor — não muda de fonte).
  const vendorSlices = (vendors ?? []).map((v) =>
    cnFonte === "nexus" && v.label.toUpperCase().includes("A CONTRATAR") && cnNexus
      ? { ...v, value: cnNexus.total }
      : v,
  );

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
            sourceTable={["MUNICIPIOS_FECHAMENTO", "REL_CIDADES_PLANEJADO_26"]}
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
            subtitle={
              cnFonte === "rollout"
                ? "Sites físicos · Base 25 + Casa Nova (endereços únicos do rollout)"
                : "Sites físicos · Base 25 + Casa Nova (meta NEXUS — nacional, não filtra)"
            }
            sourceTable={
              cnFonte === "rollout"
                ? ["BASE_TB_END_ID_NEW", "TB_ROLLOUT_ACESSO"]
                : ["BASE_TB_END_ID_NEW", "TB_NEXUS_CN_CE"]
            }
            height={340}
            headerExtra={
              <div className="btn-group btn-group-sm mb-1" role="group" aria-label="Fonte do nº de Casa Nova">
                <button
                  type="button"
                  className={`btn ${cnFonte === "rollout" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setCnFonte("rollout")}
                  title="Endereços únicos do plano (TB_ROLLOUT_ACESSO, deduplicado) — responde aos filtros"
                >
                  Rollout
                </button>
                <button
                  type="button"
                  className={`btn ${cnFonte === "nexus" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setCnFonte("nexus")}
                  title="Meta NEXUS (TB_NEXUS_CN_CE) — nacional, não recorta por filtro"
                >
                  Meta NEXUS
                </button>
              </div>
            }
            option={vendorDonutSideOption(vendorSlices)}
            loading={loadingVendors}
            imageFilename="r3-fornecedores-eoy26.png"
            exportSheet={{
              name: "R3 Fornecedores",
              columns: [
                { header: "Fornecedor", key: "label" },
                { header: "Sites", key: "value" },
              ],
              rows: vendorSlices,
            }}
          />
        </div>
      </div>
    </div>
  );
}
