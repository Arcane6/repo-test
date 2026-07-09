import { useRef } from "react";
import type * as echarts from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { Chart } from "../charts/Chart";
import { ChartToolbar } from "./ChartToolbar";
import { Skeleton } from "./Skeleton";
import { downloadChartImage } from "../charts/exportImage";
import { downloadSheet, type SheetSpec } from "../utils/excelExport";
import type { ChartClickEvent } from "../charts/types";
import { SourceBadge } from "./SourceBadge";

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
  /** Tabela(s)-fonte do gráfico — mostra o badge "de onde vem esse número" ao lado do título. */
  sourceTable?: string | string[];
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
  sourceTable,
}: ChartPanelProps) {
  const instanceRef = useRef<echarts.ECharts | null>(null);

  // Sem dado nenhum ainda (primeira carga) — mostra esqueleto no lugar
  // do canvas em vez de um gráfico vazio piscando. Num refetch (filtro
  // mudou mas já existe opção anterior), deixa o <Chart/> lidar com o
  // loading discreto do próprio ECharts, sem trocar de layout.
  const isFirstLoad = loading && Object.keys(option).length === 0;

  return (
    <div className="card shadow-sm h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-1">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h6 className="fw-bold mb-0">{title}</h6>
              {sourceTable && <SourceBadge table={sourceTable} />}
            </div>
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
        {isFirstLoad ? (
          <div style={{ height }} className="d-flex flex-column justify-content-end gap-2 px-2 pb-2">
            <Skeleton height="65%" radius={4} />
            <Skeleton height={12} width="40%" />
          </div>
        ) : (
          <Chart option={option} loading={loading} height={height} instanceRef={instanceRef} onClick={onClick} />
        )}
      </div>
    </div>
  );
}
