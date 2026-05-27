"use client";

/**
 * ============================================================================
 *  src/components/charts/EvolutionChart.tsx
 * ============================================================================
 *
 *  Grafico de evolucion mensual. Cuatro modos configurables:
 *
 *    - 'lines'        Lineas de ingresos/gastos + linea de ahorro
 *    - 'grouped-bars' Barras agrupadas
 *    - 'stacked-bars' Barras apiladas
 *    - 'area'         Areas suaves para ingresos y gastos
 *
 *  Preferencia persistida en localStorage 'chart:evolutionType'.
 * ============================================================================
 */

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  ChartLine,
  ChartColumnBig,
  ChartArea,
  ChartColumnStacked,
} from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/domain/currency";
import { MESES_ES_CORTO } from "@/lib/utils/dates";

type EvolutionType = "lines" | "grouped-bars" | "stacked-bars" | "area";

export type EvolutionRow = {
  mes: number;
  ingresos: number;
  gastos: number;
  ahorro: number;
};

type Props = {
  data: EvolutionRow[];
  viewCurrency: string;
  title: string;
  description?: string;
};

/**
 * Formatter del tooltip de Recharts. Recharts pasa `value` como ValueType
 * (union de number | string | array). Casteamos a number con guard.
 */
function tooltipNumberFormatter(viewCurrency: string) {
  return (value: unknown): string => {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(n)) return String(value);
    return formatAmount(n, viewCurrency);
  };
}

export function EvolutionChart({ data, viewCurrency, title, description }: Props) {
  const [type, setType] = useLocalStorage<EvolutionType>(
    "chart:evolutionType",
    "lines",
  );

  const chartData = data.map((row) => ({
    ...row,
    mesLabel: MESES_ES_CORTO[row.mes - 1] ?? "",
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <EvolutionTypeSelector value={type} onChange={setType} />
      </CardHeader>
      <CardContent>
        {data.every((d) => d.ingresos === 0 && d.gastos === 0) ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay datos para mostrar.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            {renderChart(type, chartData, viewCurrency)}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function renderChart(
  type: EvolutionType,
  data: (EvolutionRow & { mesLabel: string })[],
  viewCurrency: string,
) {
  const formatY = (v: number) =>
    v >= 1000
      ? formatAmount(v / 1000, viewCurrency).replace(/[.,]00/, "") + "k"
      : formatAmount(v, viewCurrency);

  const tooltipProps = {
    contentStyle: {
      backgroundColor: "var(--color-popover)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)",
      fontSize: "12px",
    },
    formatter: tooltipNumberFormatter(viewCurrency),
  };

  const colors = {
    ingresos: "var(--color-chart-1)",
    gastos: "var(--color-destructive)",
    ahorro: "var(--color-chart-2)",
  };

  switch (type) {
    case "lines":
      return (
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="mesLabel" fontSize={11} stroke="var(--color-muted-foreground)" />
          <YAxis fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={formatY} width={70} />
          <RTooltip {...tooltipProps} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Line type="monotone" dataKey="ingresos" stroke={colors.ingresos} strokeWidth={2} dot={{ r: 3 }} name="Ingresos" />
          <Line type="monotone" dataKey="gastos" stroke={colors.gastos} strokeWidth={2} dot={{ r: 3 }} name="Gastos" />
          <Line type="monotone" dataKey="ahorro" stroke={colors.ahorro} strokeWidth={2} dot={{ r: 3 }} name="Ahorro" />
        </LineChart>
      );

    case "grouped-bars":
      return (
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="mesLabel" fontSize={11} stroke="var(--color-muted-foreground)" />
          <YAxis fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={formatY} width={70} />
          <RTooltip {...tooltipProps} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar dataKey="ingresos" fill={colors.ingresos} radius={[4, 4, 0, 0]} name="Ingresos" />
          <Bar dataKey="gastos" fill={colors.gastos} radius={[4, 4, 0, 0]} name="Gastos" />
        </BarChart>
      );

    case "stacked-bars":
      return (
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="mesLabel" fontSize={11} stroke="var(--color-muted-foreground)" />
          <YAxis fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={formatY} width={70} />
          <RTooltip {...tooltipProps} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar dataKey="gastos" stackId="a" fill={colors.gastos} name="Gastos" />
          <Bar dataKey="ingresos" stackId="a" fill={colors.ingresos} name="Ingresos" radius={[4, 4, 0, 0]} />
        </BarChart>
      );

    case "area":
      return (
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.ingresos} stopOpacity={0.4} />
              <stop offset="100%" stopColor={colors.ingresos} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.gastos} stopOpacity={0.4} />
              <stop offset="100%" stopColor={colors.gastos} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="mesLabel" fontSize={11} stroke="var(--color-muted-foreground)" />
          <YAxis fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={formatY} width={70} />
          <RTooltip {...tooltipProps} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Area type="monotone" dataKey="ingresos" stroke={colors.ingresos} fill="url(#gradIngresos)" name="Ingresos" />
          <Area type="monotone" dataKey="gastos" stroke={colors.gastos} fill="url(#gradGastos)" name="Gastos" />
        </AreaChart>
      );
  }
}

function EvolutionTypeSelector({
  value,
  onChange,
}: {
  value: EvolutionType;
  onChange: (v: EvolutionType) => void;
}) {
  const Icon =
    value === "lines"
      ? ChartLine
      : value === "area"
      ? ChartArea
      : value === "stacked-bars"
      ? ChartColumnStacked
      : ChartColumnBig;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Cambiar tipo de grafico">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tipo de grafico</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as EvolutionType)}
        >
          <DropdownMenuRadioItem value="lines">
            <ChartLine className="mr-2 h-4 w-4" /> Lineas
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="grouped-bars">
            <ChartColumnBig className="mr-2 h-4 w-4" /> Barras agrupadas
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="stacked-bars">
            <ChartColumnStacked className="mr-2 h-4 w-4" /> Barras apiladas
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="area">
            <ChartArea className="mr-2 h-4 w-4" /> Areas
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
