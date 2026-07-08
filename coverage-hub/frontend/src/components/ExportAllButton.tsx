import { useState } from "react";
import { mobileAccessApi } from "../api/mobileAccess";
import { useFilterStore } from "../store/filters";
import { downloadWorkbook, type SheetSpec } from "../utils/excelExport";
import { timeseriesToRows } from "../utils/timeseries";
import { municipiosColumns, municipiosToRows } from "../utils/municipiosColumns";

/**
 * Um clique, um .xlsx com todas as abas do dashboard (respeitando os
 * filtros ativos) — a base completa, não só o que está desenhado na
 * tela. Pensado pra quem só quer "me manda os dados" sem abrir o
 * dashboard.
 */
export function ExportAllButton() {
  const { uf, municipio, tecnologia } = useFilterStore();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const filters = { uf, municipio, tecnologia };
      const [kpis, frequencies, timeseries, table] = await Promise.all([
        mobileAccessApi.kpis(filters),
        mobileAccessApi.frequencies(filters),
        mobileAccessApi.timeseries(filters),
        mobileAccessApi.table(filters),
      ]);

      const { columns: tsColumns, rows: tsRows } = timeseriesToRows(timeseries);

      const sheets: SheetSpec[] = [
        {
          name: "Resumo",
          columns: [
            { header: "Indicador", key: "label", width: 24 },
            { header: "Valor", key: "value", width: 14 },
            { header: "% do total", key: "percent", width: 14 },
          ],
          rows: kpis.cards,
        },
        {
          name: "Frequências",
          columns: [
            { header: "Tecnologia", key: "tec" },
            { header: "Banda (MHz)", key: "banda" },
            { header: "Municípios", key: "value" },
          ],
          rows: frequencies.bars,
        },
        { name: "Linha do Tempo", columns: tsColumns, rows: tsRows },
        { name: "Municípios", columns: municipiosColumns, rows: municipiosToRows(table) },
      ];

      await downloadWorkbook("cidades-base-completa.xlsx", sheets);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-primary d-flex align-items-center gap-1"
      onClick={handleExport}
      disabled={loading}
    >
      <i className="bi bi-download" />
      {loading ? "Gerando..." : "Exportar base completa"}
    </button>
  );
}
