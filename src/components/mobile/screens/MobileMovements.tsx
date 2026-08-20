"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Undo2,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { MobileScreen } from "../MobileScreen";
import { useMovementEditor } from "../MobileMovementEditor";
import { movementKind, movKindColor, movKindSign } from "../movement-display";
import { useMovements } from "@/hooks/useMovements";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useRefundTotals } from "@/hooks/useRefunds";
import { formatMoney } from "@/lib/utils/money";
import { buildRatesMap, convert } from "@/lib/domain/currency";
import { costeReal, sumRefundsInCurrency } from "@/lib/domain/refunds";
import { normalizeConcepto } from "@/lib/domain/category-suggest";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { RefundsDialog } from "@/components/forms/RefundsDialog";
import type { Movement } from "@/lib/db/schema";

type SortKey = "fecha" | "concepto" | "importe" | "categoria";
type SortDir = "asc" | "desc";

const SORT_LABEL: Record<SortKey, string> = {
  fecha: "Fecha",
  importe: "Importe",
  concepto: "Concepto",
  categoria: "Categoría",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function MobileMovements() {
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { data: refundsByGasto = {} } = useRefundTotals();
  const editor = useMovementEditor();

  const now = new Date();
  const baseMes = now.getMonth() + 1;
  const baseAnio = now.getFullYear();

  const [offset, setOffset] = useState(0);
  // mes/anio objetivo aplicando el desplazamiento.
  const idx = baseAnio * 12 + (baseMes - 1) + offset;
  const anio = Math.floor(idx / 12);
  const mes = (idx % 12) + 1;

  const { movements, remove, isMutating } = useMovements({ anio, mes });

  const [toDelete, setToDelete] = useState<Movement | null>(null);
  const [refundsFor, setRefundsFor] = useState<Movement | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const view = settings?.monedaVista ?? "EUR";
  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const accById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) map[a.id] = a.alias;
    return map;
  }, [accounts]);

  const catName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.nombre]));
    return (m: { categoriaId: string | null; categoriaTexto: string | null }) =>
      (m.categoriaId && map.get(m.categoriaId)) || m.categoriaTexto || "";
  }, [categories]);

  // Las devoluciones asociadas a un gasto no se listan aparte: las gestiona el
  // gasto (que muestra su coste real). Las devoluciones sueltas si aparecen.
  // Sobre eso: busqueda de texto (concepto + categoria + etiquetas) y orden.
  const lista = useMemo(() => {
    const importeVista = (m: Movement) => {
      try {
        return convert(m.importe, m.moneda, view, rates);
      } catch {
        return 0;
      }
    };
    const tokens = normalizeConcepto(search).split(" ").filter(Boolean);
    let arr = movements.filter(
      (m) => !(m.tipo === "devolucion" && m.gastoAsociadoId),
    );
    if (tokens.length) {
      arr = arr.filter((m) => {
        const hay = normalizeConcepto(
          `${m.concepto} ${catName(m)} ${m.etiquetas ?? ""}`,
        );
        return tokens.every((t) => hay.includes(t));
      });
    }
    const dir = sortDir === "asc" ? 1 : -1;
    arr = [...arr].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "concepto") {
        cmp = a.concepto.localeCompare(b.concepto, "es");
      } else if (sortKey === "categoria") {
        cmp = catName(a).localeCompare(catName(b), "es");
      } else if (sortKey === "importe") {
        cmp = importeVista(a) - importeVista(b);
      } else {
        cmp = +new Date(a.fecha) - +new Date(b.fecha);
      }
      if (cmp === 0) cmp = +new Date(b.fecha) - +new Date(a.fecha);
      return cmp * dir;
    });
    return arr;
  }, [movements, search, sortKey, sortDir, catName, rates, view]);

  const totalVista = useMemo(() => {
    let t = 0;
    for (const m of lista) {
      try {
        t += convert(m.importe, m.moneda, view, rates);
      } catch {
        // moneda sin tipo de cambio: se ignora
      }
    }
    return t;
  }, [lista, rates, view]);

  return (
    <MobileScreen
      title="Movimientos"
      action={
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-24 text-center text-xs font-medium">
            {MESES[mes - 1]} {anio}
          </span>
          <Button size="icon" variant="ghost" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      {/* Buscador + orden */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar concepto, categoría o etiqueta…"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sortKey}
            onValueChange={(v) => setSortKey(v as SortKey)}
          >
            <SelectTrigger className="h-9 flex-1">
              <span className="text-muted-foreground">Ordenar:&nbsp;</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label={sortDir === "asc" ? "Ascendente" : "Descendente"}
          >
            {sortDir === "asc" ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </Button>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {lista.length} ·{" "}
            <span className="font-medium text-foreground">
              {formatMoney(totalVista, view)}
            </span>
          </span>
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search.trim()
            ? "Ningún movimiento coincide."
            : "No hay movimientos este mes."}
        </p>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {lista.map((m) => {
              const kind = movementKind(m.tipo);
              const cat = catName(m);
              const esGasto = m.tipo === "gasto" || m.tipo === "cuota";
              const totalDevuelto = esGasto
                ? sumRefundsInCurrency(refundsByGasto[m.id] ?? [], m.moneda, rates)
                : 0;
              return (
                <div key={m.id} className="flex items-center gap-1 pr-1">
                  {/* Toque en la fila -> editar */}
                  <button
                    type="button"
                    onClick={() => editor.openEdit(m)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left active:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.concepto}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(m.fecha).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                        })}
                        {cat ? ` · ${cat}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-sm font-semibold ${movKindColor(kind)}`}>
                        {movKindSign(kind)}
                        {formatMoney(m.importe, m.moneda)}
                      </span>
                      {esGasto && totalDevuelto > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          real {formatMoney(costeReal(m.importe, totalDevuelto), m.moneda)}
                        </p>
                      )}
                    </div>
                  </button>
                  {/* Devoluciones (solo gastos) */}
                  {esGasto && (
                    <button
                      type="button"
                      onClick={() => setRefundsFor(m)}
                      aria-label="Devoluciones"
                      className="shrink-0 p-2 text-muted-foreground active:text-foreground"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                  )}
                  {/* Borrar */}
                  <button
                    type="button"
                    onClick={() => setToDelete(m)}
                    aria-label="Borrar movimiento"
                    className="shrink-0 p-2 text-muted-foreground active:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <RefundsDialog
        open={!!refundsFor}
        onOpenChange={(v) => !v && setRefundsFor(null)}
        gasto={refundsFor}
        accounts={accounts}
        accById={accById}
        currencies={currencies}
        defaultAccountId={settings?.cuentaPorDefectoId ?? null}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar movimiento"
        description={toDelete ? `"${toDelete.concepto}" pasara a la papelera.` : ""}
        loading={isMutating}
        onConfirm={async () => {
          if (toDelete) {
            await remove(toDelete.id);
            setToDelete(null);
          }
        }}
      />
    </MobileScreen>
  );
}
