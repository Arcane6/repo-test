import type { CacPorProjetoCenario, CacResumoCelula } from "../api/summary";
import { Skeleton } from "./Skeleton";
import { SourceBadge } from "./SourceBadge";

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function num(v: number) {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function Linha({
  label,
  celula,
  fmt,
  destaque,
  indent,
}: {
  label: string;
  celula: CacResumoCelula;
  fmt: (v: number) => string;
  destaque?: boolean;
  indent?: boolean;
}) {
  return (
    <tr className={destaque ? "tim-resumo-tech-destaque" : undefined}>
      <th scope="row" className={indent ? "ps-4 fw-normal" : undefined}>
        {label}
      </th>
      <td className="text-end">{fmt(celula.v5g)}</td>
      <td className="text-end text-muted">{celula.pct5g}%</td>
      <td className="text-end">{fmt(celula.v4g)}</td>
      <td className="text-end text-muted">{celula.pct4g}%</td>
      <td className="text-end fw-bold">{fmt(celula.total)}</td>
    </tr>
  );
}

/**
 * Resumo nacional CAPEX + Layers por tecnologia (5G x 4G), ao lado da
 * tabela "CAC por Projeto" — mesmo cenário do combo daquela tabela
 * (`cenario` vem do estado do pai, `Raia2`).
 *
 * "4G in 5G Layers" entra dentro de "4G" aqui (pedido do usuário,
 * jul/26) — diferente da tabela ao lado, que ainda mostra as 3 camadas
 * separadas. % é a fatia de cada tech sobre o total da própria linha
 * (CAPEX ou Layers), não sobre o total geral do cenário.
 */
export function CacResumoTecnologia({
  cenario,
  isLoading,
}: {
  cenario: CacPorProjetoCenario | undefined;
  isLoading: boolean;
}) {
  const resumo = cenario?.resumo_tech;

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
          <h6 className="fw-bold mb-0">MBB Evolution + B2B IoT</h6>
          <SourceBadge table="VW_CAPEX_MASTER_FULL" />
        </div>
        <p className="text-muted small mb-3">
          CAPEX e endereços (Layers) do CAC, por tecnologia — nacional, mesmo cenário do
          quadro ao lado.
        </p>

        {isLoading || !resumo ? (
          <div className="d-flex flex-column gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={20} />
            ))}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0 tim-cac-table tim-resumo-tech-table">
              <thead>
                <tr>
                  <th rowSpan={3} className="align-middle">
                    {cenario?.cenario}
                  </th>
                  <th colSpan={4} className="text-center">
                    MBB Evolution + B2B IoT
                  </th>
                  <th rowSpan={3} className="text-end align-middle">
                    Total
                  </th>
                </tr>
                <tr>
                  <th colSpan={2} className="text-center">5G</th>
                  <th colSpan={2} className="text-center">4G</th>
                </tr>
                <tr>
                  <th className="text-end">Valor</th>
                  <th className="text-end">%</th>
                  <th className="text-end">Valor</th>
                  <th className="text-end">%</th>
                </tr>
              </thead>
              <tbody>
                <Linha label="CAPEX (MMR$)" celula={resumo.capex} fmt={moeda} destaque />
                <Linha label="LAYERS (QTD)" celula={resumo.layers} fmt={num} destaque />
                <Linha label="Casa Nova" celula={resumo.casa_nova} fmt={num} indent />
                <Linha label="Casa Existente" celula={resumo.casa_existente} fmt={num} indent />
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
