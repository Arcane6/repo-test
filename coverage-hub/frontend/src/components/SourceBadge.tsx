import { useQuery } from "@tanstack/react-query";
import { refsApi } from "../api/refs";

const TABLE_LABELS: Record<string, string> = {
  MUNICIPIOS_FECHAMENTO: "Municípios Fechamento",
  TB_FT_BASE_UNICA_SITES: "Base Única de Sites",
  BASE_TB_END_ID_NEW: "Base End ID",
  TB_ROLLOUT_ACESSO: "Rollout Acesso",
  TB_NEXUS_FINANCEIRO: "Nexus Financeiro",
  TB_NEXUS_CN_CE: "Nexus CN/CE",
};

/**
 * Badge "de onde vem esse número": nome da tabela-fonte + referência mais
 * recente (data da carga ou mês/ano, conforme a tabela). Aceita uma ou
 * mais tabelas — gráfico que cruza fontes mostra as duas.
 */
export function SourceBadge({ table }: { table: string | string[] }) {
  const { data: refs } = useQuery({
    queryKey: ["refs"],
    queryFn: refsApi.get,
    staleTime: 5 * 60_000,
  });

  const tables = Array.isArray(table) ? table : [table];

  return (
    <div className="d-flex flex-wrap gap-1">
      {tables.map((t) => {
        const ref = refs?.[t];
        return (
          <span
            key={t}
            className="tim-source-badge"
            title={`Fonte: ${t}${ref ? ` · referência ${ref}` : ""}`}
          >
            <i className="bi bi-database" /> {TABLE_LABELS[t] ?? t}
            {ref && <span className="tim-source-badge-ref">{ref}</span>}
          </span>
        );
      })}
    </div>
  );
}
