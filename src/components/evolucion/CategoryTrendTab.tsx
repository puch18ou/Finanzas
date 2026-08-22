"use client";

/**
 * src/components/evolucion/CategoryTrendTab.tsx
 *
 * Pestaña "Por categoria" de Evolucion (PC). Eliges una o varias categorias y
 * ves su GASTO NETO mes a mes (una linea por categoria) para el año elegido.
 */

import { useMemo, useState } from "react";
import { useMovements } from "@/hooks/useMovements";
import { useCategories } from "@/hooks/useCategories";
import { useActiveRecurringRules } from "@/hooks/useRecurringRules";
import {
  categorySeriesByMonth,
  previstosDelMes,
} from "@/lib/domain/aggregation";
import type { RatesMap } from "@/lib/domain/currency";
import { formatAmount } from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { MESES_ES_CORTO } from "@/lib/utils/dates";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MultiLineChart,
  CHART_PALETTE,
} from "@/components/charts/MultiLineChart";
import { CategoryMultiSelect } from "@/components/evolucion/CategoryMultiSelect";

type Props = {
  viewCurrency: string;
  rates: RatesMap;
};

const MAX_CATS = 6;

export function CategoryTrendTab({ viewCurrency, rates }: Props) {
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear],
  );

  const [anio, setAnio] = useState<number>(currentYear);
  const [selected, setSelected] = useState<string[]>([]);

  const { categories } = useCategories();
  const mask = useMaskMoney();
  const money = (n: number) => mask(formatAmount(n, viewCurrency));

  const activeCategories = useMemo(
    () => categories.filter((c) => !c.deletedAt),
    [categories],
  );

  const catOptions = useMemo(
    () =>
      activeCategories.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        color: c.color,
      })),
    [activeCategories],
  );

  const catById = useMemo(() => {
    const m = new Map<string, { nombre: string; color?: string | null }>();
    for (const c of activeCategories) m.set(c.id, { nombre: c.nombre, color: c.color });
    return m;
  }, [activeCategories]);

  const periods = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ anio, mes: i + 1 })),
    [anio],
  );

  const { movements } = useMovements({ anio });
  const { data: activeRules = [] } = useActiveRecurringRules();

  const rawRows = useMemo(
    () => categorySeriesByMonth(movements, selected, periods, rates, viewCurrency),
    [movements, selected, periods, rates, viewCurrency],
  );

  // Sumamos el GASTO PREVISTO del mes actual (recurrentes aun no generados) por
  // categoria, igual que la pestaña General. Solo si el año mostrado es el actual.
  const rows = useMemo(() => {
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;
    if (anio !== cy) return rawRows;
    const prev = previstosDelMes(activeRules, cy, cm, now, rates, viewCurrency);
    return rawRows.map((r) => {
      if (r.mes !== cm) return r;
      const values = { ...r.values };
      for (const id of selected) {
        const add = prev.porCategoria[id] ?? 0;
        if (add !== 0) values[id] = (values[id] ?? 0) + add;
      }
      return { ...r, values };
    });
  }, [rawRows, activeRules, anio, selected, rates, viewCurrency]);

  const chartData = useMemo(
    () =>
      rows.map((r) => {
        const row: Record<string, number | string> = {
          mesLabel: MESES_ES_CORTO[r.mes - 1] ?? String(r.mes),
        };
        for (const id of selected) row[id] = r.values[id] ?? 0;
        return row;
      }),
    [rows, selected],
  );

  const series = useMemo(
    () =>
      selected.map((id, i) => ({
        key: id,
        name: catById.get(id)?.nombre ?? id,
        color: catById.get(id)?.color ?? CHART_PALETTE[i % CHART_PALETTE.length]!,
      })),
    [selected, catById],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Por categoria</CardTitle>
            <CardDescription>
              Gasto neto mes a mes de las categorias elegidas (en {viewCurrency}).
            </CardDescription>
          </div>
          <Select value={String(anio)} onValueChange={(v) => v && setAnio(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <CategoryMultiSelect
              options={catOptions}
              selected={selected}
              onChange={setSelected}
              max={MAX_CATS}
              placeholder="Elige categorias a comparar"
            />
          </div>

          {selected.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Elige una o varias categorias para ver su evolucion mensual.
            </p>
          ) : (
            <MultiLineChart
              data={chartData}
              xKey="mesLabel"
              series={series}
              viewCurrency={viewCurrency}
            />
          )}
        </CardContent>
      </Card>

      {selected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalle mes a mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px]">Mes</TableHead>
                    {selected.map((id) => (
                      <TableHead key={id} className="text-right">
                        {catById.get(id)?.nombre ?? id}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.mes}>
                      <TableCell className="font-medium">
                        {MESES_ES_CORTO[r.mes - 1]}
                      </TableCell>
                      {selected.map((id) => (
                        <TableCell key={id} className="text-right tabular-nums">
                          {money(r.values[id] ?? 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
