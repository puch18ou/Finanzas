"use client";

/**
 * src/components/dashboard/RecentExpenses.tsx
 *
 * Lista compacta de los ultimos N gastos. Por defecto 8.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Expense } from "@/lib/db/schema";
import { formatAmount } from "@/lib/domain/currency";
import { formatDateLong } from "@/lib/utils/dates";

type Props = {
  expenses: Expense[];
  categoryNames: Record<string, string>;
  max?: number;
};

export function RecentExpenses({ expenses, categoryNames, max = 8 }: Props) {
  const items = expenses.slice(0, max);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Ultimos gastos</CardTitle>
          <CardDescription>Movimientos mas recientes del mes</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/gastos">
            Ver todos <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay gastos este mes.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((e) => {
              const fecha = e.fecha instanceof Date ? e.fecha : new Date(e.fecha);
              const cat = categoryNames[e.categoriaId];
              return (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-md border-b border-border/40 pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.concepto}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateLong(fecha)}
                      {cat && (
                        <>
                          {" · "}
                          <Badge variant="outline" className="ml-0.5 px-1 py-0 text-[10px]">
                            {cat}
                          </Badge>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {formatAmount(e.importe, e.moneda)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
