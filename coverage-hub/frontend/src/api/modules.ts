import { fetchJson } from "./client";

export interface ModuleInfo {
  key: string;
  name: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  enabled: boolean;
}

export const modulesApi = {
  list: () => fetchJson<ModuleInfo[]>("/api/modules"),
};
