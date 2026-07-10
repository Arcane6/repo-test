import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Trilha "Home / Módulo" acima do título — só entra se fizer sentido
   * mostrar onde o usuário está (páginas de módulo, não a Home). */
  breadcrumb?: Crumb[];
}

/**
 * Cabeçalho padrão de página: breadcrumb opcional + ícone + título +
 * subtítulo + slot de ações à direita. Usado no topo de cada módulo pra
 * não repetir o mesmo markup (e a mesma escala tipográfica) em cada
 * dashboard.
 */
export function PageHeader({ icon, title, subtitle, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="tim-page-header mb-4">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="tim-breadcrumb mb-2" aria-label="breadcrumb">
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.label}>
              {i > 0 && <i className="bi bi-chevron-right tim-breadcrumb-sep" />}
              {crumb.to ? (
                <Link to={crumb.to} className="tim-breadcrumb-link">
                  {crumb.label}
                </Link>
              ) : (
                <span className="tim-breadcrumb-current">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          {icon && (
            <div className="tim-page-header-icon">
              <i className={icon} />
            </div>
          )}
          <div>
            <h3 className="fw-bold mb-1">{title}</h3>
            {subtitle && <p className="text-muted mb-0">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="d-flex align-items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
