import { NavLink, Outlet } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { TransportFilterBar } from "../../components/TransportFilterBar";

/** Módulo Transporte (perfil de infraestrutura de TX). Três abas: Resumo
 * Executivo (3 raias), Composição & Migração 25×26 e Infraestrutura &
 * Fornecimento (mapa, solução, provedor, status, rollout). */
export function TransportLayout() {
  return (
    <div className="container-fluid mt-4">
      <PageHeader
        icon="bi bi-diagram-3"
        title="Transporte"
        subtitle="Perfil de infraestrutura de transporte (backhaul) e migração para fibra"
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Transporte" }]}
      />

      <ul className="nav nav-tabs mb-4" role="tablist">
        <li className="nav-item" role="presentation">
          <NavLink className={({ isActive }) => "nav-link" + (isActive ? " active" : "")} to="resumo-executivo" role="tab">
            <i className="bi bi-clipboard-data me-1" /> Resumo Executivo
          </NavLink>
        </li>
        <li className="nav-item" role="presentation">
          <NavLink className={({ isActive }) => "nav-link" + (isActive ? " active" : "")} to="composicao" role="tab">
            <i className="bi bi-arrow-left-right me-1" /> Composição &amp; Migração
          </NavLink>
        </li>
        <li className="nav-item" role="presentation">
          <NavLink className={({ isActive }) => "nav-link" + (isActive ? " active" : "")} to="infraestrutura" role="tab">
            <i className="bi bi-geo-alt me-1" /> Infraestrutura &amp; Fornecimento
          </NavLink>
        </li>
        <li className="nav-item" role="presentation">
          <NavLink className={({ isActive }) => "nav-link" + (isActive ? " active" : "")} to="reconciliacao" role="tab">
            <i className="bi bi-shuffle me-1" /> Comparação de Bases
          </NavLink>
        </li>
      </ul>

      <TransportFilterBar />
      <Outlet />
    </div>
  );
}
