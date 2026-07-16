import Select from "react-select";
import AsyncSelect from "react-select/async";
import { useQuery } from "@tanstack/react-query";
import { mobileAccessApi } from "../api/mobileAccess";
import { useTrafficFilterStore } from "../store/trafficFilters";
import { themedSelectStyles } from "./selectStyles";

/**
 * Filtro do módulo Tráfego (UF + Município). Reaproveita os endpoints de
 * UF/busca de município do Acesso Móvel (lookup geográfico genérico), mas
 * escreve no store PRÓPRIO do Tráfego (useTrafficFilterStore) — não vaza
 * pro outro módulo.
 */
export function TrafficFilterBar() {
  const { uf, municipio, setValues, clear } = useTrafficFilterStore();
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
          <div className="col-md">
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

          <div className="col-md">
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
      </div>
    </div>
  );
}
