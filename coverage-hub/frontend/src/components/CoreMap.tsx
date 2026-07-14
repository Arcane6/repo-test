import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { ChartToolbar } from "./ChartToolbar";
import { SourceBadge } from "./SourceBadge";
import { Skeleton } from "./Skeleton";
import { downloadSheet } from "../utils/excelExport";
import { coreApi, type CoreFilters } from "../api/core";
import { useThemeStore } from "../theme/useThemeStore";

const BRAZIL_BOUNDS: L.LatLngBoundsExpression = [
  [-33.8, -74.0],
  [5.5, -34.0],
];

function baseLayers() {
  return {
    Ruas: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }),
    Escuro: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    }),
  };
}

/** Interpola entre dois tons de azul (marca TIM) conforme a intensidade
 * (0..1) — sem precisar de lib de heatmap externa: raio + cor graduados
 * pela volumetria já lêem como "calor" geográfico. */
function intensityColor(t: number): string {
  const from = { r: 0xbb, g: 0xd6, b: 0xff };
  const to = { r: 0x00, g: 0x1a, b: 0x66 };
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Mapa de calor de volumetria por município — bolhas graduadas (raio +
 * cor proporcionais ao tráfego), não um heatmap de kernel-density: dá a
 * mesma leitura visual de "onde está o volume" sem precisar de mais uma
 * lib externa (`leaflet.heat` é uma opção rápida de evoluir depois, se
 * quiser o gradiente contínuo).
 */
export function CoreMap({ filters }: { filters: CoreFilters }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const theme = useThemeStore((s) => s.theme);
  const [mapInitialized, setMapInitialized] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["core-geo-points", filters.uf, filters.municipio],
    queryFn: () => coreApi.geoPoints(filters),
  });
  const points = data?.points ?? [];

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-14.2, -51.9],
      zoom: 4,
      worldCopyJump: true,
    });
    mapRef.current = map;

    const layers = baseLayers();
    const defaultLayer = theme === "dark" ? layers.Escuro : layers.Ruas;
    defaultLayer.addTo(map);
    L.control.layers(layers, undefined, { collapsed: true }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerRef.current = layerGroup;

    setMapInitialized(true);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInitialized) return;
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();

    if (points.length === 0) return;
    const max = Math.max(...points.map((p) => p.volumetria_pb));
    const min = Math.min(...points.map((p) => p.volumetria_pb));
    const range = max - min || 1;

    for (const p of points) {
      const t = (p.volumetria_pb - min) / range;
      const radius = 3 + Math.sqrt(t) * 22;
      const marker = L.circleMarker([p.lat, p.lon], {
        radius,
        color: "#fff",
        weight: 1,
        fillColor: intensityColor(t),
        fillOpacity: 0.75,
      });
      marker.bindPopup(
        `<b>${p.municipio} (${p.uf})</b><br/>${p.volumetria_pb.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} PB${
          p.regional ? `<br/><span style="opacity:0.7">${p.regional}</span>` : ""
        }`,
      );
      group.addLayer(marker);
    }
  }, [points, mapInitialized]);

  function flyToBrazil() {
    mapRef.current?.fitBounds(BRAZIL_BOUNDS);
  }

  const loading = isFetching && points.length === 0;

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-1 flex-wrap gap-2">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h6 className="fw-bold mb-0">Volumetria de Tráfego no Mapa</h6>
              <SourceBadge table="TB_AUX_INFO_MUNICIPIOS" />
            </div>
            <small className="text-muted d-block mb-2">
              Bolha maior/mais escura = mais tráfego no município (último mês)
            </small>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={flyToBrazil}>
              Brasil
            </button>
            <ChartToolbar
              onExportData={() =>
                downloadSheet("core-volumetria-mapa.xlsx", {
                  name: "Volumetria",
                  columns: [
                    { header: "Município", key: "municipio" },
                    { header: "UF", key: "uf" },
                    { header: "Regional", key: "regional" },
                    { header: "Volumetria (PB)", key: "volumetria_pb" },
                  ],
                  rows: points,
                })
              }
            />
          </div>
        </div>

        {loading && (
          <div style={{ position: "absolute", inset: "70px 20px auto 20px", zIndex: 500 }}>
            <Skeleton height={420} radius={8} />
          </div>
        )}
        <div ref={containerRef} style={{ width: "100%", height: 420, opacity: loading ? 0 : 1 }} />
      </div>
    </div>
  );
}
