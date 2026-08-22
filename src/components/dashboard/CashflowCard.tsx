"use client";

/**
 * src/components/dashboard/CashflowCard.tsx
 *
 * Prevision de liquidez: proyecta el saldo de las cuentas con los movimientos
 * recurrentes PREVISTOS (mensuales) de los proximos ~60 dias. Responde "como
 * cierro el mes" y avisa si el saldo se va a numeros rojos. Ver domain/cashflow.
 *
 * Nota: de momento solo proyecta reglas MENSUALES (nomina, alquiler, cuotas,
 * suscripciones...), que son las que mueven la liquidez.
 */

import { useMemo } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useAccountBalances } from "@/hooks/useAccounts";
import { useActiveRecurringRules } from "@/hooks/useRecurringRules";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildRatesMap, convert, formatAmount } from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { occurrencesForRule } from "@/lib/domain/recurring";
import {
  projectCashflow,
  saldoAtDate,
  type CashflowEvent,
} from "@/lib/domain/cashflow";
import { formatDateLong } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

const HORIZONTE_DIAS = 60;

/** Delta con signo de una regla recurrente sobre la liquidez total. */
function deltaRegla(
  tipoMovimiento: string,
  cuentaDestinoId: string | null,
  importeVista: number,
): number {
  switch (tipoMovimiento) {
    case "ingreso":
    case "intereses":
      return importeVista;
    case "gasto":
    case "cuota":
      return -importeVista;
    case "transferencia":
      // Aportacion a inversion (sin cuenta destino) sale de la liquidez; una
      // transferencia entre cuentas propias es neutral al total.
      return cuentaDestinoId ? 0 : -importeVista;
    default:
      return 0;
  }
}

export function CashflowCard() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts, balances } = useAccountBalances();
  const { data: activeRules = [] } = useActiveRecurringRules();

  const viewCurrency = settings?.monedaVista ?? "EUR";
  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);
  const mask = useMaskMoney();
  const money = (n: number) => mask(formatAmount(n, viewCurrency));

  const saldoLiquido = useMemo(() => {
    let total = 0;
    for (const a of accounts) {
      if (!a.activa) continue;
      try {
        total += convert(balances.get(a.id) ?? 0, a.moneda, viewCurrency, rates);
      } catch {
        // moneda sin tipo de cambio: la ignoramos
      }
    }
    return total;
  }, [accounts, balances, rates, viewCurrency]);

  const eventos = useMemo<CashflowEvent[]>(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const horizonMs = nowMs + HORIZONTE_DIAS * 24 * 3600 * 1000;
    const out: CashflowEvent[] = [];

    // Recorremos los meses que tocan el horizonte (actual + 2 siguientes).
    for (let i = 0; i < 3; i++) {
      const base = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const anio = base.getFullYear();
      const mes = base.getMonth() + 1;

      for (const rule of activeRules) {
        let importeVista: number;
        try {
          importeVista = convert(rule.importe, rule.moneda, viewCurrency, rates);
        } catch {
          continue;
        }
        const delta = deltaRegla(
          rule.tipoMovimiento,
          rule.cuentaDestinoId,
          importeVista,
        );
        if (delta === 0) continue;

        // Todas las ocurrencias del mes segun la frecuencia (semanal/diaria/
        // varios-mes pueden dar varias) dentro del horizonte.
        for (const occ of occurrencesForRule(rule, anio, mes)) {
          const ts = occ.getTime();
          if (ts <= nowMs || ts > horizonMs) continue;
          out.push({ fecha: occ, delta, label: rule.nombre });
        }
      }
    }
    return out;
  }, [activeRules, rates, viewCurrency]);

  const proyeccion = useMemo(
    () => projectCashflow(saldoLiquido, eventos),
    [saldoLiquido, eventos],
  );

  const finDeMes = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }, []);
  const saldoFinMes = useMemo(
    () => saldoAtDate(saldoLiquido, eventos, finDeMes),
    [saldoLiquido, eventos, finDeMes],
  );

  const enRojos = proyeccion.minSaldo < 0 && proyeccion.minFecha !== null;
  const proximos = eventos
    .slice()
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Prevision de liquidez
        </CardTitle>
        <CardDescription>
          Proyeccion de tu saldo con los recurrentes previstos (proximos{" "}
          {HORIZONTE_DIAS} dias).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Saldo liquido hoy</p>
            <p className="text-2xl font-bold tabular-nums">
              {money(saldoLiquido)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Previsto fin de mes</p>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                saldoFinMes < 0 ? "text-destructive" : "text-primary",
              )}
            >
              {money(saldoFinMes)}
            </p>
          </div>
        </div>

        {enRojos ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>
              Tu saldo bajara a{" "}
              <strong className="tabular-nums">
                {money(proyeccion.minSaldo)}
              </strong>{" "}
              el {formatDateLong(proyeccion.minFecha!)}.
            </span>
          </div>
        ) : (
          eventos.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Te mantienes en positivo en los proximos {HORIZONTE_DIAS} dias
              (minimo {money(proyeccion.minSaldo)}).
            </p>
          )
        )}

        {proximos.length > 0 ? (
          <ul className="divide-y rounded-md border text-sm">
            {proximos.map((e, i) => (
              <li
                key={`${e.label}-${i}`}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="truncate">
                  <span className="text-muted-foreground tabular-nums">
                    {formatDateLong(e.fecha)}
                  </span>{" "}
                  · {e.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    e.delta >= 0 ? "text-primary" : "text-destructive",
                  )}
                >
                  {e.delta >= 0 ? "+" : ""}
                  {money(e.delta)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay recurrentes mensuales previstos en este horizonte.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
