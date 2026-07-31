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

export type FilterField =
  | "uf"
  | "municipio"
  | "tecnologia"
  | "ano"
  | "regional"
  | "anf"
  | "populacaoUrbana";

interface FilterBarProps {
  /** Quais seletores mostrar — cada dashboard usa só os filtros que faz sentido. */
  fields: FilterField[];
}

export function FilterBar({ fields }: FilterBarProps) {
  const { uf, municipio, tecnologia, regional, anf, popUrbana, ano, setValues, setAno, clear } =
    useFilterStore();
  const multiStyles = themedSelectStyles<{ value: string; label: string }, true>();
  const singleStyles = themedSelectStyles<{ value: string; label: string }, false>();

  const { data: ufOptions = [] } = useQuery({
    queryKey: ["actual-ufs"],
    queryFn: mobileAccessApi.ufs,
  });

  const { data: regionalOptions = [] } = useQuery({
    queryKey: ["actual-regionais"],
    queryFn: mobileAccessApi.regionais,
    enabled: fields.includes("regional"),
  });

  const { data: anfOptions = [] } = useQuery({
    queryKey: ["actual-anfs"],
    queryFn: mobileAccessApi.anfs,
    enabled: fields.includes("anf"),
  });

  const { data: popUrbanaOptions = [] } = useQuery({
    queryKey: ["pop-urbana-buckets"],
    queryFn: mobileAccessApi.popUrbanaBuckets,
    enabled: fields.includes("populacaoUrbana"),
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
                onChange={(selected) => {
                  // Limpa o município selecionado ao trocar de UF: o filtro
                  // guarda só o nome do município (sem a UF de origem), então
                  // uma cidade escolhida antes de mudar a UF podia ficar
                  // presa numa combinação impossível (UF X + município de
                  // outra UF) e zerar tudo em silêncio.
                  setValues("uf", selected.map((s) => s.value));
                  if (municipio.length > 0) setValues("municipio", []);
                }}
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
                defaultOptions
                cacheOptions={uf.join(",")}
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

          {fields.includes("regional") && (
            <div className="col-md" style={{ flexBasis: 0, flexGrow: colSize }}>
              <label className="form-label fw-bold small">Regional</label>
              <Select
                isMulti
                styles={multiStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                placeholder="Todas as regionais"
                options={regionalOptions.map((r) => ({ value: r, label: r }))}
                value={regional.map((r) => ({ value: r, label: r }))}
                onChange={(selected) => setValues("regional", selected.map((s) => s.value))}
              />
            </div>
          )}

          {fields.includes("anf") && (
            <div className="col-md" style={{ flexBasis: 0, flexGrow: colSize }}>
              <label className="form-label fw-bold small">ANF</label>
              <Select
                isMulti
                styles={multiStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                placeholder="Todos os ANFs"
                options={anfOptions.map((a) => ({ value: a, label: a }))}
                value={anf.map((a) => ({ value: a, label: a }))}
                onChange={(selected) => setValues("anf", selected.map((s) => s.value))}
              />
            </div>
          )}

          {fields.includes("populacaoUrbana") && (
            <div className="col-md" style={{ flexBasis: 0, flexGrow: colSize }}>
              <label className="form-label fw-bold small">População Urbana</label>
              <Select
                isMulti
                styles={multiStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                placeholder="Todas as faixas"
                options={popUrbanaOptions.map((p) => ({ value: p.value, label: p.label }))}
                value={popUrbanaOptions
                  .filter((p) => popUrbana.includes(p.value))
                  .map((p) => ({ value: p.value, label: p.label }))}
                onChange={(selected) => setValues("popUrbana", selected.map((s) => s.value))}
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
      </div>
    </div>
  );
}
