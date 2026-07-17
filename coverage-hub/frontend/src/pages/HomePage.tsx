import { useQuery } from "@tanstack/react-query";
import { modulesApi } from "../api/modules";
import { ModuleCard } from "./ModuleCard";
import { Skeleton } from "../components/Skeleton";

export function HomePage() {
  const { data: modules, isLoading } = useQuery({
    queryKey: ["modules"],
    queryFn: modulesApi.list,
    staleTime: Infinity,
  });

  const enabledCount = (modules ?? []).filter((m) => m.enabled).length;

  return (
    <div className="tim-page-enter">
      <div className="tim-hero">
        <div className="container tim-hero-inner">
          <span className="tim-hero-kicker">
            <i className="bi bi-broadcast" /> Planejamento técnico de rede
          </span>
          <h1 className="fw-bold mb-2 text-white">TIM Technical Planning</h1>
          <p className="lead mb-0 tim-hero-lead" style={{ maxWidth: "52ch" }}>
            Cobertura, rollout, tráfego e projeções num só portal — dados
            direto da rede, sem planilha.
          </p>
          <div className="tim-hero-stats">
            <span className="tim-hero-stat">
              <strong>{modules ? enabledCount : "—"}</strong> módulos ativos
            </span>
            <span className="tim-hero-stat">
              <i className="bi bi-geo-alt" /> 5.570 municípios
            </span>
            <span className="tim-hero-stat">
              <i className="bi bi-lightning-charge" /> Dados ao vivo do Oracle
            </span>
          </div>
        </div>
      </div>

      <div className="container my-5">
        <div className="d-flex justify-content-between align-items-end mb-4">
          <div>
            <h4 className="fw-bold mb-1">Módulos</h4>
            <small className="text-muted">Escolha um módulo para começar</small>
          </div>
          {modules && (
            <span className="tim-module-count">
              <strong>{enabledCount}</strong>&nbsp;de {modules.length} disponíveis
            </span>
          )}
        </div>

        <div className="row g-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div className="col-md-6 col-lg-4" key={i}>
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body p-4">
                      <Skeleton height={52} width={52} radius={14} className="mb-3" />
                      <Skeleton height={20} width="60%" className="mb-2" />
                      <Skeleton height={14} width="90%" className="mb-1" />
                      <Skeleton height={14} width="70%" />
                    </div>
                  </div>
                </div>
              ))
            : modules?.map((m, i) => <ModuleCard m={m} key={m.key} index={i} />)}
        </div>
      </div>
    </div>
  );
}
