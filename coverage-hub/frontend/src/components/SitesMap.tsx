import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet.markercluster";
import { ChartToolbar } from "./ChartToolbar";
import { SourceBadge } from "./SourceBadge";
import { Skeleton } from "./Skeleton";
import { downloadSheet } from "../utils/excelExport";
import { sitesApi, type SitesFilters } from "../api/sites";
import { useThemeStore } from "../theme/useThemeStore";
import { TECH_COLORS, TECH_ORDER } from "../theme";

const BRAZIL_BOUNDS: L.LatLngBoundsExpression = [
  [-33.8, -74.0],
  [5.5, -34.0],
];

/** Camadas base gratuitas, sem chave de API — cada uma com atribuição
 * correta (obrigatória nos termos de uso de todas as três). */
function baseLayers() {
  return {
    Ruas: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }),
    Satélite: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles &copy; Esri", maxZoom: 19 },
    ),
    Escuro: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    }),
  };
}

/**
 * Sites individuais no mapa, com tiles de verdade (ruas/satélite/escuro,
 * todas gratuitas e sem chave de API) em vez do contorno estático do
 * ECharts. Usa Leaflet puro (BSD-2-Clause) + leaflet.markercluster
 * (MIT) via wrapper imperativo — mesmo padrão de `charts/Chart.tsx` pro
 * ECharts. Evitado de propósito o `react-leaflet` (licença
 * Hippocratic-2.1, não é OSS permissiva de verdade, teria efeito
 * colateral legal numa ferramenta corporativa sem revisão jurídica).
 * Um `L.markerClusterGroup` por tecnologia — cada um é uma camada que o
 * usuário liga/desliga no controle de camadas.
 */
export function SitesMap({ filters }: { filters: SitesFilters }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupsRef = useRef<Record<string, L.MarkerClusterGroup>>({});
  const layersControlRef = useRef<L.Control.Layers | null>(null);
  const theme = useThemeStore((s) => s.theme);
  const [mapInitialized, setMapInitialized] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["sites-geo-points", filters.uf, filters.municipio],
    queryFn: () => sitesApi.geoPoints(filters),
  });
  const points = data?.points ?? [];

  // Cria o mapa uma única vez — mesmo ciclo de vida do <Chart/>
  // (init no mount, dispose no unmount), independente de dado/tema.
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

    const clusterGroups: Record<string, L.MarkerClusterGroup> = {};
    for (const tec of TECH_ORDER) {
      clusterGroups[tec] = L.markerClusterGroup({ spiderfyOnMaxZoom: true, maxClusterRadius: 40 });
      clusterGroups[tec].addTo(map);
    }
    clusterGroupsRef.current = clusterGroups;

    const overlays: Record<string, L.Layer> = {};
    for (const tec of TECH_ORDER) overlays[tec] = clusterGroups[tec];
    layersControlRef.current = L.control.layers(layers, overlays, { collapsed: false }).addTo(map);

    setMapInitialized(true);

    return () => {
      map.remove();
      mapRef.current = null;
      layersControlRef.current = null;
      clusterGroupsRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repovoa os clusters quando o dado muda (filtro novo, etc.).
  useEffect(() => {
    if (!mapInitialized) return;
    const groups = clusterGroupsRef.current;
    for (const tec of TECH_ORDER) groups[tec]?.clearLayers();

    for (const p of points) {
      const tec = p.tech ?? "";
      const group = groups[tec];
      if (!group) continue;
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: 6,
        color: "#fff",
        weight: 1,
        fillColor: p.color,
        fillOpacity: 0.9,
      });
      const local = p.municipio ? `${p.municipio}${p.uf ? ` (${p.uf})` : ""}` : "Fora do Brasil";
      marker.bindPopup(`<b>${local}</b><br/>${tec} &middot; ${p.end_id}`);
      group.addLayer(marker);
    }
  }, [points, mapInitialized]);

  function flyToBrazil() {
    mapRef.current?.fitBounds(BRAZIL_BOUNDS);
  }
  function flyToWorld() {
    mapRef.current?.setView([10, 0], 2);
  }

  const loading = isFetching && points.length === 0;

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
              Cada ponto é um site, colorido pela tecnologia máxima — arraste, role pra
              dar zoom, use o controle no canto pra trocar de camada
            </small>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="btn-group btn-group-sm" role="group">
              <button type="button" className="btn btn-outline-secondary" onClick={flyToBrazil}>
                Brasil
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={flyToWorld}>
                Múndi
              </button>
            </div>
            <ChartToolbar
              onExportData={() =>
                downloadSheet("sites-mapa.xlsx", {
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
