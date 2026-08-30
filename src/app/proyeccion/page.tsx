"use client";

/**
 * src/app/proyeccion/page.tsx — Proyeccion (Lote 10a-3)
 *
 * Eliminada la dependencia de monthlyIncomes.
 */

import { useMemo } from "react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMovements } from "@/hooks/useMovements";
import { useAccounts, useAccountBalances } from "@/hooks/useAccounts";
import { useInvestments } from "@/hooks/useInvestments";
import { useMortgage } from "@/hooks/useMortgage";
import { useOtherDebts } from "@/hooks/useOtherDebts";
import { useGoals } from "@/hooks/useGoals";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PeriodSelector } from "@/components/crud/PeriodSelector";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { MESES_ES_CORTO } from "@/lib/utils/dates";
import { summarizeMonth } from "@/lib/domain/aggregation";
import { periodsBetween } from "@/lib/domain/recurring";
import { summarizePortfolio } from "@/lib/domain/investments";
import { summarizeMortgage } from "@/lib/domain/mortgage";

export default function ProyeccionPage() {
  const mask = useMaskMoney();
  const money = (n: number, cur: string) => mask(formatAmount(n, cur));
  const today = new Date();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts } = useAccounts();
  const { balances } = useAccountBalances();
  const { investments } = useInvestments();
  const { mortgage } = useMortgage();
  const { debts } = useOtherDebts();
  const { goals } = useGoals();

  const currentYear = today.getFullYear();
  const currentMes = today.getMonth() + 1;

  // Cargamos TODOS los movimientos para poder contar el ahorro desde cualquier
  // fecha con datos.
  const { movements: allMovements } = useMovements();

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const viewCurrency = settings?.monedaVista ?? "EUR";

  // Primer mes con datos (minimo seleccionable para "contar desde"). Si no hay
  // movimientos, el mes actual.
  const earliest = useMemo(() => {
    let minKey = Infinity;
    let res = { anio: currentYear, mes: currentMes };
    for (const m of allMovements) {
      const k = m.anio * 100 + m.mes;
      if (k < minKey) {
        minKey = k;
        res = { anio: m.anio, mes: m.mes };
      }
    }
    return res;
  }, [allMovements, currentYear, currentMes]);

  // "Contar el ahorro desde": por defecto, el primer mes con datos. Se persiste
  // (localStorage) para conservarlo al cambiar de pestaña.
  const [desde, setDesde] = useLocalStorage<{ anio: number; mes: number } | null>(
    "proyeccion:desde",
    null,
  );
  const desdeEff = desde ?? earliest;

  // Fecha objetivo (hasta cuando proyectar): por defecto, dentro de 5 años.
  const defObjetivo = useMemo(() => {
    const d = new Date(currentYear, today.getMonth() + 60, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
  }, [currentYear, today]);
  const [objetivo, setObjetivo] = useLocalStorage<{
    anio: number;
    mes: number;
  } | null>("proyeccion:objetivo", null);
  const objetivoEff = objetivo ?? defObjetivo;

  // Meses de proyeccion = desde el mes actual hasta la fecha objetivo (>= 1).
  const horizonMonths = useMemo(() => {
    const curK = currentYear * 12 + (currentMes - 1);
    const objK = objetivoEff.anio * 12 + (objetivoEff.mes - 1);
    return Math.max(1, objK - curK);
  }, [objetivoEff, currentYear, currentMes]);

  // Ahorro mensual medio contando SOLO desde `desdeEff` hasta el mes actual
  // (meses con datos). No cuenta nada anterior a esa fecha.
  const ahorroMensualMedio = useMemo(() => {
    if (!settings) return 0;
    // Hasta el mes ANTERIOR al actual: el mes en curso no ha terminado y
    // falsearia la media.
    const endD = new Date(currentYear, currentMes - 2, 1);
    const periodos = periodsBetween(
      desdeEff.anio,
      desdeEff.mes,
      endD.getFullYear(),
      endD.getMonth() + 1,
    );
    const mesesConDatos: number[] = [];
    for (const p of periodos) {
      const summary = summarizeMonth({
        mes: p.mes,
        anio: p.anio,
        movements: allMovements,
        rates,
        viewCurrency,
      });
      if (summary.ingresos > 0 || summary.gastos > 0) {
        mesesConDatos.push(summary.ahorro);
      }
    }
    if (mesesConDatos.length === 0) return 0;
    return mesesConDatos.reduce((a, b) => a + b, 0) / mesesConDatos.length;
  }, [settings, desdeEff, allMovements, rates, viewCurrency, currentYear, currentMes]);

  const valorCuentas = useMemo(() => {
    let total = 0;
    for (const a of accounts) {
      if (!a.activa) continue;
      try {
        total += convert(balances.get(a.id) ?? 0, a.moneda, viewCurrency, rates);
      } catch {}
    }
    return total;
  }, [accounts, balances, rates, viewCurrency]);

  const portfolio = useMemo(
    () => summarizePortfolio(investments, rates, viewCurrency),
    [investments, rates, viewCurrency],
  );

  const mortgageSummary = useMemo(() => {
    if (!mortgage) return null;
    return summarizeMortgage({
      precioVivienda: mortgage.precioVivienda,
      entrada: mortgage.entrada,
      gastosAsociados: mortgage.gastosAsociados,
      plazoAnios: mortgage.plazoAnios,
      tin: mortgage.tin,
    });
  }, [mortgage]);

  const deudaTotal = useMemo(() => {
    let total = 0;
    if (mortgage?.activa && mortgageSummary) {
      try {
        total += convert(
          mortgageSummary.capitalPrestado,
          mortgage.moneda,
          viewCurrency,
          rates,
        );
      } catch {}
    }
    for (const d of debts) {
      try {
        total += convert(d.capitalPendiente, d.moneda, viewCurrency, rates);
      } catch {}
    }
    return total;
  }, [mortgage, mortgageSummary, debts, rates, viewCurrency]);

  const patrimonioInicial = useMemo(() => {
    if (!settings) return 0;
    try {
      return convert(
        settings.patrimonioInicial,
        settings.patrimonioInicialMoneda ?? viewCurrency,
        viewCurrency,
        rates,
      );
    } catch {
      return 0;
    }
  }, [settings, rates, viewCurrency]);

  const patrimonioNetoActual =
    valorCuentas + portfolio.valorActualVista - deudaTotal;

  // Etiqueta del mes actual en el eje (para el marcador "Hoy").
  const labelHoy = `${currentMes}/${currentYear}`;

  const projectionData = useMemo(() => {
    // Eje temporal completo: desde "contar ahorro desde" hasta la fecha
    // objetivo. Cada nodo es un mes.
    const meses = periodsBetween(
      desdeEff.anio,
      desdeEff.mes,
      objetivoEff.anio,
      objetivoEff.mes,
    );
    // Indice del mes ACTUAL dentro del eje (frontera conocido/proyeccion).
    const curIdx = meses.findIndex(
      (p) => p.anio === currentYear && p.mes === currentMes,
    );

    // Ahorro REAL de cada mes (para reconstruir el tramo ya conocido).
    const ahorroReal = meses.map(
      (p) =>
        summarizeMonth({
          mes: p.mes,
          anio: p.anio,
          movements: allMovements,
          rates,
          viewCurrency,
        }).ahorro,
    );

    const round = (n: number) => Math.round(n * 100) / 100;

    return meses.map((p, i) => {
      let patrimonio: number;
      if (curIdx < 0) {
        // Caso raro (el mes actual no cae en el rango): todo proyeccion
        // anclada al patrimonio actual en el ultimo nodo.
        patrimonio =
          patrimonioNetoActual + ahorroMensualMedio * (i - (meses.length - 1));
      } else if (i < curIdx) {
        // Pasado CONOCIDO: retrocedemos desde el patrimonio actual restando el
        // ahorro real de los meses que van de este hasta el actual.
        let acumulado = 0;
        for (let k = i; k < curIdx; k++) acumulado += ahorroReal[k] ?? 0;
        patrimonio = patrimonioNetoActual - acumulado;
      } else {
        // Mes actual y futuro: proyeccion lineal con el ahorro medio.
        patrimonio = patrimonioNetoActual + ahorroMensualMedio * (i - curIdx);
      }
      patrimonio = round(patrimonio);
      const esActual = i === curIdx;
      return {
        idx: i,
        label: `${p.mes}/${p.anio}`,
        patrimonio,
        // Dos series que se tocan en el mes actual: solida (real/conocido) y
        // discontinua (proyeccion).
        real: curIdx >= 0 && i <= curIdx ? patrimonio : null,
        proyeccion: curIdx < 0 || i >= curIdx ? patrimonio : null,
        esActual,
      };
    });
  }, [
    desdeEff,
    objetivoEff,
    currentYear,
    currentMes,
    allMovements,
    rates,
    viewCurrency,
    patrimonioNetoActual,
    ahorroMensualMedio,
  ]);

  const patrimonioProyectado =
    projectionData[projectionData.length - 1]?.patrimonio ?? 0;

  // Metas: importe objetivo (para los hitos del grafico) y fecha estimada de
  // cumplimiento a partir de lo ya ahorrado + el ahorro mensual medio.
  const goalsInfo = useMemo(() => {
    return goals.map((g) => {
      // Saldo efectivo: cuenta vinculada (si la hay) o el ya ahorrado guardado.
      let yaAhorrado = g.yaAhorrado;
      if (g.cuentaVinculadaId) {
        const acc = accounts.find((a) => a.id === g.cuentaVinculadaId);
        if (acc) {
          try {
            yaAhorrado = Math.max(
              0,
              convert(balances.get(acc.id) ?? 0, acc.moneda, g.moneda, rates),
            );
          } catch {}
        }
      }
      let objetivoView = 0;
      let yaView = 0;
      try {
        objetivoView = convert(g.importeObjetivo, g.moneda, viewCurrency, rates);
      } catch {}
      try {
        yaView = convert(yaAhorrado, g.moneda, viewCurrency, rates);
      } catch {}

      const obj =
        g.fechaObjetivo instanceof Date
          ? g.fechaObjetivo
          : new Date(g.fechaObjetivo);
      const restante = Math.max(0, objetivoView - yaView);

      let estado: "done" | "ontrack" | "late" | "norate" = "norate";
      let estimada: Date | null = null;
      let mesesRetraso = 0;
      if (restante <= 0) {
        estado = "done";
      } else if (ahorroMensualMedio > 0) {
        const meses = Math.ceil(restante / ahorroMensualMedio);
        estimada = new Date(today.getFullYear(), today.getMonth() + meses, 1);
        mesesRetraso =
          (estimada.getFullYear() - obj.getFullYear()) * 12 +
          (estimada.getMonth() - obj.getMonth());
        estado = mesesRetraso <= 0 ? "ontrack" : "late";
      }

      return {
        id: g.id,
        nombre: g.nombre,
        objetivoView,
        fechaObjetivo: obj,
        estado,
        estimada,
        mesesRetraso,
      };
    });
  }, [goals, accounts, balances, rates, viewCurrency, ahorroMensualMedio, today]);

  const fmtMesAnio = (d: Date) =>
    `${MESES_ES_CORTO[d.getMonth()] ?? ""} ${d.getFullYear()}`;

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Proyeccion</h1>
        <p className="text-sm text-muted-foreground">
          Evolucion estimada del patrimonio segun tu tasa de ahorro media.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Parametros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2" data-tour="proy-desde">
              <Label className="text-xs">Contar ahorro desde</Label>
              <div>
                <PeriodSelector
                  anio={desdeEff.anio}
                  mes={desdeEff.mes}
                  yearsRange={{ from: earliest.anio, to: currentYear }}
                  onChange={({ anio, mes }) => {
                    const k = anio * 12 + (mes - 1);
                    const minK = earliest.anio * 12 + (earliest.mes - 1);
                    const maxK = currentYear * 12 + (currentMes - 1);
                    const cl = Math.min(Math.max(k, minK), maxK);
                    setDesde({ anio: Math.floor(cl / 12), mes: (cl % 12) + 1 });
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Primer mes con datos: {fmtMesAnio(new Date(earliest.anio, earliest.mes - 1, 1))}.
              </p>
            </div>
            <div className="space-y-2" data-tour="proy-objetivo">
              <Label className="text-xs">Proyectar hasta</Label>
              <div>
                <PeriodSelector
                  anio={objetivoEff.anio}
                  mes={objetivoEff.mes}
                  yearsRange={{ from: currentYear, to: currentYear + 30 }}
                  onChange={({ anio, mes }) => {
                    const k = anio * 12 + (mes - 1);
                    const minK = currentYear * 12 + currentMes; // al menos el mes siguiente
                    const cl = Math.max(k, minK);
                    setObjetivo({ anio: Math.floor(cl / 12), mes: (cl % 12) + 1 });
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {horizonMonths} meses (aprox. {(horizonMonths / 12).toFixed(1)} años).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Patrimonio inicial declarado</Label>
              <p className="text-lg font-semibold tabular-nums">
                {money(patrimonioInicial, viewCurrency)}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Patrimonio neto actual</Label>
              <p className="text-lg font-semibold tabular-nums">
                {money(patrimonioNetoActual, viewCurrency)}
              </p>
            </div>
            <div className="space-y-1" data-tour="proy-ahorro">
              <Label className="text-xs">
                Ahorro mensual medio (desde{" "}
                {fmtMesAnio(new Date(desdeEff.anio, desdeEff.mes - 1, 1))})
              </Label>
              <p className="text-lg font-semibold tabular-nums">
                {money(ahorroMensualMedio, viewCurrency)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-tour="proy-grafica">
        <CardHeader>
          <CardTitle>Proyeccion</CardTitle>
          <CardDescription>
            Linea solida = patrimonio real desde el mes elegido; discontinua =
            proyeccion lineal (sin inflacion ni rendimiento de inversiones).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">En {horizonMonths} meses</p>
              <p className="text-2xl font-bold tabular-nums">
                {money(patrimonioProyectado, viewCurrency)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Crecimiento esperado</p>
              <p className="text-2xl font-bold tabular-nums text-primary">
                {money(patrimonioProyectado - patrimonioNetoActual, viewCurrency)}
              </p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" interval="preserveStartEnd" />
                <YAxis />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [
                    money(Number(v) || 0, viewCurrency),
                    name === "real" ? "Real" : "Proyeccion",
                  ]}
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                  }}
                />
                {goalsInfo.map((g) => (
                  <ReferenceLine
                    key={g.id}
                    y={g.objetivoView}
                    stroke="var(--color-muted-foreground)"
                    strokeDasharray="4 4"
                    label={{
                      value: g.nombre,
                      position: "insideTopLeft",
                      fontSize: 10,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                ))}
                {/* Marca el mes actual: separa lo real de la proyeccion. */}
                <ReferenceLine
                  x={labelHoy}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="2 2"
                  label={{
                    value: "Hoy",
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "var(--color-muted-foreground)",
                  }}
                />
                {/* Tramo conocido (real): linea solida. */}
                <Line
                  type="monotone"
                  dataKey="real"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {/* Tramo futuro (proyeccion): linea discontinua. */}
                <Line
                  type="monotone"
                  dataKey="proyeccion"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card data-tour="proy-metas">
        <CardHeader>
          <CardTitle>Metas</CardTitle>
          <CardDescription>
            Fecha estimada de cumplimiento segun lo ya ahorrado y tu ahorro
            mensual medio ({money(ahorroMensualMedio, viewCurrency)}/mes).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {goalsInfo.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No tienes metas definidas. Crealas en Metas.
            </p>
          ) : (
            <div className="space-y-2">
              {goalsInfo.map((g) => (
                <div
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{g.nombre}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {money(g.objetivoView, viewCurrency)} · objetivo{" "}
                      {fmtMesAnio(g.fechaObjetivo)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {g.estado === "done" ? (
                      <Badge className="bg-primary">Ya alcanzada</Badge>
                    ) : g.estado === "norate" ? (
                      <Badge variant="secondary">Sin ritmo de ahorro</Badge>
                    ) : (
                      <>
                        <span className="text-muted-foreground tabular-nums">
                          estimado {g.estimada ? fmtMesAnio(g.estimada) : "—"}
                        </span>
                        {g.estado === "ontrack" ? (
                          <Badge className="bg-primary">A tiempo</Badge>
                        ) : (
                          <Badge variant="destructive">
                            +{g.mesesRetraso}{" "}
                            {g.mesesRetraso === 1 ? "mes" : "meses"}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
