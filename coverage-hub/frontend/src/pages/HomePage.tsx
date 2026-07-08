import { useQuery } from "@tanstack/react-query";
import { modulesApi } from "../api/modules";
import { ModuleCard } from "./ModuleCard";

export function HomePage() {
  const { data: modules = [] } = useQuery({
    queryKey: ["modules"],
    queryFn: modulesApi.list,
    staleTime: Infinity,
  });

  const enabledCount = modules.filter((m) => m.enabled).length;

  return (
    <>
      <div className="tim-hero py-5">
        <div className="container">
          <h1 className="fw-bold mb-2 text-white">TIM Technical Planning</h1>
          <p className="lead mb-0 text-white-50">
            Portal integrado de planejamento técnico de rede
          </p>
        </div>
      </div>

      <div className="container my-5">
        <div className="d-flex justify-content-between align-items-end mb-4">
          <div>
            <h4 className="fw-bold mb-1">Módulos</h4>
            <small className="text-muted">Escolha um módulo para começar</small>
          </div>
          <small className="text-muted">
            {enabledCount} de {modules.length} disponíveis
          </small>
        </div>

        <div className="row g-4">
          {modules.map((m) => (
            <ModuleCard m={m} key={m.key} />
          ))}
        </div>
      </div>
    </>
  );
}
