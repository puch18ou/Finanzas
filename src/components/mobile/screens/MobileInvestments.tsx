"use client";

/**
 * src/components/mobile/screens/MobileInvestments.tsx
 *
 * Pantalla de INVERSIONES para movil (solo lectura, como Cuentas): valor total
 * de la cartera, plusvalia, y la lista de posiciones con su valor y P/L. El alta
 * y la gestion detallada siguen en el escritorio.
 */

import { LineChart, TrendingUp, TrendingDown } from "lucide-react";
import { MobileScreen } from "../MobileScreen";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useInvestments } from "@/hooks/useInvestments";
import { buildRatesMap, convert } from "@/lib/domain/currency";
import {
  calculateInvestmentMetrics,
  summarizePortfolio,
} from "@/lib/domain/investments";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent } from "@/components/ui/card";

export function MobileInvestments() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { investments } = useInvestments();

  const view = settings?.monedaVista ?? "EUR";
  const rates = buildRatesMap(currencies);

  const portfolio = summarizePortfolio(investments, rates, view);
  const plPositive = portfolio.plAbsolutoVista >= 0;

  return (
    <MobileScreen title="Inversiones">
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Valor cartera</span>
            <span className="text-xl font-semibold">
              {formatMoney(portfolio.valorActualVista, view)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plusvalia</span>
            <span
              className={`text-sm font-semibold ${
                plPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {plPositive ? "+" : ""}
              {formatMoney(portfolio.plAbsolutoVista, view)} (
              {plPositive ? "+" : ""}
              {(portfolio.plPorcentaje * 100).toFixed(2)}%)
            </span>
          </div>
        </CardContent>
      </Card>

      {investments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tienes inversiones.</p>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {investments.map((inv) => {
              const m = calculateInvestmentMetrics(inv);
              const pos = m.plAbsoluto >= 0;
              const ref = inv.ticker || inv.isin;
              return (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <LineChart className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{inv.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inv.tipo}
                      {ref ? ` · ${ref}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">
                      {formatMoney(m.valorActual, inv.moneda)}
                    </p>
                    <p
                      className={`text-xs font-medium ${
                        pos
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {pos ? "+" : ""}
                      {(m.plPorcentaje * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </MobileScreen>
  );
}
