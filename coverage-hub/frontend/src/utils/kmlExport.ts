import type { SitesGeoPoint } from "../api/sites";

/** Escapa os 5 caracteres reservados de XML — suficiente pro texto livre
 * (nome de município, END_ID) que entra nos campos <name>/<description>. */
function xmlEscape(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Gera um KML (Google Earth/QGIS/etc.) com um Placemark por site, agrupado
 * por tecnologia em pastas — mesma cor (`TECH_COLORS`) usada no mapa.
 *
 * Exporta `.kml` puro em vez de `.kmz` (KMZ é só um KML zipado): o ganho de
 * um KMZ é só o tamanho do arquivo, e todo software que abre KMZ também
 * abre KML — não valia adicionar uma lib de zip ao bundle só por isso.
 */
export function buildKml(points: SitesGeoPoint[], docName: string): string {
  const byTech = new Map<string, SitesGeoPoint[]>();
  for (const p of points) {
    const tech = p.tech ?? "Sem tecnologia";
    if (!byTech.has(tech)) byTech.set(tech, []);
    byTech.get(tech)!.push(p);
  }

  const styles = Array.from(new Set(points.map((p) => p.color)))
    .map(
      (color) => `
    <Style id="pin-${color.replace("#", "")}">
      <IconStyle>
        <color>${toKmlColor(color)}</color>
        <scale>0.8</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
    </Style>`,
    )
    .join("");

  const folders = Array.from(byTech.entries())
    .map(([tech, pts]) => {
      const placemarks = pts
        .map(
          (p) => `
      <Placemark>
        <name>${xmlEscape(p.end_id)}</name>
        <description>${xmlEscape(`${p.municipio ?? "—"} (${p.uf ?? "—"}) · ${tech}`)}</description>
        <styleUrl>#pin-${p.color.replace("#", "")}</styleUrl>
        <Point><coordinates>${p.lon},${p.lat},0</coordinates></Point>
      </Placemark>`,
        )
        .join("");
      return `
    <Folder>
      <name>${xmlEscape(tech)} (${pts.length})</name>${placemarks}
    </Folder>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xmlEscape(docName)}</name>${styles}${folders}
  </Document>
</kml>`;
}

/** KML usa AABBGGRR (alpha primeiro, canais invertidos) — não é o mesmo
 * hex #RRGGBB usado no resto do front. */
function toKmlColor(hex: string): string {
  const clean = hex.replace("#", "");
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `ff${b}${g}${r}`;
}

export function downloadKml(filename: string, points: SitesGeoPoint[], docName: string) {
  const kml = buildKml(points, docName);
  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
