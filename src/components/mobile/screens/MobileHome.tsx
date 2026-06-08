"use client";

import { TrendingUp, TrendingDown, PiggyBank, Landmark } from "lucide-react";
import { MobileScreen } from "../MobileScreen";
import {
  movementKind,
  movKindColor,
  movKindSign,
} from "../movement-display";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useAccountBalances } from "@/hooks/useAccounts";
import { useMovements } from "@/hooks/useMovements";
import { buildRatesMap, convert } from "@/lib/domain/currency";
import { summarizeMonth } from "@/lib/domain/aggregation";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent } from "@/components/ui/card";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function MobileHome() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts, balances } = useAccountBalances();

  const view = settings?.monedaVista ?? "EUR";
  const now = new Date();
  const mes = settings?.mesActual ?? now.getMonth() + 1;
  const anio = settings?.anioActual ?? now.getFullYear();
  const { movements } = useMovements({ anio, mes });

  const rates = buildRatesMap(currencies);
  const summary = summarizeMonth({ mes, anio, movements, rates, viewCurrency: view });
  const patrimonio = accounts.reduce(
    (s, a) => s + convert(balances.get(a.id) ?? 0, a.moneda, view, rates),
    0,
  );

  const recientes = [...movements]
    .sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha))
    .slice(0, 6);

  return (
    <MobileScreen title="Inicio">
      <p className="-mt-1 text-sm capitalize text-muted-foreground">
        {MESES[mes - 1]} {anio}
      </p>

      {/* Resumen del mes */}
      <div className="grid grid-cols-3 gap-2">
        <Stat
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          label="Ingresos"
          value={formatMoney(summary.ingresos, view)}
        />
        <Stat
          icon={<TrendingDown className="h-4 w-4 text-red-600" />}
          label="Gastos"
          value={formatMoney(summary.gastos, view)}
        />
        <Stat
          icon={<PiggyBank className="h-4 w-4 text-primary" />}
          label={`Ahorro ${(summary.tasaAhorro * 100).toFixed(0)}%`}
          value={formatMoney(summary.ahorro, view)}
        />
      </div>

      {/* Patrimonio */}
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Landmark className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo total de cuentas</p>
            <p className="text-xl font-semibold">{formatMoney(patrimonio, view)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Ultimos movimientos */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Ultimos movimientos
        </h2>
        {recientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay movimientos este mes.</p>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {recientes.map((m) => {
                const kind = movementKind(m.tipo);
                const importe = convert(m.importe, m.moneda, view, rates);
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.concepto}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(m.fecha).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${movKindColor(kind)}`}>
                      {movKindSign(kind)}
                      {formatMoney(importe, view)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </MobileScreen>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-3">
        {icon}
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold leading-tight">{value}</span>
      </CardContent>
    </Card>
  );
}
