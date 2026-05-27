"use client";

/**
 * ============================================================================
 *  src/app/proyeccion/page.tsx
 * ============================================================================
 *
 *  Simulador de patrimonio a futuro.
 *
 *  Inputs (modificables):
 *    - Patrimonio inicial (precargado desde settings.patrimonioInicial)
 *    - Ahorro anual (sugerencia: 12 * ahorro mensual del ultimo año)
 *    - Rentabilidad anual esperada (% del patrimonio, default 5%)
 *    - Inflacion anual esperada (default 2.5%)
 *    - Horizonte en años (default 20)
 *
 *  Outputs:
 *    - Grafico de evolucion del patrimonio nominal vs real
 *    - Tabla año a año
 * ============================================================================
 */

import { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Telescope, Sparkles } from "lucide-react";
import {
  buildRatesMap,
  convert,
  formatAmount,
} from "@/lib/domain/currency";
import { projectPatrimony } from "@/lib/domain/projection";

export default function ProyeccionPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();

  // Estado del simulador
  const [patrimonioInicial, setPatrimonioInicial] = useState<number>(0);
  const [ahorroAnual, setAhorroAnual] = useState<number>(0);
  const [rentabilidad, setRentabilidad] = useState<number>(5); // como %
  const [inflacion, setInflacion] = useState<number>(2.5); // como %
  const [anios, setAnios] = useState<number>(20);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  // Cargamos el patrimonio inicial de settings al primer arranque,
  // convertido a moneda vista.
  useEffect(() => {
    if (!settings) return;
    const moneda = settings.patrimonioInicialMoneda ?? viewCurrency;
    let converted = settings.patrimonioInicial;
    try {
      converted = convert(settings.patrimonioInicial, moneda, viewCurrency, rates);
    } catch {
      // mantener valor sin convertir
    }
    setPatrimonioInicial(Math.round(converted));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, viewCurrency, currencies.length]);

  // Proyeccion
  const rows = useMemo(
    () =>
      projectPatrimony(
        patrimonioInicial,
        ahorroAnual,
        rentabilidad / 100,
        inflacion / 100,
        anios,
      ),
    [patrimonioInicial, ahorroAnual, rentabilidad, inflacion, anios],
  );

  // Para el grafico necesitamos el offset de años en años naturales
  const currentYear = new Date().getFullYear();
  const chartData = rows.map((r) => ({
    anio: currentYear + r.anio,
    nominal: Math.round(r.patrimonioNominal),
    real: Math.round(r.patrimonioReal),
  }));

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  const final = rows[rows.length - 1]!;

  const formatY = (v: number) =>
    v >= 1000
      ? formatAmount(v / 1000, viewCurrency).replace(/[.,]00/, "") + "k"
      : formatAmount(v, viewCurrency);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Proyeccion</h1>
        <p className="text-sm text-muted-foreground">
          Estimacion de patrimonio a futuro segun ahorro anual y rentabilidad
          esperada. Ajustada por inflacion para reflejar poder adquisitivo.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Parametros</CardTitle>
          <CardDescription>
            Ajusta los valores para simular distintos escenarios. Todo en{" "}
            {viewCurrency}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="p-inicial" className="text-xs">Patrimonio inicial</Label>
              <Input
                id="p-inicial"
                type="number"
                step="100"
                min={0}
                value={patrimonioInicial}
                onChange={(e) => setPatrimonioInicial(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-ahorro" className="text-xs">Ahorro anual</Label>
              <Input
                id="p-ahorro"
                type="number"
                step="100"
                min={0}
                value={ahorroAnual}
                onChange={(e) => setAhorroAnual(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-rent" className="text-xs">Rentabilidad (%)</Label>
              <Input
                id="p-rent"
                type="number"
                step="0.1"
                value={rentabilidad}
                onChange={(e) => setRentabilidad(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-infl" className="text-xs">Inflacion (%)</Label>
              <Input
                id="p-infl"
                type="number"
                step="0.1"
                value={inflacion}
                onChange={(e) => setInflacion(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-anios" className="text-xs">Horizonte (anios)</Label>
              <Input
                id="p-anios"
                type="number"
                min={1}
                max={50}
                value={anios}
                onChange={(e) => setAnios(Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Telescope className="h-4 w-4" /> Patrimonio dentro de {anios} anios
            </CardTitle>
            <CardDescription>Valor nominal (sin descontar inflacion)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary tabular-nums">
              {formatAmount(final.patrimonioNominal, viewCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Equivalente real
            </CardTitle>
            <CardDescription>
              Poder adquisitivo en {currentYear} (descontada inflacion del{" "}
              {inflacion}% anual)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">
              {formatAmount(final.patrimonioReal, viewCurrency)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolucion proyectada</CardTitle>
          <CardDescription>
            La linea solida es el patrimonio nominal; la punteada es el
            equivalente real ajustado por inflacion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="anio" fontSize={11} stroke="var(--color-muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={formatY} width={80} />
              <RTooltip
                contentStyle={{
                  backgroundColor: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "12px",
                }}
                formatter={(value: unknown) => {
                  const n = typeof value === "number" ? value : Number(value);
                  if (Number.isNaN(n)) return String(value);
                  return formatAmount(n, viewCurrency);
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="nominal"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                dot={false}
                name="Nominal"
              />
              <Line
                type="monotone"
                dataKey="real"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 4"
                name="Real (poder adquisitivo de hoy)"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle anio a anio</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Anio</TableHead>
                <TableHead>Edad de la proyeccion</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
                <TableHead className="text-right">Real (hoy)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.anio} className={r.anio === 0 ? "opacity-60" : ""}>
                  <TableCell className="font-medium">
                    {currentYear + r.anio}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.anio === 0 ? "Hoy" : `+${r.anio} anios`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAmount(r.patrimonioNominal, viewCurrency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatAmount(r.patrimonioReal, viewCurrency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
