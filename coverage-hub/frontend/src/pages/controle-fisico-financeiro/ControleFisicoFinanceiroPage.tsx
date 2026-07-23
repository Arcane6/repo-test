import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import {
  DataSheetGrid,
  keyColumn,
  textColumn,
  floatColumn,
  isoDateColumn,
  createTextColumn,
  type Column,
} from "react-datasheet-grid";
import "react-datasheet-grid/dist/style.css";
import {
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import { PageHeader } from "../../components/PageHeader";
import { themedSelectStyles } from "../../components/selectStyles";
import { createSelectColumn } from "../../components/datasheetSelectColumn";
import { mobileAccessApi } from "../../api/mobileAccess";
import {
  controleFisicoFinanceiroApi,
  type Camada,
  type EventoRow,
  type NovoEvento,
} from "../../api/controleFisicoFinanceiro";
import { useControleFisicoFinanceiroFilterStore } from "../../store/controleFisicoFinanceiroFilters";

const REGIONAIS = ["TSP", "TSL", "TNE", "TLE", "TRJ", "TCO", "TNO"];

// intColumn/floatColumn agrupam milhar (1,250,000) — bom pra valor, ruim pra
// ano (2,026). Ano não usa separador de milhar.
const yearColumn = createTextColumn<number | null>({
  alignRight: true,
  formatBlurredInput: (value) => (typeof value === "number" ? String(value) : ""),
  parseUserInput: (value) => {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  },
  parsePastedValue: (value) => {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  },
});

/** Uma linha da grid — igual ao EventoRow do backend, mais uma `_key`
 * (identidade estável no client, inclusive antes de existir item_id). */
interface GridRow {
  _key: string;
  item_id: string | null;
  projeto: string | null;
  ano_plano: number | null;
  uf: string | null;
  municipio: string | null;
  regional: string | null;
  dimensao_1: string | null;
  dimensao_2: string | null;
  status: string | null;
  data_planejada: string | null;
  data_realizada: string | null;
  valor_planejado: number | null;
  valor_realizado: number | null;
  tipo_evento: string | null;
  observacao: string | null;
}

let tempKeySeq = 0;
function nextTempKey() {
  tempKeySeq += 1;
  return `novo-${Date.now()}-${tempKeySeq}`;
}

function toGridRow(r: EventoRow): GridRow {
  return {
    _key: r.item_id,
    item_id: r.item_id,
    projeto: r.projeto,
    ano_plano: r.ano_plano,
    uf: r.uf,
    municipio: r.municipio,
    regional: r.regional,
    dimensao_1: r.dimensao_1,
    dimensao_2: r.dimensao_2,
    status: r.status,
    data_planejada: r.data_planejada ? r.data_planejada.slice(0, 10) : null,
    data_realizada: r.data_realizada ? r.data_realizada.slice(0, 10) : null,
    valor_planejado: r.valor_planejado,
    valor_realizado: r.valor_realizado,
    tipo_evento: null, // sempre em branco: é o tipo do PRÓXIMO evento, não do último
    observacao: null,
  };
}

function emptyRow(): GridRow {
  return {
    _key: nextTempKey(),
    item_id: null,
    projeto: null,
    ano_plano: null,
    uf: null,
    municipio: null,
    regional: null,
    dimensao_1: null,
    dimensao_2: null,
    status: null,
    data_planejada: null,
    data_realizada: null,
    valor_planejado: null,
    valor_realizado: null,
    tipo_evento: null,
    observacao: null,
  };
}

function rowsDiffer(a: GridRow, b: GridRow): boolean {
  const keys: (keyof GridRow)[] = [
    "projeto", "ano_plano", "uf", "municipio", "regional", "dimensao_1", "dimensao_2",
    "status", "data_planejada", "data_realizada", "valor_planejado", "valor_realizado",
    "tipo_evento", "observacao",
  ];
  return keys.some((k) => a[k] !== b[k]);
}

/**
 * Controle Físico-Financeiro — grid estilo Excel (react-datasheet-grid: colar,
 * arrastar/preencher, copiar) com filtragem complexa por coluna (TanStack
 * Table, só o motor de filtro — a grade visual é o DataSheetGrid). Cada
 * edição salva vira um EVENTO NOVO (INSERT) no backend, nunca um UPDATE —
 * o histórico completo de cada item fica intacto pra auditoria.
 */
export function ControleFisicoFinanceiroPage() {
  const queryClient = useQueryClient();
  const {
    camada, uf, municipio, regional, projeto, status, anoPlano,
    setCamada, setValues, setAnoPlano, clear,
  } = useControleFisicoFinanceiroFilterStore();

  const multi = themedSelectStyles<{ value: string; label: string }, true>();
  const geoFilters = useMemo(
    () => ({ uf, municipio, regional, projeto, status, ano_plano: anoPlano }),
    [uf, municipio, regional, projeto, status, anoPlano],
  );

  const { data: camadasMeta } = useQuery({
    queryKey: ["cff-camadas"],
    queryFn: controleFisicoFinanceiroApi.camadas,
  });
  const { data: ufOptions = [] } = useQuery({ queryKey: ["actual-ufs"], queryFn: mobileAccessApi.ufs });
  const { data: opcoes } = useQuery({
    queryKey: ["cff-opcoes", camada],
    queryFn: () => controleFisicoFinanceiroApi.opcoes(camada),
  });

  const { data: atual, isFetching } = useQuery({
    queryKey: ["cff-atual", camada, geoFilters],
    queryFn: () => controleFisicoFinanceiroApi.estadoAtual(camada, geoFilters),
  });

  const meta = camadasMeta?.camadas.find((c) => c.key === camada);

  const [rows, setRows] = useState<GridRow[]>([]);
  const originalRef = useRef<Map<string, GridRow>>(new Map());
  const [usuario, setUsuario] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    const loaded = (atual?.rows ?? []).map(toGridRow);
    setRows(loaded);
    originalRef.current = new Map(loaded.map((r) => [r._key, r]));
  }, [atual]);

  // ---- Filtragem complexa por coluna (TanStack Table como motor só) ----
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const tableColumns = useMemo<ColumnDef<GridRow>[]>(
    () => [
      { accessorKey: "dimensao_1", filterFn: "arrIncludesSome" },
      { accessorKey: "dimensao_2", filterFn: "arrIncludesSome" },
      { accessorKey: "status", filterFn: "arrIncludesSome" },
      { accessorKey: "tipo_evento", filterFn: "arrIncludesSome" },
      { accessorKey: "valor_planejado", filterFn: "inNumberRange" },
      { accessorKey: "valor_realizado", filterFn: "inNumberRange" },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const filteredKeys = useMemo(
    () => new Set(table.getFilteredRowModel().rows.map((r) => r.original._key)),
    [rows, columnFilters], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const visibleRows = rows.filter((r) => filteredKeys.has(r._key));

  const anyColumnFilterActive = columnFilters.length > 0;

  function setFilter(id: string, value: string[] | undefined) {
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== id);
      return value && value.length ? [...rest, { id, value }] : rest;
    });
  }
  function setRangeFilter(id: string, min?: number, max?: number) {
    setColumnFilters((prev) => {
      const rest = prev.filter((f) => f.id !== id);
      if (min === undefined && max === undefined) return rest;
      return [...rest, { id, value: [min ?? -Infinity, max ?? Infinity] }];
    });
  }

  // ---- Edição via DataSheetGrid: atualiza só as linhas visíveis; as que
  // estão escondidas por um filtro continuam intocadas no array cheio. ----
  function handleGridChange(newVisible: GridRow[]) {
    const byKey = new Map(newVisible.map((r) => [r._key, r]));
    setRows((prev) => {
      const merged = prev.map((r) => byKey.get(r._key) ?? r);
      // Linhas novas (adicionadas pela grid) não existem em `prev` — acrescenta.
      const knownKeys = new Set(prev.map((r) => r._key));
      const added = newVisible.filter((r) => !knownKeys.has(r._key));
      return [...merged, ...added];
    });
  }

  const dimensao1Column = meta ? createSelectColumn(meta.dimensao_1.opcoes) : textColumn;
  const dimensao2Column = meta ? createSelectColumn(meta.dimensao_2.opcoes) : textColumn;

  const columns: Column<GridRow, any, any>[] = [
    { ...keyColumn("projeto", textColumn), title: "Projeto", minWidth: 160 },
    { ...keyColumn("ano_plano", yearColumn), title: "Ano Plano", minWidth: 90 },
    { ...keyColumn("uf", textColumn), title: "UF", minWidth: 70 },
    { ...keyColumn("municipio", textColumn), title: "Município", minWidth: 160 },
    { ...keyColumn("regional", createSelectColumn(REGIONAIS)), title: "Regional", minWidth: 100 },
    { ...keyColumn("dimensao_1", dimensao1Column), title: meta?.dimensao_1.label ?? "Dimensão 1", minWidth: 120 },
    { ...keyColumn("dimensao_2", dimensao2Column), title: meta?.dimensao_2.label ?? "Dimensão 2", minWidth: 140 },
    { ...keyColumn("status", createSelectColumn(camadasMeta?.status_options ?? [])), title: "Status", minWidth: 130 },
    { ...keyColumn("data_planejada", isoDateColumn), title: "Data Planejada", minWidth: 130 },
    { ...keyColumn("data_realizada", isoDateColumn), title: "Data Realizada", minWidth: 130 },
    { ...keyColumn("valor_planejado", floatColumn), title: "Valor Planejado (R$)", minWidth: 150 },
    { ...keyColumn("valor_realizado", floatColumn), title: "Valor Realizado (R$)", minWidth: 150 },
    { ...keyColumn("tipo_evento", createSelectColumn(camadasMeta?.tipo_evento_options ?? [])), title: "Tipo do Lançamento", minWidth: 160 },
    { ...keyColumn("observacao", textColumn), title: "Observação", minWidth: 200 },
  ];

  const dirtyRows = useMemo(() => {
    return rows.filter((r) => {
      const original = originalRef.current.get(r._key);
      if (!original) return r.projeto || r.status || r.tipo_evento; // linha nova com algo preenchido
      return rowsDiffer(r, original) && r.tipo_evento; // edição só conta se marcou o tipo do lançamento
    });
  }, [rows]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const eventos: NovoEvento[] = dirtyRows
        .filter((r) => r.projeto && r.ano_plano && r.status && r.tipo_evento)
        .map((r) => ({
          item_id: r.item_id ?? undefined,
          projeto: r.projeto!,
          ano_plano: r.ano_plano!,
          uf: r.uf,
          municipio: r.municipio,
          regional: r.regional,
          dimensao_1: r.dimensao_1,
          dimensao_2: r.dimensao_2,
          status: r.status!,
          data_planejada: r.data_planejada,
          data_realizada: r.data_realizada,
          valor_planejado: r.valor_planejado,
          valor_realizado: r.valor_realizado,
          tipo_evento: r.tipo_evento!,
          observacao: r.observacao,
        }));
      if (!eventos.length) throw new Error("Nenhuma linha completa pra salvar (falta Projeto/Status/Tipo do Lançamento).");
      return controleFisicoFinanceiroApi.criarEventos(camada, usuario, eventos);
    },
    onSuccess: (res) => {
      setSaveMsg(`${res.inseridos} lançamento(s) salvo(s).`);
      queryClient.invalidateQueries({ queryKey: ["cff-atual", camada] });
    },
    onError: (err: Error) => setSaveMsg(err.message),
  });

  const loadMunicipios = async (input: string) => {
    const rowsMun = await mobileAccessApi.municipiosSearch(input, uf);
    return rowsMun.map((r) => ({ value: r.municipio, label: `${r.municipio} (${r.uf})` }));
  };

  const incompleteCount = rows.length - dirtyRows.length >= 0
    ? rows.filter((r) => {
        const original = originalRef.current.get(r._key);
        const touched = !original || rowsDiffer(r, original);
        const hasAny = r.projeto || r.status || r.tipo_evento || r.observacao;
        return touched && hasAny && !(r.projeto && r.ano_plano && r.status && r.tipo_evento);
      }).length
    : 0;

  return (
    <div className="container-fluid mt-4">
      <PageHeader
        icon="bi bi-table"
        title="Controle Físico-Financeiro"
        subtitle="Planejamento e execução de projetos de Acesso e Transporte — físico e financeiro, na mesma grade"
        breadcrumb={[{ label: "Home", to: "/" }, { label: "Controle Físico-Financeiro" }]}
      />

      <div className="d-flex gap-2 mb-3" role="tablist">
        {(camadasMeta?.camadas ?? [{ key: "acesso", label: "Acesso" }, { key: "transporte", label: "Transporte" }]).map((c) => (
          <button
            key={c.key}
            type="button"
            className={"btn btn-sm " + (camada === c.key ? "btn-primary" : "btn-outline-primary")}
            onClick={() => setCamada(c.key as Camada)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md">
              <label className="form-label fw-bold small">UF</label>
              <Select isMulti styles={multi} placeholder="Todas as UFs"
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                options={ufOptions.map((u) => ({ value: u, label: u }))}
                value={uf.map((u) => ({ value: u, label: u }))}
                onChange={(s) => setValues("uf", s.map((x) => x.value))} />
            </div>
            <div className="col-md">
              <label className="form-label fw-bold small">Regional</label>
              <Select isMulti styles={multi} placeholder="Todas as regionais"
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                options={REGIONAIS.map((r) => ({ value: r, label: r }))}
                value={regional.map((r) => ({ value: r, label: r }))}
                onChange={(s) => setValues("regional", s.map((x) => x.value))} />
            </div>
            <div className="col-md">
              <label className="form-label fw-bold small">Município</label>
              <AsyncSelect isMulti styles={multi} placeholder="Digite um município..."
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                loadOptions={loadMunicipios}
                value={municipio.map((m) => ({ value: m, label: m }))}
                onChange={(s) => setValues("municipio", s.map((x) => x.value))} />
            </div>
            <div className="col-md">
              <label className="form-label fw-bold small">Projeto</label>
              <Select isMulti styles={multi} placeholder="Todos os projetos"
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                options={(opcoes?.projeto ?? []).map((p) => ({ value: p, label: p }))}
                value={projeto.map((p) => ({ value: p, label: p }))}
                onChange={(s) => setValues("projeto", s.map((x) => x.value))} />
            </div>
            <div className="col-md-auto" style={{ minWidth: 110 }}>
              <label className="form-label fw-bold small">Ano Plano</label>
              <input type="number" className="form-control form-control-sm" placeholder="2026"
                value={anoPlano ?? ""} onChange={(e) => setAnoPlano(e.target.value || null)} />
            </div>
            <div className="col-md-auto d-flex justify-content-end">
              <button className="btn btn-sm btn-outline-secondary" onClick={clear}>
                <i className="bi bi-x-lg" /> Limpar filtros
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h6 className="fw-bold mb-2"><i className="bi bi-funnel me-1" /> Filtros complexos da grade</h6>
          <div className="row g-3 align-items-end">
            <div className="col-md">
              <label className="form-label small">{meta?.dimensao_1.label ?? "Dimensão 1"}</label>
              <Select isMulti styles={multi}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                options={(meta?.dimensao_1.opcoes ?? []).map((o) => ({ value: o, label: o }))}
                onChange={(s) => setFilter("dimensao_1", s.map((x) => x.value))} />
            </div>
            <div className="col-md">
              <label className="form-label small">{meta?.dimensao_2.label ?? "Dimensão 2"}</label>
              <Select isMulti styles={multi}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                options={(meta?.dimensao_2.opcoes ?? []).map((o) => ({ value: o, label: o }))}
                onChange={(s) => setFilter("dimensao_2", s.map((x) => x.value))} />
            </div>
            <div className="col-md">
              <label className="form-label small">Status</label>
              <Select isMulti styles={multi}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                menuPosition="fixed"
                options={(camadasMeta?.status_options ?? []).map((o) => ({ value: o, label: o }))}
                onChange={(s) => setFilter("status", s.map((x) => x.value))} />
            </div>
            <div className="col-md-auto">
              <label className="form-label small d-block">Valor Planejado</label>
              <div className="d-flex gap-1">
                <input type="number" className="form-control form-control-sm" placeholder="Mín" style={{ width: 90 }}
                  onChange={(e) => setRangeFilter("valor_planejado",
                    e.target.value ? Number(e.target.value) : undefined,
                    (columnFilters.find((f) => f.id === "valor_planejado")?.value as number[] | undefined)?.[1])} />
                <input type="number" className="form-control form-control-sm" placeholder="Máx" style={{ width: 90 }}
                  onChange={(e) => setRangeFilter("valor_planejado",
                    (columnFilters.find((f) => f.id === "valor_planejado")?.value as number[] | undefined)?.[0],
                    e.target.value ? Number(e.target.value) : undefined)} />
              </div>
            </div>
            {anyColumnFilterActive && (
              <div className="col-md-auto">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setColumnFilters([])}>
                  <i className="bi bi-x-lg" /> Limpar filtros da grade
                </button>
              </div>
            )}
          </div>
          <small className="text-muted d-block mt-2">
            {visibleRows.length} de {rows.length} linha(s) — edite, cole ou arraste valores direto na grade abaixo.
          </small>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <label className="form-label small mb-0 fw-bold">Seu usuário/e-mail</label>
              <input type="text" className="form-control form-control-sm" style={{ width: 240 }}
                placeholder="nome@empresa.com" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
            </div>
            <div className="d-flex align-items-center gap-2">
              {incompleteCount > 0 && (
                <small className="text-warning">
                  {incompleteCount} linha(s) incompleta(s) (falta Projeto/Ano/Status/Tipo do Lançamento) — não serão salvas.
                </small>
              )}
              <button
                className="btn btn-sm btn-success"
                disabled={!usuario || dirtyRows.length === 0 || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                <i className="bi bi-save me-1" />
                {saveMutation.isPending ? "Salvando..." : `Salvar alterações (${dirtyRows.length})`}
              </button>
            </div>
          </div>
          {saveMsg && <div className="small text-muted mb-2">{saveMsg}</div>}

          {!camadasMeta ? (
            <div className="text-muted small py-4 text-center">Carregando colunas...</div>
          ) : (
            <DataSheetGrid
              // DataSheetGrid trata `columns` como estável após o mount — não
              // reage a columnData (opções de select) mudando depois. Por
              // isso só renderizamos quando os metadados (enums/dimensões)
              // já chegaram, e forçamos um remount limpo na troca de camada.
              key={camada}
              value={visibleRows}
              onChange={handleGridChange}
              columns={columns}
              rowKey={({ rowData }) => rowData._key}
              createRow={emptyRow}
              height={520}
              lockRows={isFetching}
            />
          )}
        </div>
      </div>
    </div>
  );
}
