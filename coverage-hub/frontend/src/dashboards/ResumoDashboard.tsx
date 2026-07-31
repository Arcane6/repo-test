import { FilterBar } from "../components/FilterBar";
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
      <Raia2 filters={filters} />
      <Raia3 filters={filters} />
    </div>
  );
}
