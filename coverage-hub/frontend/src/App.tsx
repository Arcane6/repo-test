import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./layout/Layout";
import { HomePage } from "./pages/HomePage";
import { Skeleton } from "./components/Skeleton";

// Code-splitting por rota: a Home (primeira impressão) carrega só o shell —
// ECharts, Leaflet e react-select ficam em chunks async que só baixam quando
// o usuário navega pro dashboard que os usa. Sem isso o bundle inicial
// passava de 1,1 MB com tudo dentro.
const MobileAccessLayout = lazy(() =>
  import("./pages/mobile-access/MobileAccessLayout").then((m) => ({ default: m.MobileAccessLayout })),
);
const ResumoDashboard = lazy(() =>
  import("./dashboards/ResumoDashboard").then((m) => ({ default: m.ResumoDashboard })),
);
const CidadesDashboard = lazy(() =>
  import("./dashboards/CidadesDashboard").then((m) => ({ default: m.CidadesDashboard })),
);
const SitesDashboard = lazy(() =>
  import("./dashboards/SitesDashboard").then((m) => ({ default: m.SitesDashboard })),
);
const TrafficLayout = lazy(() =>
  import("./pages/traffic/TrafficLayout").then((m) => ({ default: m.TrafficLayout })),
);
const TrafegoResumoExecutivo = lazy(() =>
  import("./dashboards/TrafegoResumoExecutivo").then((m) => ({ default: m.TrafegoResumoExecutivo })),
);
const TrafegoYtd = lazy(() =>
  import("./dashboards/TrafegoYtd").then((m) => ({ default: m.TrafegoYtd })),
);
const TransportLayout = lazy(() =>
  import("./pages/transport/TransportLayout").then((m) => ({ default: m.TransportLayout })),
);
const TransporteResumoExecutivo = lazy(() =>
  import("./dashboards/TransporteResumoExecutivo").then((m) => ({ default: m.TransporteResumoExecutivo })),
);
const TransporteComposicao = lazy(() =>
  import("./dashboards/TransporteComposicao").then((m) => ({ default: m.TransporteComposicao })),
);
const TransporteInfraestrutura = lazy(() =>
  import("./dashboards/TransporteInfraestrutura").then((m) => ({ default: m.TransporteInfraestrutura })),
);
const TransporteReconciliacao = lazy(() =>
  import("./dashboards/TransporteReconciliacao").then((m) => ({ default: m.TransporteReconciliacao })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/** Fallback do Suspense durante o download do chunk da rota — mesmo
 * vocabulário visual dos skeletons de dado (shimmer), pra transição de
 * rota e loading de dado parecerem UM sistema só. */
function RouteFallback() {
  return (
    <div className="container-fluid mt-4" aria-busy="true" aria-label="Carregando página">
      <Skeleton height={36} width={320} radius={10} />
      <Skeleton height={88} radius={14} className="mt-3" />
      <div className="row g-3 mt-1">
        {[0, 1, 2].map((i) => (
          <div className="col-md-4" key={i}>
            <Skeleton height={140} radius={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* VITE_ROUTER_BASENAME (não é o `base`/VITE_BASE_PATH do Vite!) —
        são coisas diferentes: `base` é só onde os arquivos JS/CSS moram
        (no deploy padrão, "/static/dist/", porque é lá que o Flask serve
        o build); basename é sob qual prefixo a APLICAÇÃO/rotas vivem (no
        deploy padrão, "/", raiz do domínio, já que o Flask serve tudo
        direto). Usar o mesmo valor pros dois só por acaso funciona no
        cenário do proxy nginx num subpath (onde os dois coincidem) — no
        deploy padrão eles divergem, e usar `base` aqui deixava QUALQUER
        rota fora da Home em branco (Router não casava a URL com
        basename="/static/dist/"). Só defina VITE_ROUTER_BASENAME quando
        o app roda atrás de um proxy num subpath (ex.: "/integration"). */}
      <BrowserRouter basename={import.meta.env.VITE_ROUTER_BASENAME || "/"}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route
              path="mobile-access"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <MobileAccessLayout />
                </Suspense>
              }
            >
              <Route index element={<Navigate to="resumo" replace />} />
              <Route path="resumo" element={<ResumoDashboard />} />
              <Route path="cidades" element={<CidadesDashboard />} />
              <Route path="sites" element={<SitesDashboard />} />
            </Route>
            <Route
              path="trafego"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <TrafficLayout />
                </Suspense>
              }
            >
              <Route index element={<Navigate to="resumo-executivo" replace />} />
              <Route path="resumo-executivo" element={<TrafegoResumoExecutivo />} />
              <Route path="ytd" element={<TrafegoYtd />} />
            </Route>
            <Route
              path="transport"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <TransportLayout />
                </Suspense>
              }
            >
              <Route index element={<Navigate to="resumo-executivo" replace />} />
              <Route path="resumo-executivo" element={<TransporteResumoExecutivo />} />
              <Route path="composicao" element={<TransporteComposicao />} />
              <Route path="infraestrutura" element={<TransporteInfraestrutura />} />
              <Route path="reconciliacao" element={<TransporteReconciliacao />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
