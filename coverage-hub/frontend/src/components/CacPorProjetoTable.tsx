import { Fragment } from "react";
import type { CacPorProjetoCenario, CacProjetoAgg, CacProjetoLinha } from "../api/summary";
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

const COLUNAS: { key: keyof CacProjetoAgg; label: string; fmt: (v: number) => string }[] = [
  { key: "cac_5g", label: "5G Layers", fmt: num },
  { key: "cac_4g", label: "4G Layers", fmt: num },
  { key: "cac_4g_in_5g", label: "4G in 5G Layers", fmt: num },
  { key: "total_cac", label: "Total CAC", fmt: num },
];

interface CacPorProjetoTableProps {
  cenarios: CacPorProjetoCenario[];
  cenarioAtual: string | null;
  cenario: CacPorProjetoCenario | undefined;
  onChangeCenario: (cenario: string) => void;
  isLoading: boolean;
}

/**
 * CAC do NEXUS em 3 níveis — Casa Nova/Existente > segmento
 * (SOURCE_AJUSTADO: TIM, B2B Mobile...) > projeto — com as camadas
 * tecnológicas em colunas. É o "pivot" que o usuário usa no Excel, agora
 * no portal.
 *
 * `total_cac` é só a soma de 5G/4G/4G in 5G Layers — pedido explícito do
 * usuário (jul/26) pra excluir "outras camadas" (KPI de DLV_LEVEL_1 fora
 * desses 3 baldes, concentrado em B2B Mobile) do cálculo, não só escondê-la
 * da tela. Não reintroduzir essa coluna sem pedido novo.
 *
 * Sem coluna de valor (R$ mi) — saiu daqui a pedido do usuário; o valor
 * financeiro voltou a aparecer no resumo `CacResumoTecnologia`, ao lado.
 * O cenário selecionado é estado do pai (`Raia2`), compartilhado com esse
 * resumo — os dois trocam juntos quando o combo muda.
 */
export function CacPorProjetoTable({
  cenarios,
  cenarioAtual,
  cenario,
  onChangeCenario,
  isLoading,
}: CacPorProjetoTableProps) {
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
              onChange={(e) => onChangeCenario(e.target.value)}
              aria-label="Cenário do CAC por projeto"
              disabled={!cenarios.length}
            >
              {cenarios.map((c) => (
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
                    { header: "Total CAC", key: "total_cac" },
                  ],
                  rows: linhasExport,
                })
              }
            />
          </div>
        </div>

        <p className="text-muted small mb-3">
          Endereços (CAC) por segmento e projeto, em camadas tecnológicas — Casa Nova x
          Casa Existente. Nacional: a fonte não tem dimensão geográfica, então este
          quadro não responde aos filtros da aba.
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
