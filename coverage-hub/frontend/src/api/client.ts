export interface ActiveFilters {
  uf: string[];
  municipio: string[];
  tecnologia?: string[];
  ano?: string | null;
  /** Região exata do diagrama de Venn (ex.: "only_2g", "inter_all"). */
  vennRegion?: string | null;
}

export function filtersToQuery(filters: ActiveFilters): string {
  const params = new URLSearchParams();
  filters.uf.forEach((v) => params.append("uf", v));
  filters.municipio.forEach((v) => params.append("municipio", v));
  filters.tecnologia?.forEach((v) => params.append("tecnologia", v));
  if (filters.ano) params.append("ano", filters.ano);
  if (filters.vennRegion) params.append("venn", filters.vennRegion);
  return params.toString();
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Falha ao buscar ${path}: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Falha ao enviar ${path}: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}
