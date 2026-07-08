interface ChartToolbarProps {
  onDownloadImage?: () => void;
  onExportData?: () => void;
}

/**
 * Par de ações padrão de todo gráfico "exportável": baixar como imagem
 * (PNG, pra colar em PPTX) e exportar os dados brutos por trás dele
 * (Excel). Qualquer gráfico novo ganha isso só passando os callbacks.
 */
export function ChartToolbar({ onDownloadImage, onExportData }: ChartToolbarProps) {
  if (!onDownloadImage && !onExportData) return null;

  return (
    <div className="d-flex gap-1">
      {onDownloadImage && (
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          title="Baixar imagem (PNG) — pronta pra colar no PPTX"
          onClick={onDownloadImage}
        >
          <i className="bi bi-file-earmark-image" />
        </button>
      )}
      {onExportData && (
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          title="Exportar dados brutos (Excel)"
          onClick={onExportData}
        >
          <i className="bi bi-file-earmark-excel" />
        </button>
      )}
    </div>
  );
}
