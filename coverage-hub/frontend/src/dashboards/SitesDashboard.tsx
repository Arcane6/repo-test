import { useQuery } from "@tanstack/react-query";
import { FilterBar } from "../components/FilterBar";
import { ChartPanel } from "../components/ChartPanel";
import { SitesPivotTable } from "../components/SitesPivotTable";
import { SitesMap } from "../components/SitesMap";
import { barsByTechOption, siteHierarchyTreeOption } from "../charts/optionBuilders";
import { sitesApi } from "../api/sites";
import { useFilterStore } from "../store/filters";

const fmt = (v: number) => v.toLocaleString("pt-BR");

export function SitesDashboard() {
  const { uf, municipio, regional, anf, popUrbana } = useFilterStore();
  const filters = { uf, municipio, regionais: regional, anfs: anf, popUrbana };

  const { data: maxTech, isFetching: loadingMaxTech } = useQuery({
    queryKey: ["sites-by-max-tech", uf, municipio, regional, anf, popUrbana],
    queryFn: () => sitesApi.byMaxTech(filters),
  });

  const { data: byTec, isFetching: loadingByTec } = useQuery({
    queryKey: ["sites-by-tecnologia", uf, municipio, regional, anf, popUrbana],
    queryFn: () => sitesApi.byTecnologia(filters),
  });

  const { data: hierarchy, isFetching: loadingHierarchy } = useQuery({
    queryKey: ["sites-hierarchy", uf, municipio, regional, anf, popUrbana],
    queryFn: () => sitesApi.hierarchy(filters),
  });

  return (
    <div className="tim-page-enter">
      <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <span className="tim-eyebrow">Inventário de sites físicos</span>
      </div>

      <FilterBar fields={["uf", "municipio", "regional", "anf", "populacaoUrbana"]} />

      <div className="row g-3">
        <div className="col-lg-6">
          <ChartPanel
            title="Sites por melhor Tecnologia"
            subtitle={`Cada site conta apenas na melhor tecnologia que tem (5G > 4G > 3G > 2G) · Total: ${fmt(maxTech?.total ?? 0)}`}
            sourceTable="TB_FT_BASE_UNICA_SITES"
            option={barsByTechOption(maxTech?.bars ?? [], maxTech?.total ?? 0)}
            loading={loadingMaxTech}
            imageFilename="sites-por-melhor-tecnologia.png"
            exportSheet={{
              name: "Sites por Melhor Tecnologia",
              columns: [
                { header: "Tecnologia", key: "tec" },
                { header: "Sites", key: "value" },
              ],
              rows: maxTech?.bars ?? [],
            }}
          />
        </div>

        <div className="col-lg-6">
          <ChartPanel
            title="Sites por Tecnologia"
            subtitle="Contagem independente por tecnologia — um site com 2G+4G conta nas duas barras"
            sourceTable="TB_FT_BASE_UNICA_SITES"
            option={barsByTechOption(byTec?.bars ?? [], byTec?.total ?? 0)}
            loading={loadingByTec}
            imageFilename="sites-por-tecnologia.png"
            exportSheet={{
              name: "Sites por Tecnologia",
              columns: [
                { header: "Tecnologia", key: "tec" },
                { header: "Sites", key: "value" },
              ],
              rows: byTec?.bars ?? [],
            }}
          />
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <ChartPanel
            title="Total de sites ativos"
            subtitle="Da base completa de Sites Ativos aos Sites utilizado nos gráficos acima."
            sourceTable="TB_FT_BASE_UNICA_SITES"
            height={280}
            option={siteHierarchyTreeOption(hierarchy)}
            loading={loadingHierarchy}
            imageFilename="sites-composicao-de-sites.png"
            footnote={
              <>
                * Mobile Sites — fonte oficial:{" "}
                <a
                  href="https://app.powerbi.com/groups/me/reports/c377f81a-656f-4458-b7d7-89928a45c7af/ReportSectione82bf651216ff56f09fa?experience=power-bi"
                  target="_blank"
                  rel="noreferrer"
                >
                  Power BI
                </a>
              </>
            }
            exportSheet={{
              name: "Sites Composição",
              columns: [
                { header: "Categoria", key: "label" },
                { header: "Sites", key: "value" },
              ],
              rows: hierarchy
                ? [
                    { label: "Total de Sites Ativos", value: hierarchy.total_ativos },
                    { label: "Total Sites TIM (RF + TX)", value: hierarchy.total_tim_rf_tx },
                    { label: "Sites TX/DC/PI", value: hierarchy.sem_rf },
                    { label: "Mobile Sites", value: hierarchy.mobile_sites },
                    { label: "TIM", value: hierarchy.tim },
                    { label: "Macro", value: hierarchy.macro },
                    { label: "Small Cell + Móvel + SLS", value: hierarchy.small_cell_movel_sls },
                    { label: "Ran Sharing", value: hierarchy.ran_sharing },
                    { label: "Roaming Vivo", value: hierarchy.roaming_vivo },
                  ]
                : [],
            }}
          />
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <SitesMap filters={filters} />
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <SitesPivotTable filters={filters} />
        </div>
      </div>
    </div>
  );
}
