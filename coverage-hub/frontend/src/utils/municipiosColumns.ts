import type { SheetSpec } from "./excelExport";
import type { MunicipioRow } from "../api/mobileAccess";

export const municipiosColumns: SheetSpec["columns"] = [
  { header: "IBGE", key: "ibge", width: 12 },
  { header: "UF", key: "uf", width: 10 },
  { header: "Município", key: "municipio", width: 28 },
  { header: "5G", key: "status_5g", width: 10 },
  { header: "4G", key: "status_4g", width: 10 },
  { header: "3G", key: "status_3g", width: 10 },
  { header: "2G", key: "status_2g", width: 10 },
];

/** Status já vem traduzido do backend (ex.: "EOY25", "YTD", "EOY26"); linhas
 * sem previsão para a tecnologia chegam null e viram célula vazia. */
export function municipiosToRows(rows: MunicipioRow[]) {
  return rows.map((r) => ({
    ibge: r.ibge,
    uf: r.uf,
    municipio: r.municipio,
    status_5g: r.status_5g ?? "",
    status_4g: r.status_4g ?? "",
    status_3g: r.status_3g ?? "",
    status_2g: r.status_2g ?? "",
  }));
}
