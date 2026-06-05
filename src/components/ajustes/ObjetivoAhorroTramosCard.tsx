"use client";

/**
 * ============================================================================
 *  src/components/ajustes/ObjetivoAhorroTramosCard.tsx
 * ============================================================================
 *
 *  Editor del objetivo de ahorro con vigencia (tramos). Cada fila es "a partir
 *  de este mes, el objetivo pasa a ser X% y/o Y/mes". El tramo base ("desde
 *  siempre") no tiene mes. Para un mes concreto aplica el tramo con mayor
 *  `desde` <= ese mes (ver domain/tramos).
 *
 *  Persistencia inmediata: los inputs son no controlados y guardan al perder
 *  el foco (onBlur), para no pelear con los refetch de react-query.
 * ============================================================================
 */

import { Plus, Trash2 } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useObjetivoTramos } from "@/hooks/useObjetivoTramos";
import { resolveTramo, ordenarTramos } from "@/lib/domain/tramos";
import { formatAmount } from "@/lib/domain/currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ObjetivoAhorroTramosCard({
  monedaLocal,
}: {
  monedaLocal: string;
}) {
  const { settings } = useSettings();
  const { tramos, create, update, remove } = useObjetivoTramos();

  const ordenados = ordenarTramos(tramos);

  // Objetivo vigente este mes (para el resumen superior).
  const hoy = new Date();
  const vigente = resolveTramo(tramos, hoy.getFullYear(), hoy.getMonth() + 1);

  const monedaBase = settings?.monedaLocal ?? monedaLocal;

  async function handleAdd() {
    const hayBase = tramos.some(
      (t) => t.desdeAnio == null || t.desdeMes == null,
    );
    // El primer tramo es el base ("desde siempre"); los siguientes arrancan
    // en el mes actual y heredan el valor del ultimo tramo como punto de
    // partida.
    const ultimo = ordenados[ordenados.length - 1];
    await create({
      desdeAnio: hayBase ? hoy.getFullYear() : null,
      desdeMes: hayBase ? hoy.getMonth() + 1 : null,
      pct: ultimo ? ultimo.pct : 0.2,
      importe: ultimo ? ultimo.importe : 0,
      moneda: ultimo ? ultimo.moneda : monedaBase,
    });
  }

  function persistDesde(id: string, value: string) {
    if (!value) {
      void update({ id, patch: { desdeAnio: null, desdeMes: null } });
      return;
    }
    const [y, m] = value.split("-").map(Number);
    if (!y || !m) return;
    void update({ id, patch: { desdeAnio: y, desdeMes: m } });
  }

  function persistPct(id: string, value: string) {
    const n = Number(value);
    void update({ id, patch: { pct: isNaN(n) || n < 0 ? 0 : n / 100 } });
  }

  function persistImporte(id: string, value: string) {
    const n = Number(value);
    void update({ id, patch: { importe: isNaN(n) || n < 0 ? 0 : n } });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Objetivo de ahorro</CardTitle>
        <CardDescription>
          Cuanto quieres ahorrar cada mes (por % de ingresos y/o importe fijo).
          Anade un cambio con fecha cuando suba el sueldo o cambien tus gastos:
          cada tramo aplica desde su mes en adelante hasta el siguiente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tramos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes objetivo de ahorro. Anade uno para empezar a hacer
            seguimiento.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Este mes:{" "}
              {vigente && (vigente.pct > 0 || vigente.importe > 0) ? (
                <span className="font-medium text-foreground">
                  {vigente.pct > 0 ? `${(vigente.pct * 100).toFixed(0)}%` : ""}
                  {vigente.pct > 0 && vigente.importe > 0 ? " · " : ""}
                  {vigente.importe > 0
                    ? formatAmount(vigente.importe, vigente.moneda)
                    : ""}
                </span>
              ) : (
                <span className="font-medium text-foreground">sin objetivo</span>
              )}
            </p>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_90px_1fr_auto] items-end gap-2 text-xs text-muted-foreground">
                <span>Desde</span>
                <span>Objetivo (%)</span>
                <span>Importe / mes</span>
                <span />
              </div>
              {ordenados.map((t) => {
                const esBase = t.desdeAnio == null || t.desdeMes == null;
                const monthValue = esBase
                  ? ""
                  : `${t.desdeAnio}-${String(t.desdeMes).padStart(2, "0")}`;
                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-[1fr_90px_1fr_auto] items-center gap-2"
                  >
                    <Input
                      type="month"
                      defaultValue={monthValue}
                      placeholder="Desde siempre"
                      title={
                        esBase
                          ? "Tramo base: aplica desde siempre. Pon un mes para acotarlo."
                          : undefined
                      }
                      onBlur={(e) => persistDesde(t.id, e.target.value)}
                    />
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      max={100}
                      defaultValue={Number((t.pct * 100).toFixed(0))}
                      onBlur={(e) => persistPct(t.id, e.target.value)}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={t.importe}
                      onBlur={(e) => persistImporte(t.id, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar tramo"
                      onClick={() => void remove(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="mr-1 h-4 w-4" />
            {tramos.length === 0 ? "Anadir objetivo" : "Anadir cambio"}
          </Button>
          <Label className="text-xs font-normal text-muted-foreground">
            El importe esta en {monedaBase}. Deja % o importe en 0 para no
            usarlo.
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
