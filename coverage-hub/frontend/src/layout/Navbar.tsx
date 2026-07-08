import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { modulesApi } from "../api/modules";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const { data: modules = [] } = useQuery({
    queryKey: ["modules"],
    queryFn: modulesApi.list,
    staleTime: Infinity,
  });

  const enabledModules = modules.filter((m) => m.enabled);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark tim-navbar">
      <div className="container-fluid">
        <NavLink className="navbar-brand fw-bold d-flex align-items-center" to="/">
          <i className="bi bi-broadcast me-2" />
          TIM Technical Planning
        </NavLink>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNav"
          aria-controls="mainNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="mainNav">
          <ul className="navbar-nav ms-auto align-items-lg-center">
            <li className="nav-item">
              <NavLink className="nav-link" to="/" end>
                <i className="bi bi-house-door me-1" /> Home
              </NavLink>
            </li>

            {enabledModules.map((m) => (
              <li className="nav-item" key={m.key}>
                <NavLink className="nav-link" to={m.url}>
                  <i className={`${m.icon} me-1`} /> {m.name}
                </NavLink>
              </li>
            ))}

            <li className="nav-item d-none d-lg-block">
              <span className="mx-2 text-white-50">|</span>
            </li>

            <li className="nav-item">
              <ThemeToggle />
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
