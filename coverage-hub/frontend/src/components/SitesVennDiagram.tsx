import { useQuery } from "@tanstack/react-query";
import { summaryApi, type SummaryFilters } from "../api/summary";
import { TECH_COLORS, TECH_ORDER } from "../theme";
import { ChartToolbar } from "./ChartToolbar";
import { SourceBadge } from "./SourceBadge";
import { downloadSheet } from "../utils/excelExport";

/**
 * Diagrama de Venn de 4 conjuntos (2G/3G/4G/5G) — layout de 4 elipses
 * clássico, posições e raio fixos (calculados offline por amostragem de
 * pontos pra garantir que as 15 combinações não vazias fiquem visíveis e
 * com rótulo legível). Substitui "Total de Sites por Tecnologia": cada
 * site cai em exatamente uma fatia (a combinação exata que ele tem), sem
 * contar o mesmo site mais de uma vez.
 */
const ELLIPSES = [
  { tec: "2G", cx: 166.6, cy: 205.1, rot: -112.0 },
  { tec: "3G", cx: 194.0, cy: 189.4, rot: -38.5 },
  { tec: "4G", cx: 306.0, cy: 189.4, rot: 38.5 },
  { tec: "5G", cx: 333.4, cy: 205.1, rot: 112.0 },
];
const RX = 130;
const RY = 220;

const REGION_POSITIONS: Record<string, { x: number; y: number; bold: boolean }> = {
  only_2g: { x: 36.1, y: 268.8, bold: true },
  only_3g: { x: 124.3, y: 76.7, bold: true },
  only_4g: { x: 375.7, y: 76.7, bold: true },
  only_5g: { x: 463.9, y: 268.8, bold: true },
  i_23: { x: 98.8, y: 178.9, bold: false },
  i_24: { x: 153.7, y: 335.8, bold: false },
  i_25: { x: 250.0, y: 59.8, bold: false },
  i_34: { x: 250.0, y: 345.3, bold: false },
  i_35: { x: 346.3, y: 335.8, bold: false },
  i_45: { x: 401.2, y: 178.9, bold: false },
  i_234: { x: 176.0, y: 292.8, bold: false },
  i_235: { x: 168.8, y: 124.1, bold: false },
  i_245: { x: 331.2, y: 124.1, bold: false },
  i_345: { x: 324.0, y: 292.8, bold: false },
  i_2345: { x: 250.0, y: 193.5, bold: true },
};

const REGION_LABELS: Record<string, string> = {
  only_2g: "Somente 2G",
  only_3g: "Somente 3G",
  only_4g: "Somente 4G",
  only_5g: "Somente 5G",
  i_23: "2G + 3G",
  i_24: "2G + 4G",
  i_25: "2G + 5G",
  i_34: "3G + 4G",
  i_35: "3G + 5G",
  i_45: "4G + 5G",
  i_234: "2G + 3G + 4G",
  i_235: "2G + 3G + 5G",
  i_245: "2G + 4G + 5G",
  i_345: "3G + 4G + 5G",
  i_2345: "2G + 3G + 4G + 5G",
};

export function SitesVennDiagram({ filters }: { filters: SummaryFilters }) {
  const { uf, municipio, ano, regionais, projetos } = filters;

  const { data, isFetching } = useQuery({
    queryKey: ["summary-r1-sites-venn", uf, municipio, ano, regionais, projetos],
    queryFn: () => summaryApi.r1SitesVenn(filters),
  });

  const regions = data?.regions;

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-1">
          <div className="d-flex align-items-center gap-2">
            <h6 className="fw-bold mb-0">Total de Sites por Tecnologia</h6>
            <SourceBadge table="TB_FT_BASE_UNICA_SITES" />
          </div>
          <ChartToolbar
            onExportData={
              regions
                ? () =>
                    downloadSheet("sites-por-tecnologia.xlsx", {
                      name: "Sites por Tecnologia",
                      columns: [
                        { header: "Combinação", key: "label" },
                        { header: "Sites", key: "value" },
                      ],
                      rows: Object.keys(REGION_LABELS).map((key) => ({
                        label: REGION_LABELS[key],
                        value: regions[key] ?? 0,
                      })),
                    })
                : undefined
            }
          />
        </div>
        <small className="text-muted d-block mb-2">
          Cada site conta uma única vez, na combinação exata de tecnologias que possui
        </small>

        <div className="d-flex justify-content-center gap-3 mb-2 flex-wrap">
          {TECH_ORDER.map((tec) => (
            <span key={tec} className="small fw-bold d-flex align-items-center gap-1" style={{ color: TECH_COLORS[tec] }}>
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

        <svg
          viewBox="-120 -50 700 500"
          style={{ width: "100%", height: 320 }}
          opacity={isFetching ? 0.5 : 1}
        >
          {ELLIPSES.map((e) => (
            <ellipse
              key={e.tec}
              cx={e.cx}
              cy={e.cy}
              rx={RX}
              ry={RY}
              transform={`rotate(${e.rot} ${e.cx} ${e.cy})`}
              fill={TECH_COLORS[e.tec]}
              fillOpacity={0.4}
              stroke={TECH_COLORS[e.tec]}
              strokeWidth={1.5}
            />
          ))}
          {Object.entries(REGION_POSITIONS).map(([key, pos]) => (
            <text
              key={key}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight={pos.bold ? 700 : 600}
              fontSize={pos.bold ? 15 : 12}
            >
              <title>{REGION_LABELS[key]}</title>
              {(regions?.[key] ?? 0).toLocaleString("pt-BR")}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
