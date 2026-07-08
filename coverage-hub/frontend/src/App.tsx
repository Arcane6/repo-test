import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./layout/Layout";
import { HomePage } from "./pages/HomePage";
import { MobileAccessLayout } from "./pages/mobile-access/MobileAccessLayout";
import { ResumoDashboard } from "./dashboards/ResumoDashboard";
import { CidadesDashboard } from "./dashboards/CidadesDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="mobile-access" element={<MobileAccessLayout />}>
              <Route index element={<Navigate to="resumo" replace />} />
              <Route path="resumo" element={<ResumoDashboard />} />
              <Route path="cidades" element={<CidadesDashboard />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
