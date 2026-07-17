import { Link } from "react-router-dom";
import type { ModuleInfo } from "../api/modules";

export function ModuleCard({ m, index = 0 }: { m: ModuleInfo; index?: number }) {
  const content = (
    <div className="card border-0 shadow-sm h-100">
      <div className="module-card-top" />
      <div className="card-body p-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="module-icon">
            <i className={m.icon} />
          </div>
          {m.enabled ? (
            <span className="badge module-badge">Disponível</span>
          ) : (
            <span className="badge bg-secondary">Em breve</span>
          )}
        </div>

        <h5 className="fw-bold mb-2">{m.name}</h5>
        <p className="text-muted small mb-3">{m.description}</p>

        {m.enabled && (
          <div className="module-cta small fw-bold">
            Abrir <i className="bi bi-arrow-right" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="col-md-6 col-lg-4 tim-reveal-item" style={{ "--reveal-i": index } as React.CSSProperties}>
      {m.enabled ? (
        <Link
          to={m.url}
          className="module-card d-block h-100 text-decoration-none"
          style={{ "--module-color": m.color } as React.CSSProperties}
        >
          {content}
        </Link>
      ) : (
        <div
          className="module-card disabled d-block h-100 text-decoration-none"
          style={{ "--module-color": m.color } as React.CSSProperties}
        >
          {content}
        </div>
      )}
    </div>
  );
}
