"use client";

/**
 * src/components/ajustes/ExportInvestmentsCard.tsx
 *
 * Boton (solo PC) para exportar las inversiones a un JSON completo: una entrada
 * por posicion con sus metricas actuales (valor, coste, P/L, en moneda nativa y
 * en moneda vista) y el historial de sus aportaciones/retiradas. Incluye un
 * resumen de la cartera. Util para guardar copia o analizar fuera de la app.
 *
 * Reutiliza el mismo mecanismo de descarga que el backup (`downloadJson`).
 */

import { useState } from "react";
import { Download, LineChart } from "lucide-react";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { buildRatesMap, convert } from "@/lib/domain/currency";
import {
  calculateInvestmentMetrics,
  summarizePortfolio,
} from "@/lib/domain/investments";
import { downloadJson } from "@/lib/services/backup-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ExportInvestmentsCard() {
  const repos = useRepos();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const [exportando, setExportando] = useState(false);

  const handleExport = async () => {
    setExportando(true);
    try {
      const view = settings?.monedaVista ?? "EUR";
      const rates = buildRatesMap(currencies);

      // Posiciones activas + archivadas (cada una lleva su flag `archivada`).
      const [activas, archivadas, contribs] = await Promise.all([
        repos.investments.list(),
        repos.investments.listArchived(),
        repos.investmentContributions.listAll(),
      ]);
      const todas = [...activas, ...archivadas];

      // Agrupa las aportaciones por inversion (una sola consulta).
      const porInversion = new Map<string, typeof contribs>();
      for (const c of contribs) {
        const arr = porInversion.get(c.investmentId) ?? [];
        arr.push(c);
        porInversion.set(c.investmentId, arr);
      }

      const inversiones = todas.map((inv) => {
        const m = calculateInvestmentMetrics(inv);
        let valorActualVista: number | null = null;
        try {
          valorActualVista = convert(m.valorActual, inv.moneda, view, rates);
        } catch {
          valorActualVista = null; // moneda sin tipo de cambio
        }
        return {
          ...inv,
          metricas: { ...m, valorActualVista },
          aportaciones: porInversion.get(inv.id) ?? [],
        };
      });

      const data = {
        tipo: "finanzas-export-inversiones",
        version: 1,
        exportadoEl: new Date().toISOString(),
        monedaVista: view,
        // El resumen de cartera se calcula solo sobre las activas (las
        // archivadas tienen valor 0 y quedan fuera de los KPIs).
        resumen: summarizePortfolio(activas, rates, view),
        inversiones,
      };

      const fecha = new Date().toISOString().slice(0, 10);
      downloadJson(`finanzas-inversiones-${fecha}.json`, data);
      toast.success(`Inversiones exportadas (${todas.length} posiciones)`);
    } catch (e) {
      toast.error(
        `No se pudo exportar: ${e instanceof Error ? e.message : "error"}`,
      );
    } finally {
      setExportando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChart className="h-4 w-4" />
          Exportar inversiones
        </CardTitle>
        <CardDescription>
          Descarga un JSON con todas tus posiciones (valor, coste, P/L) y el
          historial de aportaciones de cada una.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={handleExport} disabled={exportando}>
          <Download className="mr-2 h-4 w-4" />
          {exportando ? "Exportando..." : "Exportar a JSON"}
        </Button>
      </CardContent>
    </Card>
  );
}
