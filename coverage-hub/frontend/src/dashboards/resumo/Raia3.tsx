import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { summaryApi, type EnderecoPorTecnologiaCenario, type SummaryFilters } from "../../api/summary";
import { regionalSunburstOption, vendorDonutSideOption } from "../../charts/optionBuilders";
import { ChartPanel } from "../../components/ChartPanel";
import { useResumoFocusStore } from "../../store/resumoFocus";

/** Fonte do nº de "Casa Nova a contratar" no donut de fornecedores:
 *  - rollout: TB_ROLLOUT_ACESSO deduplicado por endereço (responde aos filtros)
 *  - nexus:   soma das células "CN" (Casa Nova) de "Endereço por Tecnologia"
 *             (4G + 5G) — MESMA base (VW_CAPEX_MASTER_FULL) e MESMO cenário
 *             selecionado naquele card (ver ResumoDashboard.tsx). Antes vinha
 *             de TB_NEXUS_CN_CE, uma base fixa sem cenário — trocado a
 *             pedido do usuário (ago/26) pra sempre bater com "Endereço por
 *             Tecnologia". */
type CasaNovaFonte = "rollout" | "nexus";

interface Raia3Props {
  filters: SummaryFilters;
  enderecoCenario?: EnderecoPorTecnologiaCenario;
}

export function Raia3({ filters, enderecoCenario }: Raia3Props) {
  const { uf, municipio, ano, regionais, projetos, anfs, popUrbana } = filters;
  const { regional: focusedRegional, toggleRegional } = useResumoFocusStore();

  const { data: citiesAnf, isFetching: loadingCitiesAnf } = useQuery({
    queryKey: ["summary-r3-cities-anf", uf, municipio, ano, regionais, anfs, popUrbana],
    queryFn: () => summaryApi.r3NewCitiesByAnf(filters),
  });

  const { data: vendors, isFetching: loadingVendors } = useQuery({
    queryKey: ["summary-r3-vendors", uf, municipio, ano, regionais, projetos, anfs, popUrbana],
    queryFn: () => summaryApi.r3Vendors(filters),
  });

  const [cnFonte, setCnFonte] = useState<CasaNovaFonte>("rollout");
  const metaNexusCn = (enderecoCenario?.series.find((s) => s.name === "CN")?.data ?? []).reduce(
    (sum, v) => sum + v,
    0,
  );

  // Com a fonte NEXUS, o valor da fatia "A Contratar" vira a meta do
  // cenário selecionado (o resto do donut — Base 25 por vendor — não
  // muda de fonte).
  const vendorSlices = (vendors ?? []).map((v) =>
    cnFonte === "nexus" && v.label.toUpperCase().includes("A CONTRATAR") && enderecoCenario
      ? { ...v, value: metaNexusCn }
      : v,
  );

  return (
    <div className="summary-raia mb-4" style={{ "--raia-color": "#7DC242" } as CSSProperties}>
      <div className="d-flex align-items-center mb-3">
        <span className="raia-badge me-2" style={{ background: "#7DC242" }}>R3</span>
        <h5 className="fw-bold mb-0">Fechamento 2026 (Projeção)</h5>
        <small className="text-muted ms-3">Baseline + Plano — como vamos fechar o ano</small>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <ChartPanel
            title="Cidades 5G por Regional"
            subtitle="Clique num regional pra filtrar"
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

        <div className="col-lg-6">
          <ChartPanel
            title="Fornecedores EoY 26"
            subtitle={
              cnFonte === "rollout"
                ? "Sites físicos · Base 25 + Casa Nova (endereços únicos do rollout)"
                : "Sites físicos · Base 25 + Casa Nova (CN de Endereço por Tecnologia, mesmo cenário)"
            }
            sourceTable={
              cnFonte === "rollout"
                ? ["BASE_TB_END_ID_NEW", "TB_ROLLOUT_ACESSO"]
                : ["BASE_TB_END_ID_NEW", "VW_CAPEX_MASTER_FULL"]
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
                  title="Casa Nova (CN) de 'Endereço por Tecnologia' — mesma base e cenário daquele card, 4G+5G somados"
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
