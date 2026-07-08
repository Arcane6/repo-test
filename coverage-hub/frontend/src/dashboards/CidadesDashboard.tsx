import { FilterBar } from "../components/FilterBar";
import { KpiCards } from "../components/KpiCards";
import { VennDiagram } from "../components/VennDiagram";
import { FrequencyChart } from "../components/FrequencyChart";
import { TimelineChart } from "../components/TimelineChart";
import { MunicipiosTable } from "../components/MunicipiosTable";
import { ExportAllButton } from "../components/ExportAllButton";

export function CidadesDashboard() {
  return (
    <div>
      <div className="mb-4 d-flex justify-content-end">
        <ExportAllButton />
      </div>

      <FilterBar fields={["uf", "municipio", "tecnologia"]} />
      <KpiCards />

      <div className="row g-3">
        <div className="col-lg-4">
          <VennDiagram />
        </div>
        <div className="col-lg-4">
          <TimelineChart />
        </div>
        <div className="col-lg-4">
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
