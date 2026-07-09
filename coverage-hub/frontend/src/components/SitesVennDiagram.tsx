import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { summaryApi, type SummaryFilters } from "../api/summary";
import { TECH_COLORS, TECH_ORDER } from "../theme";
import { ChartToolbar } from "./ChartToolbar";
import { SourceBadge } from "./SourceBadge";
import { downloadSheet } from "../utils/excelExport";

/**
 * Diagrama de Venn de 4 conjuntos (2G/3G/4G/5G) — layout de 4 elipses
 * quase redondas, posições e raio fixos (calculados offline por amostragem
 * de pontos pra garantir que as 15 combinações não vazias fiquem visíveis,
 * com bom tamanho e rótulo legível). Substitui "Total de Sites por
 * Tecnologia": cada site cai em exatamente uma fatia (a combinação exata
 * que ele tem), sem contar o mesmo site mais de uma vez. Clicar numa
 * fatia filtra o próprio gráfico pela combinação exata daquela fatia.
 */
const ELLIPSES = [
  { tec: "2G", cx: 226.4, cy: 208.3, rot: -128.0 },
  { tec: "3G", cx: 229.2, cy: 190.3, rot: -44.0 },
  { tec: "4G", cx: 270.8, cy: 190.3, rot: 44.0 },
  { tec: "5G", cx: 273.6, cy: 208.3, rot: 128.0 },
];
const RX = 170;
const RY = 195.5;

const REGION_POSITIONS: Record<string, { x: number; y: number; bold: boolean }> = {
  only_2g: { x: 111.6, y: 321.8, bold: true },
  only_3g: { x: 125.1, y: 61.8, bold: true },
  only_4g: { x: 374.9, y: 61.8, bold: true },
  only_5g: { x: 388.4, y: 321.8, bold: true },
  i_23: { x: 82.4, y: 189.7, bold: false },
  i_24: { x: 186.1, y: 359.6, bold: false },
  i_25: { x: 250.0, y: 376.4, bold: false },
  i_34: { x: 250.0, y: 24.3, bold: false },
  i_35: { x: 313.9, y: 359.6, bold: false },
  i_45: { x: 417.6, y: 189.7, bold: false },
  i_234: { x: 131.5, y: 302.8, bold: false },
  i_235: { x: 123.6, y: 110.4, bold: false },
  i_245: { x: 376.4, y: 110.4, bold: false },
  i_345: { x: 368.5, y: 302.8, bold: false },
  i_2345: { x: 250.0, y: 199.2, bold: true },
};

/** Quais tecnologias cada fatia contém — usado pra somar o subtotal por
 * tecnologia na legenda (soma de todas as fatias que incluem aquele tec). */
const REGION_TECHS: Record<string, string[]> = {
  only_2g: ["2G"], only_3g: ["3G"], only_4g: ["4G"], only_5g: ["5G"],
  i_23: ["2G", "3G"], i_24: ["2G", "4G"], i_25: ["2G", "5G"],
  i_34: ["3G", "4G"], i_35: ["3G", "5G"], i_45: ["4G", "5G"],
  i_234: ["2G", "3G", "4G"], i_235: ["2G", "3G", "5G"],
  i_245: ["2G", "4G", "5G"], i_345: ["3G", "4G", "5G"],
  i_2345: ["2G", "3G", "4G", "5G"],
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

const fmt = (v: number) => v.toLocaleString("pt-BR");

export function SitesVennDiagram({ filters }: { filters: SummaryFilters }) {
  const { uf, municipio, ano, regionais, projetos } = filters;
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["summary-r1-sites-venn", uf, municipio, ano, regionais, projetos, selected],
    queryFn: () => summaryApi.r1SitesVenn(filters, selected),
  });

  const regions = data?.regions;

  const techTotals: Record<string, number> = {};
  for (const tec of TECH_ORDER) {
    techTotals[tec] = Object.entries(REGION_TECHS).reduce(
      (sum, [key, techs]) => sum + (techs.includes(tec) ? regions?.[key] ?? 0 : 0),
      0,
    );
  }

  function toggle(region: string) {
    setSelected((prev) => (prev === region ? null : region));
  }

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
          {selected
            ? `Filtrando por ${REGION_LABELS[selected]} — clique de novo pra limpar`
            : "Clique numa fatia pra filtrar; cada site conta uma única vez, na combinação exata que possui"}
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
              {tec}: {fmt(techTotals[tec])}
            </span>
          ))}
        </div>

        <svg
          viewBox="0 -20 500 440"
          style={{ width: "100%", height: 300 }}
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
          {Object.entries(REGION_POSITIONS).map(([key, pos]) => {
            const active = selected === key;
            return (
              <g
                key={key}
                onClick={() => toggle(key)}
                style={{ cursor: "pointer" }}
                opacity={selected && !active ? 0.4 : 1}
              >
                <title>{REGION_LABELS[key]} — clique para filtrar</title>
                {active && (
                  <circle cx={pos.x} cy={pos.y} r={26} fill="#fff" fillOpacity={0.6} stroke="#212529" strokeWidth={2} />
                )}
                <circle cx={pos.x} cy={pos.y} r={26} fill="transparent" />
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontWeight={pos.bold ? 700 : 600}
                  fontSize={pos.bold ? 15 : 12}
                >
                  {fmt(regions?.[key] ?? 0)}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="text-center small fw-bold mt-1">
          Total: {fmt(data?.total_sites ?? 0)} sites
        </div>
      </div>
    </div>
  );
}
