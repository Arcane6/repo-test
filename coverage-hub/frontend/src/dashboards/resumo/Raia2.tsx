import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { summaryApi, type SummaryFilters } from "../../api/summary";
import { regionalDonutOption, stackedBarsOption } from "../../charts/optionBuilders";
import { CacPorProjetoTable } from "../../components/CacPorProjetoTable";
import { CacResumoTecnologia } from "../../components/CacResumoTecnologia";
import { ChartPanel } from "../../components/ChartPanel";
import { useResumoFocusStore } from "../../store/resumoFocus";

export function Raia2({ filters }: { filters: SummaryFilters }) {
  const { uf, municipio, ano, regionais, projetos, anfs, popUrbana } = filters;
  const { regional: focusedRegional, toggleRegional } = useResumoFocusStore();

  const { data: citiesAnf, isFetching: loadingCitiesAnf } = useQuery({
    queryKey: ["summary-r2-cities-anf", uf, municipio, ano, regionais, projetos, anfs, popUrbana],
    queryFn: () => summaryApi.r2NewCitiesByAnf(filters),
  });

  const { data: orcamento, isFetching: loadingOrcamento } = useQuery({
    queryKey: ["summary-r2-orcamento", uf, municipio, ano, regionais, projetos, anfs, popUrbana],
    queryFn: () => summaryApi.r2OrcamentoPorTecnologia(filters),
  });

  // Responde a geo/ano (rateio por OC, igual Orçamento por Tecnologia) —
  // o combo de cenário só troca o recorte já baixado, sem request novo.
  const { data: endereco, isFetching: loadingEndereco } = useQuery({
    queryKey: ["summary-r2-endereco", uf, municipio, ano, regionais, projetos, anfs, popUrbana],
    queryFn: () => summaryApi.r2EnderecoPorTecnologia(filters),
  });
  const [cenarioEscolhido, setCenarioEscolhido] = useState<string | null>(null);
  const cenarioAtual = cenarioEscolhido ?? endereco?.cenario_default ?? endereco?.cenarios[0]?.cenario ?? null;
  const enderecoCenario = endereco?.cenarios.find((c) => c.cenario === cenarioAtual);

  // "CAC por Projeto" e o resumo "MBB Evolution + B2B IoT" ao lado
  // compartilham o mesmo cenário selecionado (estado aqui, não em cada
  // componente) — trocar o combo de um atualiza os dois juntos.
  const { data: cac, isLoading: loadingCac } = useQuery({
    queryKey: ["summary-r2-cac-por-projeto"],
    queryFn: () => summaryApi.r2CacPorProjeto(),
  });
  const [cacEscolhido, setCacEscolhido] = useState<string | null>(null);
  const cacCenarioAtual = cacEscolhido ?? cac?.cenario_default ?? cac?.cenarios[0]?.cenario ?? null;
  const cacCenario = cac?.cenarios.find((c) => c.cenario === cacCenarioAtual);

  const valorFmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  return (
    <div className="summary-raia mb-4" style={{ "--raia-color": "#F5C518" } as CSSProperties}>
      <div className="d-flex align-items-center mb-3">
        <span className="raia-badge me-2" style={{ background: "#F5C518", color: "#000" }}>R2</span>
        <h5 className="fw-bold mb-0">Plano 2026</h5>
        <small className="text-muted ms-3">O que planejamos entregar nesse ano</small>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <ChartPanel
            title="Novas Cidades 5G por Regional"
            subtitle="Clique num regional pra filtrar toda a aba"
            sourceTable="REL_CIDADES_PLANEJADO_26"
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

        <div className="col-lg-4">
          <ChartPanel
            title="Endereço por Tecnologia"
            subtitle="Novos endereços no CAC — Casa Nova (CN) x Casa Existente (CE)"
            sourceTable="VW_CAPEX_MASTER_FULL"
            height={340}
            headerExtra={
              <select
                className="form-select form-select-sm mb-1"
                style={{ maxWidth: 220 }}
                value={cenarioAtual ?? ""}
                onChange={(e) => setCenarioEscolhido(e.target.value)}
                aria-label="Cenário do CAC"
                disabled={!endereco?.cenarios.length}
              >
                {(endereco?.cenarios ?? []).map((c) => (
                  <option key={c.cenario} value={c.cenario}>
                    {c.cenario}
                  </option>
                ))}
              </select>
            }
            option={stackedBarsOption(
              enderecoCenario?.categories ?? [],
              enderecoCenario?.series ?? [],
              { valueFormatter: valorFmt, showValueLabels: true, showTotalLabel: true },
            )}
            loading={loadingEndereco}
            imageFilename="r2-endereco-por-tecnologia.png"
            footnote="* Valores estimados via rateio geográfico proporcional — referência: cenário Master (Nexus) selecionado acima."
            exportSheet={{
              name: "R2 Endereço por Tecnologia",
              columns: [
                { header: "Tecnologia", key: "tech" },
                { header: "Casa Nova — CN (R$ mi)", key: "cn" },
                { header: "Casa Existente — CE (R$ mi)", key: "ce" },
              ],
              rows: (enderecoCenario?.categories ?? []).map((tech, i) => ({
                tech,
                cn: enderecoCenario?.series[0]?.data[i] ?? 0,
                ce: enderecoCenario?.series[1]?.data[i] ?? 0,
              })),
            }}
          />
        </div>

        <div className="col-lg-4">
          <ChartPanel
            title="Orçamento por Tecnologia"
            subtitle="CAPEX x OPEX/LEASE rateado por OC (R$ milhões)"
            sourceTable="TB_NEXUS_FINANCEIRO"
            height={340}
            option={stackedBarsOption(
              orcamento?.categories ?? [],
              orcamento?.series ?? [],
              { valueFormatter: valorFmt, showValueLabels: true, showTotalLabel: true },
            )}
            loading={loadingOrcamento}
            imageFilename="r2-orcamento-por-tecnologia.png"
            footnote="* Valores por município estimados a partir da estratificação do Rollout de Acesso (referência: Data do arquivo de rollout)."
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

        {/* Resumo CAPEX+Layers (compacto, à esquerda) + CAC por Projeto
            (detalhe por segmento/projeto, encurtado e jogado à direita) —
            os dois no mesmo cenário selecionado (estado acima). */}
        <div className="col-lg-4">
          <CacResumoTecnologia cenario={cacCenario} isLoading={loadingCac} />
        </div>
        <div className="col-lg-8">
          <CacPorProjetoTable
            cenarios={cac?.cenarios ?? []}
            cenarioAtual={cacCenarioAtual}
            cenario={cacCenario}
            onChangeCenario={setCacEscolhido}
            isLoading={loadingCac}
          />
        </div>
      </div>
    </div>
  );
}
