import { FilterBar } from "../components/FilterBar";
import { useFilterStore } from "../store/filters";
import { Raia1 } from "./resumo/Raia1";
import { Raia2 } from "./resumo/Raia2";
import { Raia3 } from "./resumo/Raia3";

export function ResumoDashboard() {
  const { uf, municipio, ano } = useFilterStore();
  const filters = { uf, municipio, ano };

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Resumo</h4>
        <small className="text-muted">Visão executiva: fechamento 25, plano 26 e projeção EoY 26</small>
      </div>

      <FilterBar fields={["uf", "municipio", "ano"]} />

      <Raia1 filters={filters} />
      <Raia2 filters={filters} />
      <Raia3 filters={filters} />
    </div>
  );
}
