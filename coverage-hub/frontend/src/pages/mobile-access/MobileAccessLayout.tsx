import { NavLink, Outlet } from "react-router-dom";

export function MobileAccessLayout() {
  return (
    <div className="container-fluid mt-4">
      <div className="mb-4">
        <h3 className="fw-bold mb-1">Acesso Móvel</h3>
        <small className="text-muted">Cobertura por município, tecnologia e frequência</small>
      </div>

      <ul className="nav nav-tabs mb-4" role="tablist">
        <li className="nav-item" role="presentation">
          <NavLink
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            to="resumo"
            role="tab"
          >
            <i className="bi bi-bar-chart-line me-1" /> Resumo
          </NavLink>
        </li>
        <li className="nav-item" role="presentation">
          <NavLink
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            to="cidades"
            role="tab"
          >
            <i className="bi bi-geo-alt me-1" /> Cidades
          </NavLink>
        </li>
      </ul>

      <Outlet />
    </div>
  );
}
