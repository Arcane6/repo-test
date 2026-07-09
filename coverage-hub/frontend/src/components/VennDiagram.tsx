import { useQuery } from "@tanstack/react-query";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore, type VennRegionKey } from "../store/filters";
import { ChartToolbar } from "./ChartToolbar";
import { SourceBadge } from "./SourceBadge";
import { downloadSheet } from "../utils/excelExport";

const COLOR_2G = "#1E88E5";
const COLOR_3G = "#E53935";
const COLOR_5G = "#7DC242";

const CIRCLES = [
  { cx: 180, cy: 170, color: COLOR_2G },
  { cx: 320, cy: 170, color: COLOR_3G },
  { cx: 250, cy: 280, color: COLOR_5G },
];

const REGION_LABELS: Record<VennRegionKey, string> = {
  only_2g: "Somente 2G",
  only_3g: "Somente 3G",
  only_5g: "Somente 5G",
  inter_2g_3g: "2G + 3G",
  inter_2g_5g: "2G + 5G",
  inter_3g_5g: "3G + 5G",
  inter_all: "2G + 3G + 5G",
};

/**
 * Diagrama de Venn de presença 2G/3G/5G. Posições e raio são fixos (é um
 * diagrama de 3 círculos clássico, não um layout calculado) — por isso dá
 * pra desenhar em SVG puro, sem precisar de d3 no bundle. Cada região é
 * clicável: filtra o dashboard inteiro pela combinação exata daquela
 * fatia (diferente do filtro de tecnologia, que é "tem pelo menos uma").
 */
export function VennDiagram() {
  const { uf, municipio, tecnologia, vennRegion, toggleVennRegion } = useFilterStore();

  const { data } = useQuery({
    queryKey: ["actual-venn", uf, municipio, tecnologia, vennRegion],
    queryFn: () => mobileAccessApi.venn({ uf, municipio, tecnologia, vennRegion }),
  });

  const regions = data?.regions;
  const legend = data?.legend ?? [];

  const labels: { region: VennRegionKey; x: number; y: number; bold: boolean }[] = regions
    ? [
        { region: "only_2g", x: 110, y: 170, bold: true },
        { region: "only_3g", x: 390, y: 170, bold: true },
        { region: "only_5g", x: 250, y: 355, bold: true },
        { region: "inter_2g_3g", x: 250, y: 130, bold: false },
        { region: "inter_2g_5g", x: 175, y: 260, bold: false },
        { region: "inter_3g_5g", x: 325, y: 260, bold: false },
        { region: "inter_all", x: 250, y: 220, bold: true },
      ]
    : [];

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-1">
          <div className="d-flex align-items-center gap-2">
            <h5 className="card-title mb-0">Presença nos Municípios</h5>
            <SourceBadge table="MUNICIPIOS_FECHAMENTO" />
          </div>
          <ChartToolbar
            onExportData={
              regions
                ? () =>
                    downloadSheet("presenca-municipios.xlsx", {
                      name: "Presença",
                      columns: [
                        { header: "Região", key: "label" },
                        { header: "Municípios", key: "value" },
                      ],
                      rows: (Object.keys(REGION_LABELS) as VennRegionKey[]).map((key) => ({
                        label: REGION_LABELS[key],
                        value: regions[key],
                      })),
                    })
                : undefined
            }
          />
        </div>
        <small className="text-muted d-block mb-3">
          4G retirado para simplificação — 100% dos municípios · clique numa fatia pra filtrar
        </small>

        <div className="d-flex gap-3 mb-3 flex-wrap">
          {legend.map((item) => (
            <div className="small" key={item.label}>
              <div className="d-flex align-items-center gap-2 fw-bold" style={{ color: item.color }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: item.color,
                  }}
                />
                {item.label}
              </div>
              <div className="fw-bold" style={{ color: item.color }}>
                {item.value.toLocaleString("pt-BR")}
              </div>
              <div style={{ color: item.color }}>{item.percent}%</div>
            </div>
          ))}
        </div>

        <svg
          className="venn-diagram"
          viewBox="0 0 500 420"
          style={{ width: "100%", height: 420 }}
        >
          {CIRCLES.map((c) => (
            <circle
              key={c.color}
              cx={c.cx}
              cy={c.cy}
              r={130}
              fill={c.color}
              fillOpacity={0.55}
              stroke={c.color}
              strokeWidth={1}
            />
          ))}
          {labels.map((l) => {
            const active = vennRegion === l.region;
            return (
              <g
                key={l.region}
                onClick={() => toggleVennRegion(l.region)}
                style={{ cursor: "pointer" }}
                opacity={vennRegion && !active ? 0.45 : 1}
              >
                <title>{REGION_LABELS[l.region]} — clique para filtrar</title>
                {active && <circle cx={l.x} cy={l.y} r={30} fill="#fff" fillOpacity={0.55} stroke="#212529" strokeWidth={2} />}
                <circle cx={l.x} cy={l.y} r={30} fill="transparent" />
                <text
                  x={l.x}
                  y={l.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontWeight={l.bold ? 700 : 600}
                  fontSize={l.bold ? 18 : 16}
                >
                  {(regions?.[l.region] ?? 0).toLocaleString("pt-BR")}
                </text>
              </g>
            );
          })}
        </svg>

        {vennRegion && (
          <div className="d-flex justify-content-center mt-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => toggleVennRegion(vennRegion)}
            >
              <i className="bi bi-x-lg" /> Filtrando por{" "}
              <b>{REGION_LABELS[vennRegion]}</b> — limpar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
