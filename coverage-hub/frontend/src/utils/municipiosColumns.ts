import type { SheetSpec } from "./excelExport";
import type { MunicipioRow } from "../api/mobileAccess";

export const municipiosColumns: SheetSpec["columns"] = [
  { header: "UF", key: "uf", width: 10 },
  { header: "Município", key: "municipio", width: 28 },
  { header: "TIM", key: "presenca", width: 10 },
  { header: "5G", key: "presenca_5g", width: 10 },
  { header: "4G", key: "presenca_4g", width: 10 },
  { header: "3G", key: "presenca_3g", width: 10 },
  { header: "2G", key: "presenca_2g", width: 10 },
];

/** Troca 0/1 por Sim/Não — mais legível numa planilha do que binário cru. */
export function municipiosToRows(rows: MunicipioRow[]) {
  return rows.map((r) => ({
    uf: r.uf,
    municipio: r.municipio,
    presenca: r.presenca ? "Sim" : "Não",
    presenca_5g: r.presenca_5g ? "Sim" : "Não",
    presenca_4g: r.presenca_4g ? "Sim" : "Não",
    presenca_3g: r.presenca_3g ? "Sim" : "Não",
    presenca_2g: r.presenca_2g ? "Sim" : "Não",
  }));
}
