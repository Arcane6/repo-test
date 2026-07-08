import { FilterBar } from "../components/FilterBar";
import { KpiCards } from "../components/KpiCards";
import { FrequencyChart } from "../components/FrequencyChart";
import { TimelineChart } from "../components/TimelineChart";
import { MunicipiosTable } from "../components/MunicipiosTable";

export function CidadesDashboard() {
  return (
    <div className="container-fluid mt-4">
      <div className="mb-4 d-flex align-items-center justify-content-between">
        <div>
          <h3 className="fw-bold mb-1">Cidades</h3>
          <small className="text-muted">
            Cobertura por município, tecnologia e frequência — protótipo em React
          </small>
        </div>
        <span className="badge text-bg-info">Beta</span>
      </div>

      <FilterBar />
      <KpiCards />

      <div className="row g-3">
        <div className="col-lg-6">
          <TimelineChart />
        </div>
        <div className="col-lg-6">
          <MunicipiosTable />
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <FrequencyChart />
        </div>
      </div>
    </div>
  );
}
