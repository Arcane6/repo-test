import Select from "react-select";
import AsyncSelect from "react-select/async";
import { useQuery } from "@tanstack/react-query";
import { mobileAccessApi } from "../api/mobileAccess";
import { useCoreFilterStore } from "../store/coreFilters";
import { themedSelectStyles } from "./selectStyles";

/**
 * Filtro geográfico do módulo Core — mesma UX de `FilterBar` (Acesso
 * Móvel), mas com store próprio (`useCoreFilterStore`): é outro domínio
 * de dado, não deve compartilhar estado com os outros módulos. UF e
 * busca de município reaproveitam os endpoints do Acesso Móvel (são
 * lookup geográfico genérico, não algo específico daquele módulo).
 */
export function CoreFilterBar() {
  const { uf, municipio, regional, setValues, clear } = useCoreFilterStore();
  const multiStyles = themedSelectStyles<{ value: string; label: string }, true>();

  const { data: ufOptions = [] } = useQuery({
    queryKey: ["actual-ufs"],
    queryFn: mobileAccessApi.ufs,
  });

  const loadMunicipios = async (input: string) => {
    const rows = await mobileAccessApi.municipiosSearch(input, uf);
    return rows.map((r) => ({ value: r.municipio, label: `${r.municipio} (${r.uf})` }));
  };

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-body">
        <div className="row g-3 align-items-end">
          <div className="col-md" style={{ flexBasis: 0, flexGrow: 1 }}>
            <label className="form-label fw-bold small">UF</label>
            <Select
              isMulti
              styles={multiStyles}
              placeholder="Todas as UFs"
              options={ufOptions.map((u) => ({ value: u, label: u }))}
              value={uf.map((u) => ({ value: u, label: u }))}
              onChange={(selected) => setValues("uf", selected.map((s) => s.value))}
            />
          </div>

          <div className="col-md" style={{ flexBasis: 0, flexGrow: 1 }}>
            <label className="form-label fw-bold small">Município</label>
            <AsyncSelect
              isMulti
              styles={multiStyles}
              placeholder="Digite um município..."
              loadOptions={loadMunicipios}
              value={municipio.map((m) => ({ value: m, label: m }))}
              onChange={(selected) => setValues("municipio", selected.map((s) => s.value))}
            />
          </div>

          <div className="col-md-auto d-flex justify-content-end">
            <button className="btn btn-sm btn-outline-secondary" onClick={clear}>
              <i className="bi bi-x-lg" /> Limpar filtros
            </button>
          </div>
        </div>

        {regional.length > 0 && (
          <div className="small text-muted mt-2">
            <i className="bi bi-info-circle me-1" />
            Regional filtrada via clique no ranking abaixo: <b>{regional.join(", ")}</b>
          </div>
        )}
      </div>
    </div>
  );
}
