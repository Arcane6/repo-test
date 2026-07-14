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

  const { data: kpis, isFetching: loadingKpis } = useQuery({
    queryKey: ["core-kpis", uf, municipio, regional],
    queryFn: () => coreApi.kpis(filters),
  });

  const { data: historico, isFetching: loadingHistorico } = useQuery({
    queryKey: ["core-historico", uf, municipio, regional],
    queryFn: () => coreApi.historicoMensal(filters),
  });

  const { data: destaques, isFetching: loadingDestaques } = useQuery({
    queryKey: ["core-destaques", uf, municipio, regional],
    queryFn: () => coreApi.destaquesVariacao(filters),
  });

  const { data: rankMun, isFetching: loadingRankMun } = useQuery({
    queryKey: ["core-rank-municipios", uf, municipio, regional],
    queryFn: () => coreApi.rankingMunicipios(filters),
  });

  const { data: rankUf, isFetching: loadingRankUf } = useQuery({
    queryKey: ["core-rank-ufs", uf, municipio, regional],
    queryFn: () => coreApi.rankingUfs(filters),
  });

  const { data: rankRegional, isFetching: loadingRankRegional } = useQuery({
    queryKey: ["core-rank-regionais", uf, municipio, regional],
    queryFn: () => coreApi.rankingRegionais(filters),
  });

  return (
    <div className="container-fluid mt-4">
      <PageHeader
        icon="bi bi-hdd-network"
        title="Core"
        subtitle="Volumetria de tráfego da RAN (4G/5G) por município, UF e regional"
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Core" }]}
      />

      <CoreFilterBar />

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
              { label: "vs Ano Ant.", pct: kpis?.total.yoy_pct ?? null },
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
              { label: "vs Ano Ant.", pct: kpis?.top_municipio?.yoy_pct ?? null },
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
              { label: "vs Ano Ant.", pct: kpis?.top_uf?.yoy_pct ?? null },
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
          <CoreMap filters={filters} />
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
