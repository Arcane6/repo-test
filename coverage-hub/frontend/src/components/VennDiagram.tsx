import { useQuery } from "@tanstack/react-query";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";

const COLOR_2G = "#1E88E5";
const COLOR_3G = "#E53935";
const COLOR_5G = "#7DC242";

const CIRCLES = [
  { cx: 180, cy: 170, color: COLOR_2G },
  { cx: 320, cy: 170, color: COLOR_3G },
  { cx: 250, cy: 280, color: COLOR_5G },
];

/**
 * Diagrama de Venn de presença 2G/3G/5G. Posições e raio são fixos (é um
 * diagrama de 3 círculos clássico, não um layout calculado) — por isso
 * dá pra desenhar em SVG puro, sem precisar de d3 no bundle.
 */
export function VennDiagram() {
  const { uf, municipio, tecnologia } = useFilterStore();

  const { data } = useQuery({
    queryKey: ["actual-venn", uf, municipio, tecnologia],
    queryFn: () => mobileAccessApi.venn({ uf, municipio, tecnologia }),
  });

  const regions = data?.regions;
  const legend = data?.legend ?? [];

  const labels = regions
    ? [
        { x: 110, y: 170, value: regions.only_2g, bold: true },
        { x: 390, y: 170, value: regions.only_3g, bold: true },
        { x: 250, y: 355, value: regions.only_5g, bold: true },
        { x: 250, y: 130, value: regions.inter_2g_3g, bold: false },
        { x: 175, y: 260, value: regions.inter_2g_5g, bold: false },
        { x: 325, y: 260, value: regions.inter_3g_5g, bold: false },
        { x: 250, y: 220, value: regions.inter_all, bold: true },
      ]
    : [];

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <h5 className="card-title mb-1">Presença nos Municípios</h5>
        <small className="text-muted d-block mb-3">
          4G retirado para simplificação: 100% dos municípios
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
          {labels.map((l) => (
            <text
              key={`${l.x}-${l.y}`}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight={l.bold ? 700 : 600}
              fontSize={l.bold ? 18 : 16}
            >
              {(l.value ?? 0).toLocaleString("pt-BR")}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
