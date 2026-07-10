import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { modulesApi } from "../api/modules";

export function Footer() {
  const { data: modules = [] } = useQuery({
    queryKey: ["modules"],
    queryFn: modulesApi.list,
    staleTime: Infinity,
  });

  const enabledModules = modules.filter((m) => m.enabled);

  return (
    <footer className="tim-footer mt-5">
      <div className="container-fluid py-4">
        <div className="row gy-3">
          <div className="col-md-5">
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-broadcast" />
              <strong>TIM Technical Planning</strong>
            </div>
            <p className="text-muted small mb-0">
              Cobertura, plano de rollout e projeções num só portal — dados direto da
              rede, sem planilha.
            </p>
          </div>

          <div className="col-md-4">
            <div className="tim-footer-heading">Módulos</div>
            <ul className="tim-footer-links">
              <li>
                <NavLink to="/">Home</NavLink>
              </li>
              {enabledModules.map((m) => (
                <li key={m.key}>
                  <NavLink to={m.url}>{m.name}</NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-md-3 text-md-end">
            <span className="tim-footer-badge">
              <i className="bi bi-shield-lock me-1" /> Uso interno
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
