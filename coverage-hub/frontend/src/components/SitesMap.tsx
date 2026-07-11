import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { Chart } from "../charts/Chart";
import { ensureMapRegistered, isMapRegistered, type MapName } from "../charts/maps";
import { ChartToolbar } from "./ChartToolbar";
import { SourceBadge } from "./SourceBadge";
import { Skeleton } from "./Skeleton";
import { downloadChartImage } from "../charts/exportImage";
import { downloadSheet } from "../utils/excelExport";
import { sitesApi, type SitesFilters } from "../api/sites";
import { useThemeStore } from "../theme/useThemeStore";
import { TECH_COLORS, TECH_ORDER } from "../theme";

const VIEW_LABEL: Record<MapName, string> = {
  brazil: "Brasil",
  world: "Múndi",
};

const GEO_PALETTE = {
  light: { area: "#eef1f5", border: "#c9d0d9", emphasis: "#e2e7ed" },
  dark: { area: "#1f2530", border: "#3d444d", emphasis: "#262c37" },
};

/**
 * Sites individuais no mapa, coloridos pela tecnologia máxima — alterna
 * entre Brasil (visão principal) e Múndi (a TIM tem site na Antártida,
 * fora do território nacional, por isso o mapa do Brasil sozinho não
 * cobre 100% dos sites). GeoJSON estático em public/geo/ (Natural Earth
 * via world-atlas, não é CDN em runtime).
 */
export function SitesMap({ filters }: { filters: SitesFilters }) {
  const [view, setView] = useState<MapName>("brazil");
  // Checagem síncrona (não useState) — se dependesse de um estado
  // setado dentro de .then(), o render que troca `view` passaria
  // `geo.map` pro ECharts um ciclo antes do registro terminar e
  // quebraria (mapa "not exists"). O tick só existe pra forçar
  // re-render quando o registro assíncrono termina.
  const mapReady = isMapRegistered(view);
  const [, forceRerender] = useState(0);
  const theme = useThemeStore((s) => s.theme);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (mapReady) return;
    let cancelled = false;
    ensureMapRegistered(view).then(() => {
      if (!cancelled) forceRerender((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [view, mapReady]);

  const { data, isFetching } = useQuery({
    queryKey: ["sites-geo-points", filters.uf, filters.municipio],
    queryFn: () => sitesApi.geoPoints(filters),
  });

  const points = data?.points ?? [];
  const palette = GEO_PALETTE[theme];
  const loading = isFetching || !mapReady;

  // Uma série por tecnologia (cor fixa por série), não itemStyle por
  // ponto — no modo `large` (obrigatório aqui, pode ter dezenas de
  // milhares de sites) o ECharts ignora itemStyle individual e pinta
  // tudo com uma cor só. Agrupar por tech também dá um bônus de graça:
  // dá pra usar a legend nativa pra ligar/desligar tecnologia.
  const pointsByTech = new Map<string, typeof points>();
  for (const p of points) {
    const key = p.tech ?? "—";
    const bucket = pointsByTech.get(key);
    if (bucket) bucket.push(p);
    else pointsByTech.set(key, [p]);
  }

  const option: EChartsCoreOption = mapReady
    ? {
        tooltip: {
          trigger: "item",
          formatter: (p: unknown) => {
            const d = p as { seriesName?: string; data?: { name?: string } };
            return `<b>${d.data?.name ?? "Site"}</b><br/>${d.seriesName ?? "—"}`;
          },
        },
        geo: {
          map: view,
          roam: true,
          itemStyle: {
            areaColor: palette.area,
            borderColor: palette.border,
          },
          emphasis: {
            itemStyle: { areaColor: palette.emphasis },
            label: { show: false },
          },
        },
        series: TECH_ORDER.filter((tec) => pointsByTech.has(tec)).map((tec) => ({
          name: tec,
          type: "scatter",
          coordinateSystem: "geo",
          symbolSize: view === "brazil" ? 5 : 3,
          large: true,
          largeThreshold: 500,
          itemStyle: { color: TECH_COLORS[tec] },
          data: (pointsByTech.get(tec) ?? []).map((p) => ({
            name: `${p.municipio ?? "Fora do Brasil"}${p.uf ? ` (${p.uf})` : ""}`,
            value: [p.lon, p.lat],
          })),
        })),
      }
    : {};

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-1 flex-wrap gap-2">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h6 className="fw-bold mb-0">Sites no Mapa</h6>
              <SourceBadge table="TB_FT_BASE_UNICA_SITES" />
            </div>
            <small className="text-muted d-block mb-2">
              Cada ponto é um site, colorido pela tecnologia máxima — arraste pra
              mover, role pra dar zoom
            </small>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="btn-group btn-group-sm" role="group">
              {(Object.keys(VIEW_LABEL) as MapName[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn ${view === v ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setView(v)}
                >
                  {VIEW_LABEL[v]}
                </button>
              ))}
            </div>
            <ChartToolbar
              onDownloadImage={() => downloadChartImage(instanceRef.current, `sites-mapa-${view}.png`)}
              onExportData={() =>
                downloadSheet(`sites-mapa-${view}.xlsx`, {
                  name: "Sites",
                  columns: [
                    { header: "END_ID", key: "end_id" },
                    { header: "UF", key: "uf" },
                    { header: "Município", key: "municipio" },
                    { header: "Tecnologia", key: "tech" },
                    { header: "Latitude", key: "lat" },
                    { header: "Longitude", key: "lon" },
                  ],
                  rows: points,
                })
              }
            />
          </div>
        </div>

        <div className="d-flex justify-content-center gap-3 mb-2 flex-wrap small">
          {TECH_ORDER.map((tec) => (
            <span key={tec} className="fw-bold d-flex align-items-center gap-1" style={{ color: TECH_COLORS[tec] }}>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: TECH_COLORS[tec],
                }}
              />
              {tec}
            </span>
          ))}
        </div>

        {loading && Object.keys(option).length === 0 ? (
          <div style={{ height: 420 }} className="d-flex flex-column justify-content-center gap-2 px-2 pb-2">
            <Skeleton height="90%" radius={8} />
          </div>
        ) : (
          <Chart option={option} loading={loading} height={420} instanceRef={instanceRef} />
        )}
      </div>
    </div>
  );
}
