import { useRef } from "react";
import type * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { Chart } from "../charts/Chart";
import { ChartToolbar } from "./ChartToolbar";
import { downloadChartImage } from "../charts/exportImage";
import { downloadSheet, type SheetSpec } from "../utils/excelExport";
import type { ChartClickEvent } from "../charts/types";

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  height?: number;
  option: EChartsCoreOption;
  loading?: boolean;
  onClick?: (event: ChartClickEvent) => void;
  /** Nome do arquivo de imagem (ex.: "r1-sites-por-tecnologia.png"). Omitir esconde o botão. */
  imageFilename?: string;
  /** Base bruta por trás do gráfico, pra exportar em Excel. Omitir esconde o botão. */
  exportSheet?: SheetSpec;
}

/**
 * Card padrão de gráfico do Resumo: título + toolbar de export (imagem/
 * dados) + <Chart/>. Um painel novo é só isso — nenhum boilerplate de
 * ciclo de vida do ECharts se repete aqui.
 */
export function ChartPanel({
  title,
  subtitle,
  height = 320,
  option,
  loading,
  onClick,
  imageFilename,
  exportSheet,
}: ChartPanelProps) {
  const instanceRef = useRef<echarts.ECharts | null>(null);

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-1">
          <div>
            <h6 className="fw-bold mb-1">{title}</h6>
            {subtitle && <small className="text-muted d-block mb-2">{subtitle}</small>}
          </div>
          <ChartToolbar
            onDownloadImage={
              imageFilename ? () => downloadChartImage(instanceRef.current, imageFilename) : undefined
            }
            onExportData={
              exportSheet
                ? () => downloadSheet(`${exportSheet.name.toLowerCase().replace(/\s+/g, "-")}.xlsx`, exportSheet)
                : undefined
            }
          />
        </div>
        <Chart option={option} loading={loading} height={height} instanceRef={instanceRef} onClick={onClick} />
      </div>
    </div>
  );
}
