"use client";

/**
 * ============================================================================
 *  src/components/charts/EvolutionChart.tsx
 * ============================================================================
 *
 *  Grafico de evolucion mensual. Cinco modos configurables:
 *
 *    - 'lines'        Lineas de ingresos/gastos + linea de ahorro
 *    - 'grouped-bars' Barras agrupadas
 *    - 'stacked-bars' Barras apiladas
 *    - 'area'         Areas suaves para ingresos y gastos
 *    - 'combo'        Barras de ingresos/gastos + linea de ahorro encima
 *
 *  Preferencia persistida en localStorage 'chart:evolutionType'.
 * ============================================================================
 */

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  ChartLine,
  ChartColumnBig,
  ChartArea,
  ChartColumnStacked,
  ChartNoAxesCombined,
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
import { usePrivacy } from "@/contexts/PrivacyProvider";
import { maskMoney } from "@/lib/utils/privacy";
import { MESES_ES_CORTO } from "@/lib/utils/dates";

type EvolutionType =
  | "lines"
  | "grouped-bars"
  | "stacked-bars"
  | "area"
  | "combo";

export type EvolutionRow = {
  mes: number;
  ingresos: number;
  gastos: number;
  ahorro: number;
  /** Etiqueta del eje X. Si falta, se usa el nombre corto del mes. Util
   *  para rangos multi-anio donde hay que distinguir el anio (ej "Ene 25"). */
  label?: string;
};

/** Marca un mes (por su etiqueta de eje X) donde empieza un cambio de tramo. */
export type ChartMarker = { label: string; title?: string };

type Props = {
  data: EvolutionRow[];
  viewCurrency: string;
  title: string;
  description?: string;
  markers?: ChartMarker[];
  /** Ancla data-tour para el boton de tipo de grafica (paso del tour). */
  chartTypeTour?: string;
};

/**
 * Formatter del tooltip de Recharts. Recharts pasa `value` como ValueType
 * (union de number | string | array). Casteamos a number con guard.
 */
function tooltipNumberFormatter(viewCurrency: string, hidden: boolean) {
  return (value: unknown): string => {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(n)) return String(value);
    const s = formatAmount(n, viewCurrency);
    return hidden ? maskMoney(s) : s;
  };
}

export function EvolutionChart({
  data,
  viewCurrency,
  title,
  description,
  markers = [],
  chartTypeTour,
}: Props) {
  const [type, setType] = useLocalStorage<EvolutionType>(
    "chart:evolutionType",
    "lines",
  );
  const { hidden } = usePrivacy();

  const chartData = data.map((row) => ({
    ...row,
    mesLabel: row.label ?? MESES_ES_CORTO[row.mes - 1] ?? "",
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <EvolutionTypeSelector value={type} onChange={setType} dataTour={chartTypeTour} />
      </CardHeader>
      <CardContent>
        {data.every((d) => d.ingresos === 0 && d.gastos === 0) ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay datos para mostrar.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={340}>
              {renderChart(type, chartData, viewCurrency, markers, hidden)}
            </ResponsiveContainer>
            {markers.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Las lineas punteadas marcan cambios de objetivo o presupuesto.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Lineas verticales de referencia en los meses con cambio de tramo. */
function markerLines(markers: ChartMarker[]) {
  return markers.map((m) => (
    <ReferenceLine
      key={m.label}
      x={m.label}
      stroke="var(--color-muted-foreground)"
      strokeDasharray="3 3"
      strokeOpacity={0.6}
      ifOverflow="extendDomain"
      label={{
        value: "⏱",
        position: "top",
        fontSize: 11,
      }}
    />
  ));
}

function renderChart(
  type: EvolutionType,
  data: (EvolutionRow & { mesLabel: string })[],
  viewCurrency: string,
  markers: ChartMarker[],
  hidden: boolean,
) {
  const refLines = markerLines(markers);
  const formatY = (v: number) => {
    if (hidden) return "••";
    return v >= 1000
      ? formatAmount(v / 1000, viewCurrency).replace(/[.,]00/, "") + "k"
      : formatAmount(v, viewCurrency);
  };

  const tooltipProps = {
    contentStyle: {
      backgroundColor: "var(--color-popover)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)",
      fontSize: "12px",
    },
    formatter: tooltipNumberFormatter(viewCurrency, hidden),
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
          {refLines}
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
          {refLines}
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
          {refLines}
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
          {refLines}
          <Area type="monotone" dataKey="ingresos" stroke={colors.ingresos} fill="url(#gradIngresos)" name="Ingresos" />
          <Area type="monotone" dataKey="gastos" stroke={colors.gastos} fill="url(#gradGastos)" name="Gastos" />
        </AreaChart>
      );

    case "combo":
      return (
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="mesLabel" fontSize={11} stroke="var(--color-muted-foreground)" />
          <YAxis fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={formatY} width={70} />
          <RTooltip {...tooltipProps} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          {refLines}
          <Bar dataKey="ingresos" fill={colors.ingresos} radius={[4, 4, 0, 0]} name="Ingresos" />
          <Bar dataKey="gastos" fill={colors.gastos} radius={[4, 4, 0, 0]} name="Gastos" />
          <Line type="monotone" dataKey="ahorro" stroke={colors.ahorro} strokeWidth={2} dot={{ r: 3 }} name="Ahorro" />
        </ComposedChart>
      );
  }
}

function EvolutionTypeSelector({
  value,
  onChange,
  dataTour,
}: {
  value: EvolutionType;
  onChange: (v: EvolutionType) => void;
  dataTour?: string;
}) {
  const Icon =
    value === "lines"
      ? ChartLine
      : value === "area"
      ? ChartArea
      : value === "stacked-bars"
      ? ChartColumnStacked
      : value === "combo"
      ? ChartNoAxesCombined
      : ChartColumnBig;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cambiar tipo de grafico"
          data-tour={dataTour}
        >
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
          <DropdownMenuRadioItem value="combo">
            <ChartNoAxesCombined className="mr-2 h-4 w-4" /> Combo barras + linea
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
