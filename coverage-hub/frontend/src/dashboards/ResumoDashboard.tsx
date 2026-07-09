import { FilterBar } from "../components/FilterBar";
import { useFilterStore } from "../store/filters";
import { useResumoFocusStore } from "../store/resumoFocus";
import { Raia1 } from "./resumo/Raia1";
import { Raia2 } from "./resumo/Raia2";
import { Raia3 } from "./resumo/Raia3";

export function ResumoDashboard() {
  const { uf, municipio, ano } = useFilterStore();
  const filters = { uf, municipio, ano };
  const { tecnologia: focusedTec, regional: focusedRegional, clear: clearFocus } = useResumoFocusStore();
  const hasFocus = Boolean(focusedTec || focusedRegional);

  return (
    <div>
      <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <p className="text-muted mb-0">Visão executiva: fechamento 25, plano 26 e projeção EoY 26</p>
        {hasFocus && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearFocus}>
            <i className="bi bi-x-lg" /> Limpar destaque
            {focusedTec && <span className="badge bg-secondary ms-2">{focusedTec}</span>}
            {focusedRegional && <span className="badge bg-secondary ms-2">{focusedRegional}</span>}
          </button>
        )}
      </div>

      <FilterBar fields={["uf", "municipio", "ano"]} />

      <Raia1 filters={filters} />
      <Raia2 filters={filters} />
      <Raia3 filters={filters} />
    </div>
  );
}
