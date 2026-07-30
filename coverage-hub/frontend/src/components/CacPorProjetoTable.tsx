import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  summaryApi,
  type CacProjetoAgg,
  type CacProjetoLinha,
  type SummaryFilters,
} from "../api/summary";
import { ChartToolbar } from "./ChartToolbar";
import { Skeleton } from "./Skeleton";
import { SourceBadge } from "./SourceBadge";
import { downloadSheet } from "../utils/excelExport";

/** Zero vira "–": numa tabela com muitos zeros (vários projetos só têm CAC
 * numa camada), "0" repetido cria ruído visual e esconde onde tem volume. */
function num(v: number) {
  if (!v) return "–";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function moeda(v: number) {
  if (!v) return "–";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const COLUNAS: { key: keyof CacProjetoAgg; label: string; fmt: (v: number) => string }[] = [
  { key: "cac_5g", label: "5G Layers", fmt: num },
  { key: "cac_4g", label: "4G Layers", fmt: num },
  { key: "cac_4g_in_5g", label: "4G in 5G Layers", fmt: num },
  { key: "cac_outras", label: "Outras camadas", fmt: num },
  { key: "total_cac", label: "Total CAC", fmt: num },
  { key: "valor_mm", label: "Valor (R$ mi)", fmt: moeda },
];

/**
 * CAC do NEXUS em 3 níveis — Casa Nova/Existente > segmento
 * (SOURCE_AJUSTADO: TIM, B2B Mobile...) > projeto — com as camadas
 * tecnológicas em colunas. É o "pivot" que o usuário usa no Excel, agora
 * no portal.
 *
 * "Outras camadas" existe porque `TOTAL_CAC` (SUM(KPI) de todas as
 * camadas) NÃO é a soma das 3 camadas pivotadas — há KPI em valores de
 * `DLV_LEVEL_1` fora dos 3 baldes, concentrado nos projetos de B2B Mobile
 * (AGRO/INDÚSTRIA/LOGÍSTICA). Sem essa coluna o "Total" apareceria maior
 * que a soma das colunas visíveis — exatamente o tipo de número que não
 * fecha e destrói a confiança na tela.
 */
export function CacPorProjetoTable({ filters }: { filters: SummaryFilters }) {
  const { uf, municipio, ano, regionais, projetos } = filters;
  const { data, isLoading } = useQuery({
    queryKey: ["summary-r2-cac-por-projeto", uf, municipio, ano, regionais, projetos],
    queryFn: () => summaryApi.r2CacPorProjeto(filters),
  });

  const [escolhido, setEscolhido] = useState<string | null>(null);
  const cenarioAtual = escolhido ?? data?.cenario_default ?? data?.cenarios[0]?.cenario ?? null;
  const cenario = data?.cenarios.find((c) => c.cenario === cenarioAtual);

  const linhasExport = (cenario?.grupos ?? []).flatMap((g) =>
    g.segmentos.flatMap((sg) =>
      sg.linhas.map((l) => ({ tipo_casa: g.label, segmento: sg.segmento, ...l })),
    ),
  );

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-1 gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h6 className="fw-bold mb-0">CAC por Projeto</h6>
            <SourceBadge table="VW_CAPEX_MASTER_FULL" />
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <select
              className="form-select form-select-sm"
              style={{ width: 220 }}
              value={cenarioAtual ?? ""}
              onChange={(e) => setEscolhido(e.target.value)}
              aria-label="Cenário do CAC por projeto"
              disabled={!data?.cenarios.length}
            >
              {(data?.cenarios ?? []).map((c) => (
                <option key={c.cenario} value={c.cenario}>
                  {c.cenario}
                </option>
              ))}
            </select>
            <ChartToolbar
              onExportData={() =>
                downloadSheet("r2-cac-por-projeto.xlsx", {
                  name: "R2 CAC por Projeto",
                  columns: [
                    { header: "Tipo de Casa", key: "tipo_casa" },
                    { header: "Segmento", key: "segmento" },
                    { header: "Projeto", key: "projeto" },
                    { header: "5G Layers", key: "cac_5g" },
                    { header: "4G Layers", key: "cac_4g" },
                    { header: "4G in 5G Layers", key: "cac_4g_in_5g" },
                    { header: "Outras camadas", key: "cac_outras" },
                    { header: "Total CAC", key: "total_cac" },
                    { header: "Valor Total (R$ mi)", key: "valor_mm" },
                  ],
                  rows: linhasExport,
                })
              }
            />
          </div>
        </div>

        <p className="text-muted small mb-3">
          Endereços (CAC) por segmento e projeto, em camadas tecnológicas — Casa Nova x
          Casa Existente. O CAC do NEXUS é rateado por OC do rollout, então responde aos
          filtros da aba.
        </p>

        <div className="table-responsive" style={{ maxHeight: 460 }}>
          <table className="table table-sm table-hover align-middle mb-0 tim-cac-table">
            <thead className="sticky-top">
              <tr>
                <th>Projeto</th>
                {COLUNAS.map((c) => (
                  <th key={c.key} className="text-end">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td>
                      <Skeleton height={12} width="60%" />
                    </td>
                    {COLUNAS.map((c) => (
                      <td key={c.key} className="text-end">
                        <Skeleton height={12} width={40} className="ms-auto" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                (cenario?.grupos ?? []).map((grupo) => (
                  <Fragment key={grupo.tipo_casa}>
                    <tr className="tim-cac-group">
                      <th scope="rowgroup">
                        {grupo.label} <span className="opacity-75">({grupo.tipo_casa})</span>
                      </th>
                      {COLUNAS.map((c) => (
                        <td key={c.key} className="text-end fw-bold">
                          {c.fmt(grupo.subtotal[c.key])}
                        </td>
                      ))}
                    </tr>

                    {grupo.segmentos.map((seg) => (
                      <Fragment key={`${grupo.tipo_casa}-${seg.segmento}`}>
                        <tr className="tim-cac-segment">
                          <th scope="rowgroup" className="ps-4">
                            {seg.segmento}
                          </th>
                          {COLUNAS.map((c) => (
                            <td key={c.key} className="text-end fw-semibold">
                              {c.fmt(seg.subtotal[c.key])}
                            </td>
                          ))}
                        </tr>
                        {seg.linhas.map((linha: CacProjetoLinha) => (
                          <tr key={`${grupo.tipo_casa}-${seg.segmento}-${linha.projeto}`}>
                            <td className="tim-cac-projeto">{linha.projeto}</td>
                            {COLUNAS.map((c) => (
                              <td key={c.key} className="text-end">
                                {c.fmt(linha[c.key])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}

              {!isLoading && cenario && (
                <tr className="tim-cac-total">
                  <th>Total Geral</th>
                  {COLUNAS.map((c) => (
                    <td key={c.key} className="text-end fw-bold">
                      {c.fmt(cenario.total[c.key])}
                    </td>
                  ))}
                </tr>
              )}

              {!isLoading && !cenario && (
                <tr>
                  <td colSpan={COLUNAS.length + 1} className="text-center text-muted py-4">
                    Nenhum dado para este cenário.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
