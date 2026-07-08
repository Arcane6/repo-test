import type ExcelJS from "exceljs";
import { TIM_BRAND_COLOR } from "../theme";

export interface SheetSpec {
  name: string;
  columns: { header: string; key: string; width?: number }[];
  rows: object[];
}

const BRAND_ARGB = "FF" + TIM_BRAND_COLOR.replace("#", "").toUpperCase();

function styleHeader(worksheet: ExcelJS.Worksheet, columnCount: number) {
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_ARGB } };
  header.alignment = { vertical: "middle" };
  header.height = 20;

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnCount },
  };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
}

async function buildWorkbook(sheets: SheetSpec[]) {
  // Import dinâmico: ExcelJS só entra no bundle de quem realmente clica em
  // "exportar" — a maioria de quem só olha o dashboard nunca paga esse custo.
  const { default: ExcelJS } = await import("exceljs");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TIM Technical Planning";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.columns = sheet.columns.map((c) => ({ ...c, width: c.width ?? 18 }));
    worksheet.addRows(sheet.rows);
    styleHeader(worksheet, sheet.columns.length);
  }

  return workbook;
}

function triggerDownload(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Exporta um único conjunto de dados (a base bruta de um gráfico/tabela) para .xlsx. */
export async function downloadSheet(filename: string, sheet: SheetSpec) {
  const workbook = await buildWorkbook([sheet]);
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, filename);
}

/** Exporta várias abas (ex.: "exportar base completa do dashboard") num único .xlsx. */
export async function downloadWorkbook(filename: string, sheets: SheetSpec[]) {
  const workbook = await buildWorkbook(sheets);
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, filename);
}
