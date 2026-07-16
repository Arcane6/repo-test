import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { CoreFilterBar } from "../components/CoreFilterBar";
import { KpiDeltaCard } from "../components/KpiDeltaCard";
import { VariationList } from "../components/VariationList";
import { ChartPanel } from "../components/ChartPanel";
import { CoreMap } from "../components/CoreMap";
import { horizontalBarsOption, trafficTrendOption } from "../charts/optionBuilders";
import { coreApi } from "../api/core";
import { useCoreFilterStore } from "../store/coreFilters";

const fmtPb = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function CoreDashboard() {
  const { uf, municipio, regional, toggleRegional } = useCoreFilterStore();
  const filters = { uf, municipio, regional };

  // Uma chamada só pro dashboard inteiro (ver get_overview no backend) —
  // evita disparar as queries pesadas (histórico full-scan) várias vezes
  // em paralelo contra um pool de 5 conexões, que fazia a página "nunca"
  // carregar.
  const { data, isFetching: loading, error, isLoading } = useQuery({
    queryKey: ["core-overview", uf, municipio, regional],
    queryFn: () => coreApi.overview(filters),
    // Sem retry: se a query pesada falhar (ex.: timeout de gateway), o
    // default do react-query tentaria 3x com backoff — multiplicando a
    // espera e escondendo o erro. Melhor falhar rápido e visível.
    retry: false,
  });

  // Se o dado veio mas está totalmente vazio (query rodou mas não
  // retornou linha — ex.: join sem match, janela de mês fora do range),
  // avisa explicitamente em vez de mostrar cards em branco (que o
  // usuário lê como "quebrado").
  const semDados =
    !isLoading &&
    !error &&
    data != null &&
    (data.historico?.points?.length ?? 0) === 0 &&
    (data.ranking_municipios?.items?.length ?? 0) === 0;

  const kpis = data?.kpis;
  const historico = data?.historico;
  const destaques = data?.destaques;
  const rankMun = data?.ranking_municipios;
  const rankUf = data?.ranking_ufs;
  const rankRegional = data?.ranking_regionais;

  const loadingKpis = loading;
  const loadingHistorico = loading;
  const loadingDestaques = loading;
  const loadingRankMun = loading;
  const loadingRankUf = loading;
  const loadingRankRegional = loading;

  return (
    <div className="container-fluid mt-4">
      <PageHeader
        icon="bi bi-hdd-network"
        title="Core"
        subtitle="Volumetria de tráfego da RAN (4G/5G) por município, UF e regional"
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Core" }]}
      />

      <CoreFilterBar />

      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div>
            <strong>Falha ao carregar os dados do Core.</strong>
            <div className="small mt-1">
              {(error as Error).message}
            </div>
            <div className="small text-muted mt-1">
              Verifique <code>/core/api/overview</code> direto no navegador — se
              demorar demais e a query for lenta, pode ser timeout de gateway.
            </div>
          </div>
        </div>
      )}

      {semDados && (
        <div className="alert alert-warning d-flex align-items-start gap-2" role="alert">
          <i className="bi bi-info-circle-fill mt-1" />
          <div>
            <strong>A consulta rodou, mas não retornou nenhuma linha.</strong>
            <div className="small mt-1">
              Provável descasamento nos joins (RAN_NODE ↔ MOBILESITE.NAME, ou
              MOBILESITE.IBGE_ID ↔ TB_AUX_INFO_MUNICIPIOS.IBGE) ou a janela de
              meses do histórico não bateu com os dados. Não é erro de código.
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="row g-3 mb-1">
        <div className="col-md-4">
          <KpiDeltaCard
            label="Volume de Tráfego"
            icon="bi bi-graph-up"
            accentColor="#003399"
            value={kpis ? fmtPb(kpis.total.volumetria_pb) : "—"}
            unit="PB"
            deltas={[
              { label: "vs Mês Ant.", pct: kpis?.total.mom_pct ?? null },
            ]}
          />
        </div>
        <div className="col-md-4">
          <KpiDeltaCard
            label="Top Município"
            icon="bi bi-geo-alt"
            accentColor="#7DC242"
            value={kpis?.top_municipio?.label ?? "—"}
            secondaryValue={kpis?.top_municipio ? `${fmtPb(kpis.top_municipio.volumetria_pb)} PB` : undefined}
            deltas={[
              { label: "vs Mês Ant.", pct: kpis?.top_municipio?.mom_pct ?? null },
            ]}
          />
        </div>
        <div className="col-md-4">
          <KpiDeltaCard
            label="Top UF"
            icon="bi bi-map"
            accentColor="#7B1FA2"
            value={kpis?.top_uf?.label ?? "—"}
            secondaryValue={kpis?.top_uf ? `${fmtPb(kpis.top_uf.volumetria_pb)} PB` : undefined}
            deltas={[
              { label: "vs Mês Ant.", pct: kpis?.top_uf?.mom_pct ?? null },
            ]}
          />
        </div>
      </div>
      {(loadingKpis) && <div className="text-muted small mb-3">Carregando KPIs...</div>}

      {/* Destaques de variação */}
      <div className="d-flex align-items-center gap-2 mt-4 mb-2">
        <i className="bi bi-graph-up-arrow" />
        <h6 className="fw-bold mb-0">
          Destaques de Variação
          {destaques?.mes_atual && (
            <small className="text-muted fw-normal ms-2">
              ({destaques.mes_atual} vs {destaques.mes_anterior})
            </small>
          )}
        </h6>
      </div>
      <div className="row g-3 mb-1">
        <div className="col-lg-3 col-md-6">
          <VariationList
            title="Top Municípios: Maior Crescimento"
            icon="bi-arrow-up-right"
            positive
            items={destaques?.municipios_alta ?? []}
          />
        </div>
        <div className="col-lg-3 col-md-6">
          <VariationList
            title="Top Municípios: Maior Queda"
            icon="bi-arrow-down-right"
            positive={false}
            items={destaques?.municipios_queda ?? []}
          />
        </div>
        <div className="col-lg-3 col-md-6">
          <VariationList
            title="Top UF: Maior Crescimento"
            icon="bi-arrow-up-right"
            positive
            items={destaques?.ufs_alta ?? []}
          />
        </div>
        <div className="col-lg-3 col-md-6">
          <VariationList
            title="Top UF: Maior Queda"
            icon="bi-arrow-down-right"
            positive={false}
            items={destaques?.ufs_queda ?? []}
          />
        </div>
      </div>
      {loadingDestaques && <div className="text-muted small mb-3">Carregando destaques...</div>}

      {/* Histórico */}
      <div className="row g-3 mt-3">
        <div className="col-12">
          <ChartPanel
            title="Histórico de Tráfego (Últimos 12 Meses)"
            subtitle="Volumetria nacional (4G+5G), com variação mês a mês"
            sourceTable="TB_AUX_INFO_MUNICIPIOS"
            height={340}
            option={trafficTrendOption(historico?.points ?? [])}
            loading={loadingHistorico}
            imageFilename="core-historico-trafego.png"
            exportSheet={{
              name: "Histórico de Tráfego",
              columns: [
                { header: "Mês", key: "label" },
                { header: "Volumetria (PB)", key: "volumetria_pb" },
                { header: "Variação MoM (%)", key: "variacao_pct" },
              ],
              rows: historico?.points ?? [],
            }}
          />
        </div>
      </div>

      {/* Mapa */}
      <div className="row g-3 mt-1">
        <div className="col-12">
          <CoreMap points={data?.geo.points ?? []} loading={loading} />
        </div>
      </div>

      {/* Rankings */}
      <div className="row g-3 mt-1">
        <div className="col-lg-6">
          <ChartPanel
            title="Top 15 Municípios por Volumetria"
            subtitle="Último mês disponível"
            sourceTable="TB_AUX_INFO_MUNICIPIOS"
            height={380}
            option={horizontalBarsOption(
              (rankMun?.items ?? []).map((i) => ({ name: i.label, value: i.value, color: "#003399" })),
              15,
            )}
            loading={loadingRankMun}
            imageFilename="core-top-municipios.png"
            exportSheet={{
              name: "Top Municípios",
              columns: [
                { header: "Município", key: "label" },
                { header: "Volumetria (PB)", key: "value" },
              ],
              rows: rankMun?.items ?? [],
            }}
          />
        </div>

        <div className="col-lg-3">
          <ChartPanel
            title="Volumetria por UF"
            subtitle="Último mês disponível"
            sourceTable="TB_AUX_INFO_MUNICIPIOS"
            height={380}
            option={horizontalBarsOption(
              (rankUf?.items ?? []).map((i) => ({ name: i.label, value: i.value, color: "#7B1FA2" })),
              15,
            )}
            loading={loadingRankUf}
            imageFilename="core-volumetria-por-uf.png"
            exportSheet={{
              name: "Volumetria por UF",
              columns: [
                { header: "UF", key: "label" },
                { header: "Volumetria (PB)", key: "value" },
              ],
              rows: rankUf?.items ?? [],
            }}
          />
        </div>

        <div className="col-lg-3">
          <ChartPanel
            title="Volumetria por Regional"
            subtitle="Clique numa barra pra filtrar o dashboard"
            sourceTable="TB_AUX_INFO_MUNICIPIOS"
            height={380}
            option={horizontalBarsOption(
              (rankRegional?.items ?? []).map((i) => ({ name: i.label, value: i.value, color: "#F5C518" })),
              15,
            )}
            loading={loadingRankRegional}
            imageFilename="core-volumetria-por-regional.png"
            onClick={(event) => toggleRegional(event.name)}
            exportSheet={{
              name: "Volumetria por Regional",
              columns: [
                { header: "Regional", key: "label" },
                { header: "Volumetria (PB)", key: "value" },
              ],
              rows: rankRegional?.items ?? [],
            }}
          />
        </div>
      </div>
    </div>
  );
}
