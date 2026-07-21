import { useEffect } from "react";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import { useQuery } from "@tanstack/react-query";
import { mobileAccessApi } from "../api/mobileAccess";
import { summaryApi } from "../api/summary";
import { useFilterStore } from "../store/filters";
import { TECH_ORDER } from "../theme";
import { themedSelectStyles } from "./selectStyles";

const tecOptions = TECH_ORDER.map((t) => ({ value: t, label: t }));

export type FilterField = "uf" | "municipio" | "tecnologia" | "ano";

interface FilterBarProps {
  /** Quais seletores mostrar — cada dashboard usa só os filtros que faz sentido. */
  fields: FilterField[];
}

export function FilterBar({ fields }: FilterBarProps) {
  const { uf, municipio, tecnologia, ano, setValues, setAno, clear } = useFilterStore();
  const multiStyles = themedSelectStyles<{ value: string; label: string }, true>();
  const singleStyles = themedSelectStyles<{ value: string; label: string }, false>();

  const { data: ufOptions = [] } = useQuery({
    queryKey: ["actual-ufs"],
    queryFn: mobileAccessApi.ufs,
  });

  const { data: anos = [] } = useQuery({
    queryKey: ["summary-years"],
    queryFn: summaryApi.years,
    enabled: fields.includes("ano"),
  });

  useEffect(() => {
    if (fields.includes("ano") && !ano && anos.length > 0) {
      setAno(String(anos[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anos]);

  const loadMunicipios = async (input: string) => {
    const rows = await mobileAccessApi.municipiosSearch(input, uf);
    return rows.map((r) => ({ value: r.municipio, label: `${r.municipio} (${r.uf})` }));
  };

  const colSize = 12 / (fields.length + 1);

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-body">
        <div className="row g-3 align-items-end">
          {fields.includes("uf") && (
            <div className="col-md" style={{ flexBasis: 0, flexGrow: colSize }}>
              <label className="form-label fw-bold small">UF</label>
              <Select
                isMulti
                styles={multiStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                placeholder="Todas as UFs"
                options={ufOptions.map((u) => ({ value: u, label: u }))}
                value={uf.map((u) => ({ value: u, label: u }))}
                onChange={(selected) => setValues("uf", selected.map((s) => s.value))}
              />
            </div>
          )}

          {fields.includes("municipio") && (
            <div className="col-md" style={{ flexBasis: 0, flexGrow: colSize }}>
              <label className="form-label fw-bold small">Município</label>
              <AsyncSelect
                isMulti
                styles={multiStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                placeholder="Digite um município..."
                loadOptions={loadMunicipios}
                value={municipio.map((m) => ({ value: m, label: m }))}
                onChange={(selected) =>
                  setValues(
                    "municipio",
                    selected.map((s) => s.value),
                  )
                }
              />
            </div>
          )}

          {fields.includes("tecnologia") && (
            <div className="col-md" style={{ flexBasis: 0, flexGrow: colSize }}>
              <label className="form-label fw-bold small">Tecnologia</label>
              <Select
                isMulti
                styles={multiStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
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
          )}

          {fields.includes("ano") && (
            <div className="col-md" style={{ flexBasis: 0, flexGrow: colSize }}>
              <label className="form-label fw-bold small">Ano</label>
              <Select
                styles={singleStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                placeholder="Ano"
                options={anos.map((a) => ({ value: String(a), label: String(a) }))}
                value={ano ? { value: ano, label: ano } : null}
                onChange={(selected) => setAno(selected?.value ?? null)}
              />
            </div>
          )}

          <div className="col-md-auto d-flex justify-content-end">
            <button className="btn btn-sm btn-outline-secondary" onClick={clear}>
              <i className="bi bi-x-lg" /> Limpar filtros
            </button>
          </div>
        </div>

        {fields.includes("tecnologia") && tecnologia.length > 0 && (
          <div className="small text-muted mt-2">
            <i className="bi bi-info-circle me-1" />
            Filtro de tecnologia aplicado via clique no gráfico de frequências
            também aparece aqui — os dois estão sincronizados.
          </div>
        )}
      </div>
    </div>
  );
}
