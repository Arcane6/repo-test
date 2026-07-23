import { useLayoutEffect, useRef } from "react";
import type { CellComponent, Column } from "react-datasheet-grid";

/**
 * react-datasheet-grid vem com textColumn/floatColumn/intColumn/dateColumn
 * mas não com um column de enum/select — e a maioria das colunas deste
 * módulo é um enum fechado (STATUS, TIPO_EVENTO, dimensões de camada).
 * Este column força o valor a vir da lista de opções (inclusive no paste:
 * valor colado que não bate com nenhuma opção vira null, não lixo livre).
 */
function SelectComponent({
  focus, rowData, setRowData, columnData: { options },
}: Parameters<CellComponent<string | null, { options: string[] }>>[0]) {
  const ref = useRef<HTMLSelectElement>(null);

  useLayoutEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);

  return (
    <select
      ref={ref}
      className="dsg-input"
      tabIndex={-1}
      style={{ pointerEvents: focus ? "auto" : "none", width: "100%", border: "none", background: "transparent" }}
      value={rowData ?? ""}
      onChange={(e) => setRowData(e.target.value || null)}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

export function createSelectColumn(
  options: string[],
): Partial<Column<string | null, any, string>> {
  return {
    component: SelectComponent,
    columnData: { options },
    deleteValue: () => null,
    copyValue: ({ rowData }) => rowData ?? "",
    pasteValue: ({ value }) => {
      const trimmed = value.trim();
      return options.includes(trimmed) ? trimmed : null;
    },
    isCellEmpty: ({ rowData }) => !rowData,
  };
}
