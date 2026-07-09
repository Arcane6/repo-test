import { fetchJson } from "./client";

/** Referência mais recente de cada tabela-fonte (nome da tabela → data/mês
 * da carga), usada nos badges "de onde vem esse número". */
export type RefsResponse = Record<string, string | null>;

export const refsApi = {
  get: () => fetchJson<RefsResponse>("/mobile-access/api/refs"),
};
