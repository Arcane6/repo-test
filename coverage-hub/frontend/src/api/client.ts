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

/** Todo módulo define seu BASE como path absoluto da raiz (ex.:
 * "/mobile-access/api"). Isso funciona sozinho quando o app está na raiz
 * do domínio, mas quebra quando ele é servido atrás de um reverse proxy
 * num subpath (ex.: nginx expondo em "/integration/", com outro app na
 * raiz "/") — o `fetch("/api/...")` do navegador ignora completamente o
 * subpath e vai direto pra raiz do domínio, batendo no app errado atrás
 * do proxy. Prefixando aqui, num único lugar, com o mesmo `base` que o
 * Vite usa pra servir os assets (`import.meta.env.BASE_URL`), toda
 * chamada de API já nasce corrigida sem precisar tocar em cada arquivo
 * de api/*.ts. */
function withBasePath(path: string): string {
  const base = import.meta.env.BASE_URL;
  if (!base || base === "/") return path;
  return base.replace(/\/$/, "") + path;
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(withBasePath(path));
  if (!response.ok) {
    throw new Error(`Falha ao buscar ${path}: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}
