"use client";

/**
 * src/components/crud/PeriodSelector.tsx
 *
 * Selector compacto de (mes, anio). Tres elementos:
 *   - Boton "<" para mes anterior
 *   - Selects de mes y anio
 *   - Boton ">" para mes siguiente
 *
 * Util en cabeceras de paginas con datos por periodo (Gastos, Ingresos,
 * Dashboard, Evolucion...).
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MESES_ES } from "@/lib/utils/dates";

type Props = {
  anio: number;
  mes: number;
  onChange: (next: { anio: number; mes: number }) => void;
  yearsRange?: { from: number; to: number };
};

export function PeriodSelector({
  anio,
  mes,
  onChange,
  yearsRange,
}: Props) {
  const currentYear = new Date().getFullYear();
  const from = yearsRange?.from ?? currentYear - 5;
  const to = yearsRange?.to ?? currentYear + 2;
  const years: number[] = [];
  for (let y = to; y >= from; y--) years.push(y);

  const goPrev = () => {
    if (mes === 1) onChange({ anio: anio - 1, mes: 12 });
    else onChange({ anio, mes: mes - 1 });
  };
  const goNext = () => {
    if (mes === 12) onChange({ anio: anio + 1, mes: 1 });
    else onChange({ anio, mes: mes + 1 });
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-card p-1">
      <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Mes anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Select
        value={String(mes)}
        onValueChange={(v) => onChange({ anio, mes: Number(v) })}
      >
        <SelectTrigger className="h-8 w-[130px] border-0 shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MESES_ES.map((nombre, idx) => (
            <SelectItem key={idx} value={String(idx + 1)}>
              {nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(anio)}
        onValueChange={(v) => onChange({ anio: Number(v), mes })}
      >
        <SelectTrigger className="h-8 w-[90px] border-0 shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon" onClick={goNext} aria-label="Mes siguiente">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
