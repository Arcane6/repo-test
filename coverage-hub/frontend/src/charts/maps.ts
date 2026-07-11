import * as echarts from "echarts/core";

/**
 * GeoJSON estático (não CDN em runtime — servido junto com o resto do
 * build, igual ícones do Bootstrap). Gerado a partir de world-atlas +
 * topojson-client (Natural Earth, licença ISC) — ver CLAUDE.md pra
 * detalhes de origem/licença.
 */
const MAP_FILES = {
  brazil: "brazil.geo.json",
  world: "world-110m.geo.json",
} as const;

export type MapName = keyof typeof MAP_FILES;

const registered = new Set<MapName>();
const pending = new Map<MapName, Promise<void>>();

/** Checagem síncrona — usar pra decidir o `option` no mesmo render em
 * que `view` muda. Um `useState` setado dentro de `.then()` chega um
 * render atrasado: o componente montaria `geo.map` apontando pro mapa
 * novo antes do registro terminar, e o ECharts quebra tentando ler um
 * mapa que ainda não existe. */
export function isMapRegistered(name: MapName): boolean {
  return registered.has(name);
}

/** Busca e registra o GeoJSON de um mapa no ECharts sob demanda — só uma
 * vez por nome, mesmo que vários componentes peçam ao mesmo tempo. */
export function ensureMapRegistered(name: MapName): Promise<void> {
  if (registered.has(name)) return Promise.resolve();

  const inFlight = pending.get(name);
  if (inFlight) return inFlight;

  const url = `${import.meta.env.BASE_URL}geo/${MAP_FILES[name]}`;
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Falha ao carregar mapa ${name}: HTTP ${res.status}`);
      return res.json();
    })
    .then((geoJson) => {
      echarts.registerMap(name, geoJson);
      registered.add(name);
    })
    .finally(() => {
      pending.delete(name);
    });

  pending.set(name, promise);
  return promise;
}
