import { NavLink, Outlet } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";

export function MobileAccessLayout() {
  return (
    <div className="container-fluid mt-4">
      <PageHeader
        icon="bi bi-broadcast-pin"
        title="Acesso Móvel"
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Acesso Móvel" }]}
      />

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
