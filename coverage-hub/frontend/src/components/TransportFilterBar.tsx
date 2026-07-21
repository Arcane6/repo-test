import Select from "react-select";
import AsyncSelect from "react-select/async";
import { useQuery } from "@tanstack/react-query";
import { mobileAccessApi } from "../api/mobileAccess";
import { useTransportFilterStore } from "../store/transportFilters";
import { themedSelectStyles } from "./selectStyles";

// Regionais TIM (dimensão limpa da base de transporte).
const REGIONAIS = ["TSP", "TSL", "TNE", "TLE", "TRJ", "TCO", "TNO"];

/** Filtro do módulo Transporte: UF + Município + Regional. Reaproveita o
 * lookup geográfico do Acesso Móvel; store próprio. */
export function TransportFilterBar() {
  const { uf, municipio, regional, setValues, clear } = useTransportFilterStore();
  const multi = themedSelectStyles<{ value: string; label: string }, true>();

  const { data: ufOptions = [] } = useQuery({ queryKey: ["actual-ufs"], queryFn: mobileAccessApi.ufs });

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
            <Select isMulti styles={multi} placeholder="Todas as UFs"
              options={ufOptions.map((u) => ({ value: u, label: u }))}
              value={uf.map((u) => ({ value: u, label: u }))}
              onChange={(s) => setValues("uf", s.map((x) => x.value))} />
          </div>
          <div className="col-md">
            <label className="form-label fw-bold small">Regional</label>
            <Select isMulti styles={multi} placeholder="Todas as regionais"
              options={REGIONAIS.map((r) => ({ value: r, label: r }))}
              value={regional.map((r) => ({ value: r, label: r }))}
              onChange={(s) => setValues("regional", s.map((x) => x.value))} />
          </div>
          <div className="col-md">
            <label className="form-label fw-bold small">Município</label>
            <AsyncSelect isMulti styles={multi} placeholder="Digite um município..."
              loadOptions={loadMunicipios}
              value={municipio.map((m) => ({ value: m, label: m }))}
              onChange={(s) => setValues("municipio", s.map((x) => x.value))} />
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
