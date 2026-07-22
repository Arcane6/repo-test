import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet.markercluster";
import { ChartToolbar } from "./ChartToolbar";
import { SourceBadge } from "./SourceBadge";
import { Skeleton } from "./Skeleton";
import { downloadSheet } from "../utils/excelExport";
import { transportApi, type TransportFilters } from "../api/transport";
import { useThemeStore } from "../theme/useThemeStore";
import { TRANSPORT_COLORS, TRANSPORT_ORDER } from "../theme";

const BRAZIL_BOUNDS: L.LatLngBoundsExpression = [
  [-33.8, -74.0],
  [5.5, -34.0],
];

/** Camadas base gratuitas, sem chave de API — mesmas do mapa de Sites. */
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
 * Sites de transporte no mapa, coloridos pela **mídia de backhaul** (base 26):
 * FO/MW/SAT/LL/SLS/RS. Mesmo wrapper imperativo do `SitesMap` (Leaflet puro
 * BSD-2 + leaflet.markercluster MIT, sem react-leaflet por licença) — um
 * cluster por mídia, cada um ligável/desligável no controle de camadas.
 */
export function TransportMap({ filters }: { filters: TransportFilters }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupsRef = useRef<Record<string, L.MarkerClusterGroup>>({});
  const theme = useThemeStore((s) => s.theme);
  const [mapInitialized, setMapInitialized] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["transport-geo-points", filters.uf, filters.municipio, filters.regional],
    queryFn: () => transportApi.geoPoints(filters),
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

    const clusterGroups: Record<string, L.MarkerClusterGroup> = {};
    for (const midia of TRANSPORT_ORDER) {
      clusterGroups[midia] = L.markerClusterGroup({ spiderfyOnMaxZoom: true, maxClusterRadius: 40 });
      clusterGroups[midia].addTo(map);
    }
    clusterGroupsRef.current = clusterGroups;

    const overlays: Record<string, L.Layer> = {};
    for (const midia of TRANSPORT_ORDER) overlays[midia] = clusterGroups[midia];
    L.control.layers(layers, overlays, { collapsed: false }).addTo(map);

    setMapInitialized(true);

    return () => {
      map.remove();
      mapRef.current = null;
      clusterGroupsRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapInitialized) return;
    const groups = clusterGroupsRef.current;
    for (const midia of TRANSPORT_ORDER) groups[midia]?.clearLayers();

    for (const p of points) {
      const group = groups[p.media];
      if (!group) continue;
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: 6,
        color: "#fff",
        weight: 1,
        fillColor: p.color,
        fillOpacity: 0.9,
      });
      const local = p.municipio ? `${p.municipio}${p.uf ? ` (${p.uf})` : ""}` : "—";
      marker.bindPopup(`<b>${local}</b><br/>${p.media} &middot; ${p.end_id}`);
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
              <h6 className="fw-bold mb-0">Sites de Transporte no Mapa</h6>
              <SourceBadge table="REL_TX_PROFILE" />
            </div>
            <small className="text-muted d-block mb-2">
              Cada ponto é um site, colorido pela mídia de backhaul (Fech. 26) — arraste,
              role pra dar zoom, use o controle no canto pra ligar/desligar mídias
            </small>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="btn-group btn-group-sm" role="group">
              <button type="button" className="btn btn-outline-secondary" onClick={flyToBrazil}>
                Brasil
              </button>
            </div>
            <ChartToolbar
              onExportData={() =>
                downloadSheet("transporte-mapa.xlsx", {
                  name: "Sites TX",
                  columns: [
                    { header: "END_ID", key: "end_id" },
                    { header: "UF", key: "uf" },
                    { header: "Município", key: "municipio" },
                    { header: "Mídia", key: "media" },
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
          {TRANSPORT_ORDER.filter((m) => m !== "Não definido").map((midia) => (
            <span key={midia} className="fw-bold d-flex align-items-center gap-1" style={{ color: TRANSPORT_COLORS[midia] }}>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: TRANSPORT_COLORS[midia],
                }}
              />
              {midia}
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
