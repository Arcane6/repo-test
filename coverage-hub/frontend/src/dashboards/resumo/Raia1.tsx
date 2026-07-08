import { useQuery } from "@tanstack/react-query";
import { summaryApi, type SummaryFilters } from "../../api/summary";
import { barsByTechOption, horizontalBarsOption } from "../../charts/optionBuilders";
import { ChartPanel } from "../../components/ChartPanel";
import { useResumoFocusStore } from "../../store/resumoFocus";

export function Raia1({ filters }: { filters: SummaryFilters }) {
  const { uf, municipio, ano } = filters;
  const { tecnologia: focusedTec, toggleTecnologia } = useResumoFocusStore();

  const { data: sites, isFetching: loadingSites } = useQuery({
    queryKey: ["summary-r1-sites", uf, municipio, ano],
    queryFn: () => summaryApi.r1SitesByTech(filters),
  });

  const { data: cities, isFetching: loadingCities } = useQuery({
    queryKey: ["summary-r1-cities", uf, municipio, ano],
    queryFn: () => summaryApi.r1CitiesByTech(filters),
  });

  const { data: vendors, isFetching: loadingVendors } = useQuery({
    queryKey: ["summary-r1-vendors", uf, municipio, ano],
    queryFn: () => summaryApi.r1Vendors(filters),
  });

  return (
    <div className="summary-raia mb-4">
      <div className="d-flex align-items-center mb-3">
        <span className="raia-badge me-2" style={{ background: "#003399" }}>R1</span>
        <h5 className="fw-bold mb-0">Fechamento 25</h5>
        <small className="text-muted ms-3">Rede consolidada até 31/dez do ano anterior</small>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <ChartPanel
            title="Total de Sites por Tecnologia"
            subtitle="Clique numa barra pra destacar a tecnologia nas outras raias"
            option={barsByTechOption(sites?.bars ?? [], sites?.total ?? 0, focusedTec)}
            loading={loadingSites}
            onClick={(e) => toggleTecnologia(e.name)}
            imageFilename="r1-sites-por-tecnologia.png"
            exportSheet={{
              name: "R1 Sites por Tecnologia",
              columns: [
                { header: "Tecnologia", key: "tec" },
                { header: "Sites", key: "value" },
              ],
              rows: sites?.bars ?? [],
            }}
          />
        </div>
        <div className="col-lg-4">
          <ChartPanel
            title="Cidades Cobertas por Tecnologia"
            subtitle="Clique numa barra pra destacar a tecnologia nas outras raias"
            option={barsByTechOption(cities?.bars ?? [], cities?.total ?? 0, focusedTec)}
            loading={loadingCities}
            onClick={(e) => toggleTecnologia(e.name)}
            imageFilename="r1-cidades-por-tecnologia.png"
            exportSheet={{
              name: "R1 Cidades por Tecnologia",
              columns: [
                { header: "Tecnologia", key: "tec" },
                { header: "Cidades", key: "value" },
              ],
              rows: cities?.bars ?? [],
            }}
          />
        </div>
        <div className="col-lg-4">
          <ChartPanel
            title="Fornecedor por Site"
            option={horizontalBarsOption(
              (vendors ?? []).map((v) => ({ name: v.label, value: v.value, color: v.color })),
            )}
            loading={loadingVendors}
            imageFilename="r1-fornecedor-por-site.png"
            exportSheet={{
              name: "R1 Fornecedores",
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
