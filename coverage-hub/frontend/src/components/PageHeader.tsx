import type { ReactNode } from "react";

interface PageHeaderProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Cabeçalho padrão de página: ícone + título + subtítulo + slot de ações
 * à direita. Usado no topo de cada módulo pra não repetir o mesmo
 * markup (e a mesma escala tipográfica) em cada dashboard.
 */
export function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="tim-page-header mb-4 d-flex align-items-start justify-content-between flex-wrap gap-3">
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
  );
}
