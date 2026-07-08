export interface ActiveFilters {
  uf: string[];
  municipio: string[];
  tecnologia: string[];
}

export function filtersToQuery(filters: ActiveFilters): string {
  const params = new URLSearchParams();
  filters.uf.forEach((v) => params.append("uf", v));
  filters.municipio.forEach((v) => params.append("municipio", v));
  filters.tecnologia.forEach((v) => params.append("tecnologia", v));
  return params.toString();
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Falha ao buscar ${path}: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}
