import { useQuery } from "@tanstack/react-query";
import { FilterBar } from "../components/FilterBar";
import { ChartPanel } from "../components/ChartPanel";
import { SitesPivotTable } from "../components/SitesPivotTable";
import { SitesMap } from "../components/SitesMap";
import { barsByTechOption, donutOption, vendorDonutSideOption } from "../charts/optionBuilders";
import { sitesApi } from "../api/sites";
import { useFilterStore } from "../store/filters";

export function SitesDashboard() {
  const { uf, municipio } = useFilterStore();
  const filters = { uf, municipio };

  const { data: maxTech, isFetching: loadingMaxTech } = useQuery({
    queryKey: ["sites-by-max-tech", uf, municipio],
    queryFn: () => sitesApi.byMaxTech(filters),
  });

  const { data: byTec, isFetching: loadingByTec } = useQuery({
    queryKey: ["sites-by-tecnologia", uf, municipio],
    queryFn: () => sitesApi.byTecnologia(filters),
  });

  const { data: vendors, isFetching: loadingVendors } = useQuery({
    queryKey: ["sites-vendors", uf, municipio],
    queryFn: () => sitesApi.vendors(filters),
  });

  const { data: tipo, isFetching: loadingTipo } = useQuery({
    queryKey: ["sites-tipo", uf, municipio],
    queryFn: () => sitesApi.tipo(filters),
  });

  const tipoItems = tipo
    ? [
        { label: "Móvel · TX Profile", value: tipo.mobile_tx, color: "#003399" },
        { label: "Móvel · sem TX Profile", value: tipo.mobile_no_tx, color: "#7d9cff" },
        { label: "Não-móvel · TX Profile", value: tipo.nonmobile_tx, color: "#6c757d" },
        { label: "Não-móvel · sem TX Profile", value: tipo.nonmobile_no_tx, color: "#c7ccd1" },
      ]
    : [];

  return (
    <div>
      <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <span className="tim-eyebrow">Inventário de sites físicos</span>
      </div>

      <FilterBar fields={["uf", "municipio"]} />

      <div className="row g-3">
        <div className="col-lg-6">
          <ChartPanel
            title="Sites por Tecnologia Máxima"
            subtitle="Cada site conta uma única vez, na tecnologia mais nova que tem (cascata 5G > 4G > 3G > 2G)"
            sourceTable="TB_FT_BASE_UNICA_SITES"
            option={barsByTechOption(maxTech?.bars ?? [], maxTech?.total ?? 0)}
            loading={loadingMaxTech}
            imageFilename="sites-por-tecnologia-maxima.png"
            exportSheet={{
              name: "Sites por Tecnologia Máxima",
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
          <SitesMap filters={filters} />
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-6">
          <ChartPanel
            title="Fornecedor Dominante por Site"
            subtitle="Cascata por banda (maior primeiro) dentro de cada tecnologia — mesma fonte e regra do 'Fornecedor por Site' do Resumo"
            sourceTable="BASE_TB_END_ID_NEW"
            height={280}
            option={vendorDonutSideOption(vendors ?? [])}
            loading={loadingVendors}
            imageFilename="sites-fornecedor-dominante.png"
            exportSheet={{
              name: "Sites por Fornecedor",
              columns: [
                { header: "Fornecedor", key: "label" },
                { header: "Sites", key: "value" },
              ],
              rows: vendors ?? [],
            }}
          />
        </div>

        <div className="col-lg-6">
          <ChartPanel
            title="Tipo de Site"
            subtitle="Site móvel × perfil de transmissão configurado (TX Profile) — inclui site não-móvel, universo diferente das outras visões desta aba"
            sourceTable="TB_FT_BASE_UNICA_SITES"
            height={280}
            option={donutOption(tipoItems)}
            loading={loadingTipo}
            imageFilename="sites-tipo-de-site.png"
            exportSheet={{
              name: "Tipo de Site",
              columns: [
                { header: "Categoria", key: "label" },
                { header: "Sites", key: "value" },
              ],
              rows: tipoItems,
            }}
          />
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
