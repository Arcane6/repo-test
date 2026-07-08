import Select from "react-select";
import { useQuery } from "@tanstack/react-query";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";
import { TECH_ORDER } from "../theme";

const tecOptions = TECH_ORDER.map((t) => ({ value: t, label: t }));

export function FilterBar() {
  const { uf, tecnologia, setValues, clear } = useFilterStore();

  const { data: ufOptions = [] } = useQuery({
    queryKey: ["actual-ufs"],
    queryFn: mobileAccessApi.ufs,
  });

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-body">
        <div className="row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label fw-bold small">UF</label>
            <Select
              isMulti
              placeholder="Todas as UFs"
              options={ufOptions.map((u) => ({ value: u, label: u }))}
              value={uf.map((u) => ({ value: u, label: u }))}
              onChange={(selected) =>
                setValues(
                  "uf",
                  selected.map((s) => s.value),
                )
              }
            />
          </div>

          <div className="col-md-4">
            <label className="form-label fw-bold small">Tecnologia</label>
            <Select
              isMulti
              placeholder="Todas as tecnologias"
              options={tecOptions}
              value={tecnologia.map((t) => ({ value: t, label: t }))}
              onChange={(selected) =>
                setValues(
                  "tecnologia",
                  selected.map((s) => s.value),
                )
              }
            />
          </div>

          <div className="col-md-4 d-flex justify-content-end">
            <button className="btn btn-sm btn-outline-secondary" onClick={clear}>
              <i className="bi bi-x-lg" /> Limpar filtros
            </button>
          </div>
        </div>

        {tecnologia.length > 0 && (
          <div className="small text-muted mt-2">
            <i className="bi bi-info-circle me-1" />
            Filtro de tecnologia aplicado via clique no gráfico de
            frequências também aparece aqui — os dois estão sincronizados.
          </div>
        )}
      </div>
    </div>
  );
}
