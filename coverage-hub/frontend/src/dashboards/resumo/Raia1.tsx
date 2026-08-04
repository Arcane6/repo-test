import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import Select from "react-select";
import { summaryApi, type SummaryFilters } from "../../api/summary";
import { barsByTechOption, siteHierarchyTreeOption, vendorDonutSideOption } from "../../charts/optionBuilders";
import { ChartPanel } from "../../components/ChartPanel";
import { SitesComboChart } from "../../components/SitesComboChart";
import { themedSelectStyles } from "../../components/selectStyles";
import { useResumoFocusStore } from "../../store/resumoFocus";
import { TECH_ORDER } from "../../theme";

const tecOptions = TECH_ORDER.map((t) => ({ value: t, label: t }));

// Raia "Fechamento 2025": referência sempre mostrada como 12/2025,
// mesmo que o MAX(DT_CARGA)/MES_REF real da tabela já tenha avançado
// (carga contínua) — o fechamento em si é sempre o snapshot de
// 31/dez/2025, então a data "de verdade" mais recente confundiria o
// leitor sobre qual recorte está na tela (jul/26, pedido do usuário).
const FECHAMENTO_25_REF = "12/2025";

export function Raia1({ filters }: { filters: SummaryFilters }) {
  const { uf, municipio, ano, regionais, anfs, popUrbana } = filters;
  const { tecnologia: focusedTec, toggleTecnologia } = useResumoFocusStore();
  // Filtro local, só deste card — Resumo não tem filtro global de
  // tecnologia (ver CLAUDE.md), mas o usuário pediu especificamente aqui.
  const [vendorTecs, setVendorTecs] = useState<string[]>([]);
  const vendorFilters = { ...filters, tecs: vendorTecs };
  const multiStyles = themedSelectStyles<{ value: string; label: string }, true>();

  const { data: cities, isFetching: loadingCities } = useQuery({
    queryKey: ["summary-r1-cities", uf, municipio, ano, regionais, anfs, popUrbana],
    queryFn: () => summaryApi.r1CitiesByTech(filters),
  });

  const { data: vendors, isFetching: loadingVendors } = useQuery({
    queryKey: ["summary-r1-vendors", uf, municipio, ano, regionais, anfs, popUrbana, vendorTecs],
    queryFn: () => summaryApi.r1Vendors(vendorFilters),
  });

  const { data: hierarchy, isFetching: loadingHierarchy } = useQuery({
    queryKey: ["summary-r1-sites-hierarchy", uf, municipio, ano, regionais, anfs, popUrbana],
    queryFn: () => summaryApi.r1SitesHierarchy(filters),
  });

  return (
    <div className="summary-raia mb-4" style={{ "--raia-color": "#003399" } as CSSProperties}>
      <div className="d-flex align-items-center mb-3">
        <span className="raia-badge me-2" style={{ background: "#003399" }}>R1</span>
        <h5 className="fw-bold mb-0">Fechamento 2025</h5>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <ChartPanel
            title="Cidades Cobertas por Tecnologia"
            sourceTable="MUNICIPIOS_FECHAMENTO"
            sourceStaticRef={FECHAMENTO_25_REF}
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
          <SitesComboChart filters={filters} />
        </div>
        <div className="col-lg-4">
          <ChartPanel
            title="Mobile Sites por Fornecedor"
            sourceTable="BASE_TB_END_ID_NEW"
            sourceStaticRef={FECHAMENTO_25_REF}
            height={340}
            headerExtra={
              <Select
                isMulti
                styles={multiStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                placeholder="Todas as tecnologias"
                options={tecOptions}
                value={vendorTecs.map((t) => ({ value: t, label: t }))}
                onChange={(selected) => setVendorTecs(selected.map((s) => s.value))}
                className="mb-1"
              />
            }
            option={vendorDonutSideOption(vendors ?? [])}
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
        <div className="col-12">
          <ChartPanel
            title="Total de sites ativos"
            subtitle="Da base completa de Sites Ativos aos Sites utilizado nos gráficos acima."
            sourceTable="TB_FT_BASE_UNICA_SITES"
            sourceStaticRef={FECHAMENTO_25_REF}
            height={280}
            option={siteHierarchyTreeOption(hierarchy)}
            loading={loadingHierarchy}
            imageFilename="r1-composicao-de-sites.png"
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
              name: "R1 Composição de Sites",
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
    </div>
  );
}
