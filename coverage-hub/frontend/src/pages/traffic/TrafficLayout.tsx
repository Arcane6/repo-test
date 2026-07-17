import { NavLink, Outlet } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { TrafficFilterBar } from "../../components/TrafficFilterBar";

/**
 * Módulo Tráfego (substituiu o Core/volumetria ALTAIA — a fonte de
 * tráfego mudou). Duas abas: Resumo Executivo (3 raias) e Tráfego YTD.
 * O filtro de UF/Município fica no layout, compartilhado pelas duas abas
 * (mesmo store), igual ao Acesso Móvel.
 */
export function TrafficLayout() {
  return (
    <div className="container-fluid mt-4">
      <PageHeader
        icon="bi bi-graph-up"
        title="Tráfego"
        subtitle="Tráfego planejado × realizado por município, UF e regional"
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Tráfego" }]}
      />

      <ul className="nav nav-tabs mb-4" role="tablist">
        <li className="nav-item" role="presentation">
          <NavLink
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            to="resumo-executivo"
            role="tab"
          >
            <i className="bi bi-clipboard-data me-1" /> Resumo Executivo
          </NavLink>
        </li>
        <li className="nav-item" role="presentation">
          <NavLink
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            to="ytd"
            role="tab"
          >
            <i className="bi bi-graph-up-arrow me-1" /> Tráfego YTD
          </NavLink>
        </li>
      </ul>

      <TrafficFilterBar />

      <Outlet />
    </div>
  );
}
