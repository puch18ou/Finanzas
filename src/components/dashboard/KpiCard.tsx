"use client";

/**
 * src/components/dashboard/KpiCard.tsx
 *
 * Tarjeta compacta con un KPI grande (ingresos, gastos, ahorro, patrimonio).
 *
 * Soporta:
 *  - Indicador de buen/mal (verde/rojo) para ahorro
 *  - Subtitulo (e.g. tasa de ahorro, porcentaje, etc)
 *  - Icono decorativo
 */

import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type Props = {
  label: string;
  value: string;
  icon?: LucideIcon;
  intent?: "neutral" | "positive" | "negative";
  hint?: string;
};

export function KpiCard({ label, value, icon: Icon, intent = "neutral", hint }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold tabular-nums",
            intent === "positive" && "text-primary",
            intent === "negative" && "text-destructive",
          )}
        >
          {value}
        </div>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
