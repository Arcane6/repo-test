import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type * as echarts from "echarts/core";
import { summaryApi, type SummaryFilters } from "../api/summary";
import { Chart } from "../charts/Chart";
import { horizontalBarsOption } from "../charts/optionBuilders";
import { ChartToolbar } from "./ChartToolbar";
import { SourceBadge } from "./SourceBadge";
import { downloadChartImage } from "../charts/exportImage";
import { downloadSheet } from "../utils/excelExport";
import { TECH_COLORS, TECH_ORDER } from "../theme";

/** Quais tecnologias cada combinação contém — usado pra somar o subtotal
 * por tecnologia (soma de todas as combinações que incluem aquele tec). */
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

const NAME_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(REGION_LABELS).map(([key, label]) => [label, key]),
);

const fmt = (v: number) => v.toLocaleString("pt-BR");

/**
 * Sites por tecnologia, em barras horizontais por combinação exata (uma
 * barra por cada uma das 15 combinações não vazias de 2G/3G/4G/5G — cada
 * site conta uma única vez, na combinação exata que possui). Clicar numa
 * barra filtra o próprio gráfico por aquela combinação; clicar de novo
 * limpa. Substitui "Total de Sites por Tecnologia".
 */
export function SitesComboChart({ filters }: { filters: SummaryFilters }) {
  const { uf, municipio, ano, regionais, projetos } = filters;
  const [selected, setSelected] = useState<string | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["summary-r1-sites-venn", uf, municipio, ano, regionais, projetos, selected],
    queryFn: () => summaryApi.r1SitesVenn(filters, selected),
  });

  const regions = data?.regions;

  const option = useMemo(() => {
    const items = Object.keys(REGION_LABELS)
      .map((key) => ({ key, name: REGION_LABELS[key], value: regions?.[key] ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .map((item) => ({
        name: item.name,
        value: item.value,
        color: selected && selected !== item.key ? "#c7d2e0" : "#003399",
      }));
    return horizontalBarsOption(items, 15);
  }, [regions, selected]);

  const techTotals: Record<string, number> = {};
  for (const tec of TECH_ORDER) {
    techTotals[tec] = Object.entries(REGION_TECHS).reduce(
      (sum, [key, techs]) => sum + (techs.includes(tec) ? regions?.[key] ?? 0 : 0),
      0,
    );
  }

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-1">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h6 className="fw-bold mb-0">Total de Sites por Tecnologia</h6>
              <SourceBadge table="TB_FT_BASE_UNICA_SITES" />
            </div>
            <small className="text-muted d-block mb-2">
              {selected
                ? `Filtrando por ${REGION_LABELS[selected]} — clique de novo pra limpar`
                : "Cada site conta uma única vez, na combinação exata que possui — clique numa barra pra filtrar"}
            </small>
          </div>
          <ChartToolbar
            onDownloadImage={() => downloadChartImage(instanceRef.current, "r1-sites-por-tecnologia.png")}
            onExportData={() =>
              downloadSheet("sites-por-tecnologia.xlsx", {
                name: "Sites por Tecnologia",
                columns: [
                  { header: "Combinação", key: "label" },
                  { header: "Sites", key: "value" },
                ],
                rows: Object.keys(REGION_LABELS).map((key) => ({
                  label: REGION_LABELS[key],
                  value: regions?.[key] ?? 0,
                })),
              })
            }
          />
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
              {tec}: {fmt(techTotals[tec])}
            </span>
          ))}
          <span className="fw-bold text-muted">Total: {fmt(data?.total_sites ?? 0)}</span>
        </div>

        <Chart
          option={option}
          loading={isFetching}
          height={340}
          instanceRef={instanceRef}
          onClick={(e) => {
            const key = NAME_TO_KEY[e.name];
            if (key) setSelected((prev) => (prev === key ? null : key));
          }}
        />
      </div>
    </div>
  );
}
