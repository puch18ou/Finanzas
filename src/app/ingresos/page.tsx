"use client";

/**
 * ============================================================================
 *  src/app/ingresos/page.tsx
 * ============================================================================
 *
 *  Pagina de Ingresos con dos pestanas:
 *
 *    1. MENSUALES — tabla anual de 12 filas. Edicion inline en una hoja
 *       estilo Excel: salario, bonus, otros, notas.
 *
 *    2. PUNTUALES — tabla CRUD similar a Gastos: premios, bonus extra,
 *       regalos, etc.
 *
 *  Selector de anio arriba que afecta a ambas tablas.
 * ============================================================================
 */

import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useSettings } from "@/hooks/useSettings";
import { Wallet, Gift } from "lucide-react";
import { MonthlyIncomesTab } from "./MonthlyIncomesTab";
import { ExtraIncomesTab } from "./ExtraIncomesTab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function IngresosPage() {
  const { settings } = useSettings();
  const [anio, setAnio] = useState<number>(
    settings?.anioActual ?? new Date().getFullYear(),
  );

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ingresos</h1>
          <p className="text-sm text-muted-foreground">
            Salario mensual, bonus, ingresos puntuales.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="anio-ingresos" className="text-xs">Anio</Label>
            <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
              <SelectTrigger id="anio-ingresos" className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <Tabs defaultValue="mensuales">
        <TabsList>
          <TabsTrigger value="mensuales">
            <Wallet className="mr-2 h-4 w-4" />
            Mensuales
          </TabsTrigger>
          <TabsTrigger value="puntuales">
            <Gift className="mr-2 h-4 w-4" />
            Puntuales
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mensuales" className="mt-4">
          <MonthlyIncomesTab anio={anio} monedaLocal={settings.monedaLocal} />
        </TabsContent>

        <TabsContent value="puntuales" className="mt-4">
          <ExtraIncomesTab anio={anio} monedaLocal={settings.monedaLocal} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
