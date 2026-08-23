"use client";

/**
 * ============================================================================
 *  src/components/charts/CategoryChart.tsx
 * ============================================================================
 *
 *  Tarjeta con el grafico de gasto por categoria. Tres modos visuales,
 *  seleccionables por el usuario y persistidos en localStorage.
 * ============================================================================
 */

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartPie, ChartColumnBig, ChartNoAxesColumn } from "lucide-react";
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
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/lib/domain/currency";
import { usePrivacy } from "@/contexts/PrivacyProvider";
import { maskMoney } from "@/lib/utils/privacy";

export type ChartDatum = {
  name: string;
  value: number;
  color?: string;
};

type ChartType = "pie" | "donut" | "bars";

type Props = {
  data: ChartDatum[];
  viewCurrency: string;
  title: string;
  description?: string;
  dataTour?: string;
  /** Ancla data-tour para el boton de tipo de grafica (paso propio del tour). */
  chartTypeTour?: string;
};

const DEFAULT_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function pickColor(item: ChartDatum, index: number): string {
  if (item.color) return item.color;
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length]!;
}

/**
 * Helper: formatea el valor que recibe el tooltip de Recharts.
 *
 * Recharts tipa value como ValueType (number | string | (number|string)[]).
 * Como nuestros datos siempre son numericos, lo casteamos a number.
 */
function tooltipNumberFormatter(viewCurrency: string, hidden: boolean) {
  return (value: unknown): string => {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(n)) return String(value);
    const s = formatAmount(n, viewCurrency);
    return hidden ? maskMoney(s) : s;
  };
}

export function CategoryChart({
  data,
  viewCurrency,
  title,
  description,
  dataTour,
  chartTypeTour,
}: Props) {
  const [chartType, setChartType] = useLocalStorage<ChartType>(
    "chart:categoryType",
    "donut",
  );
  const { hidden } = usePrivacy();

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  return (
    <Card data-tour={dataTour}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <ChartTypeSelector
          value={chartType}
          onChange={setChartType}
          dataTour={chartTypeTour}
        />
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay datos para mostrar.
          </p>
        ) : chartType === "bars" ? (
          <BarsView data={data} viewCurrency={viewCurrency} hidden={hidden} />
        ) : (
          <PieView
            data={data}
            viewCurrency={viewCurrency}
            isDonut={chartType === "donut"}
            total={total}
            hidden={hidden}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ChartTypeSelector({
  value,
  onChange,
  dataTour,
}: {
  value: ChartType;
  onChange: (v: ChartType) => void;
  dataTour?: string;
}) {
  const Icon =
    value === "pie" ? ChartPie : value === "donut" ? ChartPie : ChartColumnBig;
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
          onValueChange={(v) => onChange(v as ChartType)}
        >
          <DropdownMenuRadioItem value="pie">
            <ChartPie className="mr-2 h-4 w-4" /> Tarta
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="donut">
            <ChartPie className="mr-2 h-4 w-4" /> Donut
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="bars">
            <ChartColumnBig className="mr-2 h-4 w-4" /> Barras horizontales
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PieView({
  data,
  viewCurrency,
  isDonut,
  total,
  hidden,
}: {
  data: ChartDatum[];
  viewCurrency: string;
  isDonut: boolean;
  total: number;
  hidden: boolean;
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={isDonut ? 60 : 0}
            outerRadius={110}
            paddingAngle={isDonut ? 2 : 0}
            stroke="var(--color-background)"
            strokeWidth={2}
          >
            {data.map((entry, idx) => (
              <Cell key={entry.name} fill={pickColor(entry, idx)} />
            ))}
          </Pie>
          <RTooltip
            contentStyle={{
              backgroundColor: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: "12px",
            }}
            formatter={tooltipNumberFormatter(viewCurrency, hidden)}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: "12px" }}
          />
        </PieChart>
      </ResponsiveContainer>
      {isDonut && total > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ paddingBottom: "40px" }}>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold tabular-nums">
              {hidden
                ? maskMoney(formatAmount(total, viewCurrency))
                : formatAmount(total, viewCurrency)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function BarsView({
  data,
  viewCurrency,
  hidden,
}: {
  data: ChartDatum[];
  viewCurrency: string;
  hidden: boolean;
}) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data],
  );

  const height = Math.max(200, sorted.length * 32);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 0, right: 24 }}>
        <XAxis
          type="number"
          stroke="var(--color-muted-foreground)"
          fontSize={11}
          tickFormatter={(v) => {
            const s = formatAmount(v as number, viewCurrency);
            return hidden ? maskMoney(s) : s;
          }}
        />
        <YAxis
          dataKey="name"
          type="category"
          stroke="var(--color-muted-foreground)"
          fontSize={11}
          width={110}
        />
        <RTooltip
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "12px",
          }}
          formatter={tooltipNumberFormatter(viewCurrency, hidden)}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {sorted.map((entry, idx) => (
            <Cell key={entry.name} fill={pickColor(entry, idx)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

void ChartNoAxesColumn;
