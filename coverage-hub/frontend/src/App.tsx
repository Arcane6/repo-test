import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
      <CidadesDashboard />
    </QueryClientProvider>
  );
}
