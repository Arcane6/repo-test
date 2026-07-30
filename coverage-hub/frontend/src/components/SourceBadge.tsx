import { useQuery } from "@tanstack/react-query";
import { refsApi } from "../api/refs";

const TABLE_LABELS: Record<string, string> = {
  MUNICIPIOS_FECHAMENTO: "Municípios TIM Brasil Fechamento",
  TB_FT_BASE_UNICA_SITES: "Base Única de Sites",
  BASE_TB_END_ID_NEW: "RF Design Profile",
  TB_ROLLOUT_ACESSO: "Rollout Acesso",
  TB_NEXUS_FINANCEIRO: "Nexus Financeiro",
  TB_NEXUS_CN_CE: "Nexus CN/CE",
  VW_CAPEX_MASTER_FULL: "CAPEX Master (NEXUS)",
  REL_CIDADES_PLANEJADO_26: "Plano Nominal de Municípios 5G",
};

/** "31/12/2025" -> "12/2025" — usado quando o card só quer mês/ano, sem
 * o dia (a referência "cheia" continua disponível no `title` do badge). */
function toMonthYear(ref: string): string {
  const parts = ref.split("/");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : ref;
}

/**
 * Badge "de onde vem esse número": nome da tabela-fonte + referência mais
 * recente (data da carga ou mês/ano, conforme a tabela). Aceita uma ou
 * mais tabelas — gráfico que cruza fontes mostra as duas.
 */
export function SourceBadge({
  table,
  dateFormat = "day",
}: {
  table: string | string[];
  /** "month" trunca a referência (formato DD/MM/YYYY) pra MM/YYYY —
   * usado quando o card não quer mostrar o dia. */
  dateFormat?: "day" | "month";
}) {
  const { data: refs } = useQuery({
    queryKey: ["refs"],
    queryFn: refsApi.get,
    staleTime: 5 * 60_000,
  });

  const tables = Array.isArray(table) ? table : [table];

  return (
    <div className="d-flex flex-wrap gap-1">
      {tables.map((t) => {
        const rawRef = refs?.[t];
        const ref = rawRef && dateFormat === "month" ? toMonthYear(rawRef) : rawRef;
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
