"use client";

/**
 * src/components/dashboard/RecentMovements.tsx
 *
 * Sustituye a RecentExpenses. Muestra los ultimos movimientos (de
 * cualquier tipo) con icono distintivo segun el tipo.
 */

import {
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  Settings2,
  Undo2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Movement } from "@/lib/db/schema";
import { formatAmount } from "@/lib/domain/currency";
import { parseTags } from "@/lib/domain/tags";
import { formatDateLong } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

type Props = {
  movements: Movement[];
  categoryNames: Record<string, string>;
  accountNames: Record<string, string>;
  max?: number;
};

export function RecentMovements({
  movements,
  categoryNames,
  accountNames,
  max = 8,
}: Props) {
  const recent = [...movements]
    .sort((a, b) => {
      const fa = a.fecha instanceof Date ? a.fecha.getTime() : new Date(a.fecha).getTime();
      const fb = b.fecha instanceof Date ? b.fecha.getTime() : new Date(b.fecha).getTime();
      return fb - fa;
    })
    .slice(0, max);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movimientos recientes</CardTitle>
        <CardDescription>
          Los ultimos {recent.length} movimientos del periodo
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Sin movimientos en este periodo.
          </p>
        ) : (
          <ul className="space-y-1">
            {recent.map((m) => (
              <MovementRow
                key={m.id}
                m={m}
                categoryNames={categoryNames}
                accountNames={accountNames}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MovementRow({
  m,
  categoryNames,
  accountNames,
}: {
  m: Movement;
  categoryNames: Record<string, string>;
  accountNames: Record<string, string>;
}) {
  const fecha = m.fecha instanceof Date ? m.fecha : new Date(m.fecha);
  const meta = getTipoMeta(m);
  const detail = getDetail(m, categoryNames, accountNames);

  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40">
      <div className={cn("flex h-7 w-7 items-center justify-center rounded-full", meta.bg)}>
        <meta.icon className={cn("h-3.5 w-3.5", meta.fg)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.concepto}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDateLong(fecha)} · {detail}
        </p>
        {m.etiquetas && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {parseTags(m.etiquetas)
              .slice(0, 4)
              .map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="px-1 py-0 text-[9px] font-normal"
                >
                  {t}
                </Badge>
              ))}
          </div>
        )}
      </div>
      <span className={cn("text-sm tabular-nums font-medium", meta.amount)}>
        {meta.sign}
        {formatAmount(m.importe, m.moneda)}
      </span>
    </li>
  );
}

function getTipoMeta(m: Movement) {
  if (m.tipo === "gasto" || m.tipo === "cuota") {
    return {
      icon: ArrowDown,
      bg: "bg-destructive/10",
      fg: "text-destructive",
      amount: "text-destructive",
      sign: "-",
    };
  }
  if (m.tipo === "ingreso" || m.tipo === "intereses") {
    return {
      icon: ArrowUp,
      bg: "bg-primary/10",
      fg: "text-primary",
      amount: "text-primary",
      sign: "+",
    };
  }
  if (m.tipo === "devolucion") {
    return {
      icon: Undo2,
      bg: "bg-emerald-500/10",
      fg: "text-emerald-600 dark:text-emerald-400",
      amount: "text-emerald-600 dark:text-emerald-400",
      sign: "+",
    };
  }
  if (m.tipo === "transferencia") {
    return {
      icon: ArrowLeftRight,
      bg: "bg-blue-500/10",
      fg: "text-blue-600 dark:text-blue-400",
      amount: "",
      sign: "",
    };
  }
  return {
    icon: Settings2,
    bg: "bg-amber-500/10",
    fg: "text-amber-600 dark:text-amber-400",
    amount: "",
    sign: "",
  };
}

function getDetail(
  m: Movement,
  categoryNames: Record<string, string>,
  accountNames: Record<string, string>,
): string {
  if (m.tipo === "gasto" || m.tipo === "cuota" || m.tipo === "devolucion") {
    return m.categoriaId ? categoryNames[m.categoriaId] ?? "?" : "Sin categoria";
  }
  if (m.tipo === "ingreso" || m.tipo === "intereses") {
    return m.categoriaTexto ?? "Ingreso";
  }
  if (m.tipo === "transferencia") {
    const o = m.cuentaOrigenId ? accountNames[m.cuentaOrigenId] ?? "?" : "?";
    const d = m.cuentaDestinoId ? accountNames[m.cuentaDestinoId] ?? "?" : "?";
    return `${o} → ${d}`;
  }
  return "Ajuste";
}
