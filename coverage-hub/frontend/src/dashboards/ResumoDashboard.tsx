import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FilterBar } from "../components/FilterBar";
import { summaryApi } from "../api/summary";
import { useFilterStore } from "../store/filters";
import { useResumoFocusStore } from "../store/resumoFocus";
import { Raia1 } from "./resumo/Raia1";
import { Raia2 } from "./resumo/Raia2";
import { Raia3 } from "./resumo/Raia3";

export function ResumoDashboard() {
  const { uf, municipio, ano, regional, anf, popUrbana } = useFilterStore();
  const {
    tecnologia: focusedTec,
    regional: focusedRegional,
    projeto: focusedProjeto,
    clear: clearFocus,
  } = useResumoFocusStore();
  const filters = {
    uf,
    municipio,
    ano,
    // Clique num regional (cross-filter da própria Raia) tem prioridade
    // sobre o filtro global da FilterBar — mesma semântica de antes, só
    // com o filtro global como fallback quando não há destaque ativo.
    regionais: focusedRegional ? [focusedRegional] : regional,
    projetos: focusedProjeto ? [focusedProjeto] : [],
    anfs: anf,
    popUrbana,
  };
  const hasFocus = Boolean(focusedTec || focusedRegional || focusedProjeto);

  // "Endereço por Tecnologia" (card na Raia 2) e a fonte "Meta NEXUS" do
  // donut "Fornecedores EoY 26" (Raia 3) usam a MESMA base (VW_CAPEX_
  // MASTER_FULL) e o MESMO cenário selecionado — pedido do usuário
  // (ago/26): a Meta NEXUS estava presa numa base antiga (TB_NEXUS_CN_CE,
  // fixa, sem cenário) e devia acompanhar o que "Endereço por Tecnologia"
  // já mostra, só filtrando pra Casa Nova (CN). Estado subido pro
  // dashboard (não em cada raia) pra sincronizar as duas.
  const { data: endereco, isFetching: loadingEndereco } = useQuery({
    queryKey: [
      "summary-r2-endereco",
      filters.uf, filters.municipio, filters.ano, filters.regionais,
      filters.projetos, filters.anfs, filters.popUrbana,
    ],
    queryFn: () => summaryApi.r2EnderecoPorTecnologia(filters),
  });
  const [cenarioEscolhido, setCenarioEscolhido] = useState<string | null>(null);
  const cenarioAtual = cenarioEscolhido ?? endereco?.cenario_default ?? endereco?.cenarios[0]?.cenario ?? null;
  const enderecoCenario = endereco?.cenarios.find((c) => c.cenario === cenarioAtual);

  return (
    <div className="tim-page-enter">
      <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <span className="tim-eyebrow">Resumo executivo</span>
        {hasFocus && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearFocus}>
            <i className="bi bi-x-lg" /> Limpar destaque
            {focusedTec && <span className="badge bg-secondary ms-2">{focusedTec}</span>}
            {focusedRegional && <span className="badge bg-secondary ms-2">{focusedRegional}</span>}
            {focusedProjeto && <span className="badge bg-secondary ms-2">{focusedProjeto}</span>}
          </button>
        )}
      </div>

      <FilterBar fields={["uf", "municipio", "regional", "anf", "populacaoUrbana"]} />

      <Raia1 filters={filters} />
      <Raia2
        filters={filters}
        endereco={endereco}
        loadingEndereco={loadingEndereco}
        cenarioAtual={cenarioAtual}
        enderecoCenario={enderecoCenario}
        onChangeCenario={setCenarioEscolhido}
      />
      <Raia3 filters={filters} enderecoCenario={enderecoCenario} />
    </div>
  );
}
