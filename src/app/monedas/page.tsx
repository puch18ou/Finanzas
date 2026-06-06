"use client";

/**
 * src/app/monedas/page.tsx
 *
 * CRUD de monedas. Particularidades:
 *  - Borrado FISICO: fallara si la moneda esta en uso (foreign keys).
 *  - La fila correspondiente a `monedaVista` se resalta y no se puede borrar.
 *  - El tipo de cambio se muestra como "1 X = Y MonedaVista".
 */

import { useState } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  Coins,
  Star,
  DownloadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrenciesManagement } from "@/hooks/useCurrenciesManagement";
import { useSettings } from "@/hooks/useSettings";
import { CurrencyFormDialog } from "@/components/forms/CurrencyFormDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { Currency } from "@/lib/db/schema";

export default function MonedasPage() {
  const { settings } = useSettings();
  const {
    currencies,
    isLoading,
    create,
    update,
    remove,
    refreshRates,
    isRefreshingRates,
    isMutating,
  } = useCurrenciesManagement();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);
  const [toDelete, setToDelete] = useState<Currency | null>(null);

  if (!settings || isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando monedas...</p>;
  }

  const monedaVista = settings.monedaVista;

  const handleRefreshRates = async () => {
    try {
      const r = await refreshRates({ viewCurrency: monedaVista });
      if (r.noCubiertas.length === 0) {
        toast.success(`${r.actualizadas} tipos de cambio actualizados`);
      } else {
        toast.warning(
          `${r.actualizadas} actualizados · sin datos para: ${r.noCubiertas.join(", ")}`,
        );
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "No se pudieron actualizar los tipos de cambio",
      );
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monedas</h1>
          <p className="text-sm text-muted-foreground">
            Catalogo de monedas y tipos de cambio respecto a la moneda
            de visualizacion ({monedaVista}).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefreshRates}
            disabled={isRefreshingRates}
          >
            <DownloadCloud
              className={cn(
                "mr-2 h-4 w-4",
                isRefreshingRates && "animate-pulse",
              )}
            />
            Actualizar tipos
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Anadir moneda
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Catalogo de monedas
            </span>
          </CardTitle>
          <CardDescription>
            {currencies.length} monedas registradas. El borrado falla si la
            moneda esta en uso (en gastos, cuentas, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currencies.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay monedas. Algo raro paso con el seed.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Codigo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-[80px]">Simbolo</TableHead>
                  <TableHead className="text-right">
                    1 unidad = (en {monedaVista})
                  </TableHead>
                  <TableHead className="w-[100px]">Estado</TableHead>
                  <TableHead className="w-[100px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.map((c) => {
                  const isVista = c.code === monedaVista;
                  return (
                    <TableRow key={c.code}>
                      <TableCell className="font-mono font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {c.code}
                          {isVista && <Star className="h-3 w-3 fill-primary text-primary" />}
                        </span>
                      </TableCell>
                      <TableCell>{c.nombre}</TableCell>
                      <TableCell className="text-lg">{c.simbolo}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.tipoCambioVista.toLocaleString("es-ES", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        })}
                      </TableCell>
                      <TableCell>
                        {c.activa ? (
                          <Badge variant="secondary">activa</Badge>
                        ) : (
                          <Badge variant="outline">inactiva</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(c);
                              setFormOpen(true);
                            }}
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(c)}
                            disabled={isVista}
                            aria-label="Borrar"
                            className="text-destructive hover:text-destructive disabled:opacity-30"
                            title={isVista ? "No se puede borrar la moneda de visualizacion" : "Borrar"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CurrencyFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        monedaVista={monedaVista}
        loading={isMutating}
        onSubmit={async (data) => {
          if (editing) {
            const { code: _code, ...patch } = data;
            await update({ code: editing.code, patch });
          } else {
            await create(data);
          }
        }}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar moneda"
        description={
          toDelete
            ? `La moneda "${toDelete.code}" (${toDelete.nombre}) se borrara permanentemente. Si esta en uso, fallara y se mostrara un aviso.`
            : ""
        }
        loading={isMutating}
        confirmLabel="Borrar permanentemente"
        onConfirm={async () => {
          if (toDelete) {
            await remove(toDelete.code);
            setToDelete(null);
          }
        }}
      />
    </div>
  );
}
