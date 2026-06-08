"use client";

import { Landmark } from "lucide-react";
import { MobileScreen } from "../MobileScreen";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useAccountBalances } from "@/hooks/useAccounts";
import { buildRatesMap, convert } from "@/lib/domain/currency";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent } from "@/components/ui/card";

export function MobileAccounts() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts, balances } = useAccountBalances();

  const view = settings?.monedaVista ?? "EUR";
  const rates = buildRatesMap(currencies);

  const activas = accounts.filter((a) => !a.deletedAt && a.activa);
  const total = activas.reduce(
    (s, a) => s + convert(balances.get(a.id) ?? 0, a.moneda, view, rates),
    0,
  );

  return (
    <MobileScreen title="Cuentas">
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-semibold">{formatMoney(total, view)}</span>
        </CardContent>
      </Card>

      {activas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tienes cuentas.</p>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {activas.map((a) => {
              const saldo = balances.get(a.id) ?? 0;
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.alias}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.entidad} · {a.tipo}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      saldo < 0 ? "text-red-600 dark:text-red-400" : ""
                    }`}
                  >
                    {formatMoney(saldo, a.moneda)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </MobileScreen>
  );
}
