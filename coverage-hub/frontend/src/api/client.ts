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
 * do proxy. Prefixando aqui, num único lugar, com `VITE_ROUTER_BASENAME`
 * (sob qual prefixo a APLICAÇÃO vive — não confundir com o `base`/
 * `import.meta.env.BASE_URL` do Vite, que é só onde os arquivos JS/CSS
 * moram e diverge disso no deploy padrão: assets em "/static/dist/", mas
 * app/API na raiz "/"), toda chamada de API já nasce corrigida sem
 * precisar tocar em cada arquivo de api/*.ts. */
export function withBasePath(path: string): string {
  const base = import.meta.env.VITE_ROUTER_BASENAME;
  if (!base || base === "/") return path;
  return base.replace(/\/$/, "") + path;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(withBasePath(path), init);
  if (!response.ok) {
    throw new Error(`Falha ao buscar ${path}: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}
