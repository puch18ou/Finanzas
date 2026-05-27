"use client";

/**
 * ============================================================================
 *  src/app/ingresos/MonthlyIncomesTab.tsx
 * ============================================================================
 *
 *  Tabla anual con 12 filas (un mes por fila). Cada celda numerica
 *  (salario, bonus, otros) es editable inline: al perder el foco se
 *  dispara un upsert.
 *
 *  Columna "En {monedaVista}": el total de cada mes convertido a la
 *  moneda de visualizacion (igual que en Gastos). Util cuando los
 *  ingresos vienen en una moneda distinta a la de visualizacion (ej.
 *  salario en SGD pero quieres ver el equivalente en EUR).
 *
 *  Total anual: SIEMPRE en moneda vista. Asi tiene sentido aunque haya
 *  meses con monedas distintas.
 * ============================================================================
 */

import { useEffect, useMemo, useState } from "react";
import { useMonthlyIncomes } from "@/hooks/useMonthlyIncomes";
import { useCurrencies, useSettings } from "@/hooks/useSettings";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import { MESES_ES } from "@/lib/utils/dates";

type Props = {
  anio: number;
  monedaLocal: string;
};

export function MonthlyIncomesTab({ anio, monedaLocal }: Props) {
  const { settings } = useSettings();
  const { rows, isLoading, upsert, isMutating } = useMonthlyIncomes(
    anio,
    monedaLocal,
  );
  const { data: currencies = [] } = useCurrencies();

  type Editing = {
    salario: string;
    bonus: string;
    otros: string;
    moneda: string;
  };
  const [editing, setEditing] = useState<Record<number, Editing>>({});

  useEffect(() => {
    const next: Record<number, Editing> = {};
    for (const row of rows) {
      next[row.mes] = {
        salario: String(row.salario),
        bonus: String(row.bonus),
        otros: String(row.otros),
        moneda: row.moneda,
      };
    }
    setEditing(next);
  }, [rows]);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  // Total anual SIEMPRE en moneda vista. Convertimos cada fila por
  // separado segun su propia moneda. Si la conversion falla (raro),
  // descartamos esa fila.
  const totalAnualView = useMemo(
    () =>
      rows.reduce((acc, r) => {
        const totalRow = r.salario + r.bonus + r.otros;
        if (totalRow === 0) return acc;
        try {
          return acc + convert(totalRow, r.moneda, viewCurrency, rates);
        } catch {
          return acc;
        }
      }, 0),
    [rows, rates, viewCurrency],
  );

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Cargando ingresos mensuales...
      </p>
    );
  }

  const handleBlur = async (
    mes: number,
    field: "salario" | "bonus" | "otros",
  ) => {
    const e = editing[mes];
    if (!e) return;
    const value = Number(e[field]);
    if (isNaN(value) || value < 0) return;

    const row = rows.find((r) => r.mes === mes);
    if (row && row[field] === value) return; // sin cambios

    await upsert({
      mes,
      fields: { [field]: value, moneda: e.moneda } as never,
    });
  };

  const handleMonedaChange = async (mes: number, moneda: string) => {
    setEditing((prev) => ({ ...prev, [mes]: { ...prev[mes]!, moneda } }));
    await upsert({ mes, fields: { moneda } as never });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos mensuales {anio}</CardTitle>
        <CardDescription>
          Salario, bonus y otros ingresos recurrentes por mes. Cambios se
          guardan al salir de la celda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Mes</TableHead>
              <TableHead className="text-right">Salario</TableHead>
              <TableHead className="text-right">Bonus</TableHead>
              <TableHead className="text-right">Otros</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[90px]">Moneda</TableHead>
              <TableHead className="text-right">En {viewCurrency}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const e = editing[r.mes];
              if (!e) return null;
              const total = r.salario + r.bonus + r.otros;

              // Equivalente en moneda vista. Si la moneda del mes ya
              // coincide con la vista, mostramos "—" para no duplicar.
              let inView: number | null = null;
              if (total > 0 && r.moneda !== viewCurrency) {
                try {
                  inView = convert(total, r.moneda, viewCurrency, rates);
                } catch {
                  inView = null;
                }
              }

              return (
                <TableRow key={r.mes}>
                  <TableCell className="font-medium">
                    {MESES_ES[r.mes - 1]}
                  </TableCell>
                  <TableCell className="text-right p-1">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={e.salario}
                      onChange={(ev) =>
                        setEditing((prev) => ({
                          ...prev,
                          [r.mes]: {
                            ...prev[r.mes]!,
                            salario: ev.target.value,
                          },
                        }))
                      }
                      onBlur={() => handleBlur(r.mes, "salario")}
                      disabled={isMutating}
                      className="h-8 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right p-1">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={e.bonus}
                      onChange={(ev) =>
                        setEditing((prev) => ({
                          ...prev,
                          [r.mes]: { ...prev[r.mes]!, bonus: ev.target.value },
                        }))
                      }
                      onBlur={() => handleBlur(r.mes, "bonus")}
                      disabled={isMutating}
                      className="h-8 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right p-1">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={e.otros}
                      onChange={(ev) =>
                        setEditing((prev) => ({
                          ...prev,
                          [r.mes]: { ...prev[r.mes]!, otros: ev.target.value },
                        }))
                      }
                      onBlur={() => handleBlur(r.mes, "otros")}
                      disabled={isMutating}
                      className="h-8 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatAmount(total, r.moneda)}
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={e.moneda}
                      onValueChange={(v) => handleMonedaChange(r.mes, v)}
                      disabled={isMutating}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.moneda === viewCurrency ? (
                      "—"
                    ) : total === 0 ? (
                      formatAmount(0, viewCurrency)
                    ) : inView !== null ? (
                      formatAmount(inView, viewCurrency)
                    ) : (
                      <span className="text-destructive">err</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={6} className="text-right font-medium">
                Total anual en {viewCurrency}:
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatAmount(totalAnualView, viewCurrency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
