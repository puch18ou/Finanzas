"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MobileScreen } from "../MobileScreen";
import { movementKind, movKindColor, movKindSign } from "../movement-display";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useMovements } from "@/hooks/useMovements";
import { useCategories } from "@/hooks/useCategories";
import { buildRatesMap, convert } from "@/lib/domain/currency";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function MobileMovements() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();

  const view = settings?.monedaVista ?? "EUR";
  const now = new Date();
  const baseMes = settings?.mesActual ?? now.getMonth() + 1;
  const baseAnio = settings?.anioActual ?? now.getFullYear();

  const [offset, setOffset] = useState(0);
  // mes/anio objetivo aplicando el desplazamiento.
  const idx = baseAnio * 12 + (baseMes - 1) + offset;
  const anio = Math.floor(idx / 12);
  const mes = (idx % 12) + 1;

  const { movements } = useMovements({ anio, mes });
  const rates = buildRatesMap(currencies);

  const catName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.nombre]));
    return (m: { categoriaId: string | null; categoriaTexto: string | null }) =>
      (m.categoriaId && map.get(m.categoriaId)) || m.categoriaTexto || "";
  }, [categories]);

  const lista = [...movements].sort(
    (a, b) => +new Date(b.fecha) - +new Date(a.fecha),
  );

  return (
    <MobileScreen
      title="Movimientos"
      action={
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-24 text-center text-xs font-medium">
            {MESES[mes - 1]} {anio}
          </span>
          <Button size="icon" variant="ghost" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      {lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay movimientos este mes.</p>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {lista.map((m) => {
              const kind = movementKind(m.tipo);
              const importe = convert(m.importe, m.moneda, view, rates);
              const cat = catName(m);
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.concepto}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(m.fecha).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })}
                      {cat ? ` · ${cat}` : ""}
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
    </MobileScreen>
  );
}
