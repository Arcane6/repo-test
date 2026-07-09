import { useQuery } from "@tanstack/react-query";
import { summaryApi, type SummaryFilters } from "../../api/summary";
import { horizontalBarsOption, regionalDonutOption, stackedBarsOption, vendorDonutSideOption } from "../../charts/optionBuilders";
import { ChartPanel } from "../../components/ChartPanel";
import { useResumoFocusStore } from "../../store/resumoFocus";

export function Raia2({ filters }: { filters: SummaryFilters }) {
  const { uf, municipio, ano, regionais, projetos } = filters;
  const {
    regional: focusedRegional,
    projeto: focusedProjeto,
    toggleRegional,
    toggleProjeto,
  } = useResumoFocusStore();

  const { data: citiesAnf, isFetching: loadingCitiesAnf } = useQuery({
    queryKey: ["summary-r2-cities-anf", uf, municipio, ano, regionais, projetos],
    queryFn: () => summaryApi.r2NewCitiesByAnf(filters),
  });

  const { data: orcamento, isFetching: loadingOrcamento } = useQuery({
    queryKey: ["summary-r2-orcamento", uf, municipio, ano, regionais, projetos],
    queryFn: () => summaryApi.r2OrcamentoPorTecnologia(filters),
  });

  const { data: endereco, isFetching: loadingEndereco } = useQuery({
    queryKey: ["summary-r2-endereco", uf, municipio, ano, regionais, projetos],
    queryFn: () => summaryApi.r2EnderecoPorTecnologia(filters),
  });

  const { data: vendorsNexus, isFetching: loadingVendorsNexus } = useQuery({
    queryKey: ["summary-r2-vendors-nexus", uf, municipio, ano, regionais, projetos],
    queryFn: () => summaryApi.r2VendorsNexus(filters),
  });

  const { data: projects, isFetching: loadingProjects } = useQuery({
    queryKey: ["summary-r2-projects", uf, municipio, ano, regionais, projetos],
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
          <ChartPanel
            title="Novas Cidades por Regional"
            subtitle="Clique num regional pra filtrar toda a aba"
            sourceTable="MUNICIPIOS_FECHAMENTO"
            height={340}
            option={regionalDonutOption(citiesAnf?.slices ?? [], "Novas cidades", focusedRegional)}
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
            title="Orçamento por Tecnologia"
            subtitle="CAPEX x OPEX/LEASE rateado por OC (R$ milhões)"
            sourceTable={["TB_ROLLOUT_ACESSO", "TB_NEXUS_FINANCEIRO"]}
            height={340}
            option={stackedBarsOption(
              orcamento?.categories ?? [],
              orcamento?.series ?? [],
              { valueFormatter: (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) },
            )}
            loading={loadingOrcamento}
            imageFilename="r2-orcamento-por-tecnologia.png"
            exportSheet={{
              name: "R2 Orçamento por Tecnologia",
              columns: [
                { header: "Tecnologia", key: "tech" },
                { header: "CAPEX (R$ mi)", key: "capex" },
                { header: "OPEX/LEASE (R$ mi)", key: "opex" },
              ],
              rows: (orcamento?.categories ?? []).map((tech, i) => ({
                tech,
                capex: orcamento?.series[0]?.data[i] ?? 0,
                opex: orcamento?.series[1]?.data[i] ?? 0,
              })),
            }}
          />
        </div>

        <div className="col-lg-3">
          <ChartPanel
            title="Endereço por Tecnologia"
            subtitle="CAC rateado por OC — Casa Nova x Casa Existente (R$ milhões)"
            sourceTable={["TB_ROLLOUT_ACESSO", "TB_NEXUS_CN_CE"]}
            height={340}
            option={stackedBarsOption(
              endereco?.categories ?? [],
              endereco?.series ?? [],
              { valueFormatter: (v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) },
            )}
            loading={loadingEndereco}
            imageFilename="r2-endereco-por-tecnologia.png"
            exportSheet={{
              name: "R2 Endereço por Tecnologia",
              columns: [
                { header: "Tecnologia", key: "tech" },
                { header: "Casa Nova (R$ mi)", key: "nova" },
                { header: "Casa Existente (R$ mi)", key: "existente" },
              ],
              rows: (endereco?.categories ?? []).map((tech, i) => ({
                tech,
                nova: endereco?.series[0]?.data[i] ?? 0,
                existente: endereco?.series[1]?.data[i] ?? 0,
              })),
            }}
          />
        </div>

        <div className="col-lg-3">
          <ChartPanel
            title="OCs do Plano por Fornecedor"
            subtitle="Ponderado pelo CAC do NEXUS (R$) — mesmo rateio do Endereço por Tecnologia"
            sourceTable={["TB_ROLLOUT_ACESSO", "TB_NEXUS_CN_CE"]}
            height={340}
            option={vendorDonutSideOption(vendorsNexus ?? [])}
            loading={loadingVendorsNexus}
            imageFilename="r2-ocs-por-fornecedor.png"
            exportSheet={{
              name: "R2 Fornecedores (NEXUS)",
              columns: [
                { header: "Fornecedor", key: "label" },
                { header: "R$ milhões", key: "value" },
              ],
              rows: vendorsNexus ?? [],
            }}
          />
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <ChartPanel
            title="Top 10 Projetos"
            subtitle="Clique num projeto pra filtrar toda a aba"
            sourceTable="TB_ROLLOUT_ACESSO"
            height={320}
            option={horizontalBarsOption((projects ?? []).map((p) => ({ name: p.projeto, value: p.value })))}
            loading={loadingProjects}
            onClick={(e) => toggleProjeto(e.name)}
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
          {focusedProjeto && (
            <small className="text-muted d-block mt-1">
              Filtrando toda a aba pelo projeto <b>{focusedProjeto}</b>
            </small>
          )}
        </div>
      </div>
    </div>
  );
}
