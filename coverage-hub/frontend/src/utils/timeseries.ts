import type { TimeseriesResponse } from "../api/mobileAccess";

/**
 * Converte a série (períodos x tecnologias) num formato "largo" — uma
 * linha por período, uma coluna por tecnologia — que é como um executivo
 * espera ver isso numa planilha, e não o formato longo que o gráfico usa.
 */
export function timeseriesToRows(data: TimeseriesResponse) {
  const columns = [
    { header: "Período", key: "periodo" },
    ...data.series.map((s) => ({ header: s.tec, key: s.tec })),
  ];

  const rows = data.periods.map((periodo, i) => {
    const row: Record<string, unknown> = { periodo: periodo.slice(0, 7) };
    for (const s of data.series) {
      row[s.tec] = s.values[i] ?? 0;
    }
    return row;
  });

  return { columns, rows };
}
