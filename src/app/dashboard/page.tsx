"use client";

/**
 * Dashboard — pagina principal de la app.
 *
 * En este lote es solo un placeholder. En el Lote 6 (Vistas calculadas)
 * meteremos los KPIs reales: ingresos del mes, gastos del mes, ahorro,
 * patrimonio neto, grafico de barras por categoria, etc.
 */

import { useSettings } from "@/hooks/useSettings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  const { settings } = useSettings();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Vista general de tu situacion financiera
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bienvenido a Finanzas</CardTitle>
          <CardDescription>
            La app esta arrancada y la base de datos funciona.
            <br />
            En proximos lotes esta pantalla mostrara tus KPIs reales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settings && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Moneda local</dt>
                <dd className="font-medium">{settings.monedaLocal}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Moneda de visualizacion</dt>
                <dd className="font-medium">{settings.monedaVista}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Periodo activo</dt>
                <dd className="font-medium">
                  {settings.mesActual}/{settings.anioActual}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Objetivo ahorro</dt>
                <dd className="font-medium">
                  {(settings.objetivoAhorroPct * 100).toFixed(0)}%
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
