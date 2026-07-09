import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsCoreOption } from "echarts/core";
import { ChartPanel } from "./ChartPanel";
import { stackedBarsOption } from "../charts/optionBuilders";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";

/**
 * Presença 2G/3G/5G por município, em barras horizontais empilhadas: para
 * cada tecnologia, quanto dela é exclusiva, quanto se sobrepõe com só
 * outra e quanto está presente nas três ao mesmo tempo. Substitui o
 * diagrama de Venn em SVG — mesma informação (as 7 regiões), mais fácil
 * de ler e de exportar.
 */
export function VennDiagram() {
  const { uf, municipio, tecnologia } = useFilterStore();

  const { data, isFetching } = useQuery({
    queryKey: ["actual-venn", uf, municipio, tecnologia],
    queryFn: () => mobileAccessApi.venn({ uf, municipio, tecnologia }),
  });

  const regions = data?.regions;

  const option: EChartsCoreOption = useMemo(() => {
    if (!regions) {
      if (isFetching) return {};
      return {
        title: {
          text: "Sem dados para os filtros selecionados",
          left: "center",
          top: "center",
          textStyle: { color: "#999", fontSize: 14, fontWeight: "normal" },
        },
      };
    }

    const categories = ["2G", "3G", "5G"];
    return stackedBarsOption(
      categories,
      [
        {
          name: "Exclusiva",
          color: "#1E88E5",
          data: [regions.only_2g, regions.only_3g, regions.only_5g],
        },
        {
          name: "Sobreposta com 1 outra",
          color: "#F5C518",
          data: [
            regions.inter_2g_3g + regions.inter_2g_5g,
            regions.inter_2g_3g + regions.inter_3g_5g,
            regions.inter_2g_5g + regions.inter_3g_5g,
          ],
        },
        {
          name: "Nas três tecnologias",
          color: "#7DC242",
          data: [regions.inter_all, regions.inter_all, regions.inter_all],
        },
      ],
      { horizontal: true },
    );
  }, [regions, isFetching]);

  return (
    <ChartPanel
      title="Presença nos Municípios"
      subtitle="4G retirado para simplificação — 100% dos municípios"
      sourceTable="MUNICIPIOS_FECHAMENTO"
      option={option}
      loading={isFetching}
      height={340}
      imageFilename="presenca-municipios.png"
      exportSheet={
        regions
          ? {
              name: "Presença",
              columns: [
                { header: "Região", key: "label" },
                { header: "Municípios", key: "value" },
              ],
              rows: [
                { label: "Somente 2G", value: regions.only_2g },
                { label: "Somente 3G", value: regions.only_3g },
                { label: "Somente 5G", value: regions.only_5g },
                { label: "2G + 3G", value: regions.inter_2g_3g },
                { label: "2G + 5G", value: regions.inter_2g_5g },
                { label: "3G + 5G", value: regions.inter_3g_5g },
                { label: "2G + 3G + 5G", value: regions.inter_all },
              ],
            }
          : undefined
      }
    />
  );
}
