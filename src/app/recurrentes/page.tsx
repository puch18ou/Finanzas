"use client";

/**
 * src/app/recurrentes/page.tsx — Reglas recurrentes
 *
 * Lista de reglas activas/inactivas. Permite crear/editar/borrar reglas
 * manuales. Las reglas vinculadas (origenAutomatico != null) se muestran
 * pero NO son editables aqui — hay que ir a su pantalla padre.
 *
 * Cada vez que arranca la app, RecurringService genera los movements
 * pendientes (eso se hace en el DatabaseProvider modificado en este lote).
 */

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Lock,
  CheckCircle2,
  PauseCircle,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRecurringRules } from "@/hooks/useRecurringRules";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { RecurringRuleFormDialog } from "@/components/forms/RecurringRuleFormDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { RecurringRule } from "@/lib/db/schema";
import { formatAmount } from "@/lib/domain/currency";
import { useMaskMoney } from "@/contexts/PrivacyProvider";
import { formatDateLong } from "@/lib/utils/dates";

const TIPO_BADGE: Record<string, { label: string; className: string }> = {
  gasto: { label: "Gasto", className: "bg-destructive/10 text-destructive" },
  ingreso: { label: "Ingreso", className: "bg-primary/10 text-primary" },
  transferencia: {
    label: "Transferencia",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  cuota: { label: "Cuota", className: "bg-amber-500/10 text-amber-600" },
  intereses: {
    label: "Intereses",
    className: "bg-green-500/10 text-green-600",
  },
};

const ORIGEN_LABEL: Record<string, { label: string; path: string }> = {
  mortgage: { label: "Hipoteca", path: "/hipoteca" },
  debt: { label: "Deuda", path: "/deudas" },
  interest: { label: "Intereses cuenta", path: "/cuentas" },
  investment: { label: "Inversion periodica", path: "/inversiones" },
};

export default function RecurrentesPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const {
    rules,
    isLoading,
    create,
    update,
    remove,
    isMutating,
  } = useRecurringRules();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [toDelete, setToDelete] = useState<RecurringRule | null>(null);

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  const reglasManuales = rules.filter((r) => r.origenAutomatico === null);
  const reglasVinculadas = rules.filter((r) => r.origenAutomatico !== null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recurrentes</h1>
          <p className="text-sm text-muted-foreground">
            Reglas que generan movimientos automaticamente cada mes. Se
            ejecutan al arrancar la app si detectan meses pendientes.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva regla
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Tus reglas ({reglasManuales.length})</CardTitle>
          <CardDescription>
            Reglas manuales que has creado tu. Edita o elimina libremente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Cargando...
            </p>
          ) : reglasManuales.length === 0 ? (
            <div className="py-10 text-center">
              <CalendarIcon className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Aun no tienes reglas. Crea una para automatizar movimientos
                como tu salario, alquiler, suscripciones...
              </p>
            </div>
          ) : (
            <RuleTable
              rules={reglasManuales}
              onEdit={(r) => {
                setEditing(r);
                setFormOpen(true);
              }}
              onDelete={(r) => setToDelete(r)}
              vinculada={false}
            />
          )}
        </CardContent>
      </Card>

      {reglasVinculadas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reglas vinculadas ({reglasVinculadas.length})</CardTitle>
            <CardDescription>
              Reglas creadas automaticamente al configurar hipoteca, deudas
              o intereses de cuentas. Para modificarlas, ve a su pantalla.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RuleTable
              rules={reglasVinculadas}
              onEdit={(r) => {
                const origen = r.origenAutomatico;
                if (origen && ORIGEN_LABEL[origen]) {
                  router.push(ORIGEN_LABEL[origen].path);
                }
              }}
              onDelete={() => {}}
              vinculada={true}
            />
          </CardContent>
        </Card>
      )}

      <RecurringRuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        currencies={currencies}
        accounts={accounts}
        categories={categories}
        monedaLocal={settings.monedaLocal}
        loading={isMutating}
        onSubmit={async (data) => {
          if (editing) {
            await update({ id: editing.id, patch: data });
          } else {
            await create({
              nombre: data.nombre,
              tipoMovimiento: data.tipoMovimiento,
              importe: data.importe,
              moneda: data.moneda,
              cuentaOrigenId: data.cuentaOrigenId ?? null,
              cuentaDestinoId: data.cuentaDestinoId ?? null,
              categoriaId: data.categoriaId ?? null,
              categoriaTexto: data.categoriaTexto ?? null,
              diaDelMes: data.diaDelMes,
              fechaInicio: data.fechaInicio,
              fechaFin: data.fechaFin ?? null,
              activa: data.activa,
              notas: data.notas ?? null,
            });
          }
        }}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar regla"
        description={
          toDelete
            ? `"${toDelete.nombre}" pasara a la papelera. Los movimientos que ya genero NO se borraran.`
            : ""
        }
        loading={isMutating}
        onConfirm={async () => {
          if (toDelete) {
            await remove(toDelete.id);
            setToDelete(null);
          }
        }}
      />
    </div>
  );
}

function RuleTable({
  rules,
  onEdit,
  onDelete,
  vinculada,
}: {
  rules: RecurringRule[];
  onEdit: (r: RecurringRule) => void;
  onDelete: (r: RecurringRule) => void;
  vinculada: boolean;
}) {
  const mask = useMaskMoney();
  const money = (n: number, cur: string) => mask(formatAmount(n, cur));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right">Importe</TableHead>
          <TableHead>Dia</TableHead>
          <TableHead>Periodo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="w-[80px] text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((r) => {
          const badge = TIPO_BADGE[r.tipoMovimiento] ?? {
            label: r.tipoMovimiento,
            className: "",
          };
          const inicio =
            r.fechaInicio instanceof Date
              ? r.fechaInicio
              : new Date(r.fechaInicio);
          const fin = r.fechaFin
            ? r.fechaFin instanceof Date
              ? r.fechaFin
              : new Date(r.fechaFin)
            : null;
          const origenInfo = r.origenAutomatico
            ? ORIGEN_LABEL[r.origenAutomatico]
            : null;

          return (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {r.nombre}
                  {origenInfo && (
                    <Badge variant="outline" className="text-xs">
                      <Lock className="mr-1 h-3 w-3" />
                      {origenInfo.label}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={badge.className}>
                  {badge.label}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {money(r.importe, r.moneda)}
              </TableCell>
              <TableCell className="tabular-nums">{r.diaDelMes}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDateLong(inicio, false)}
                {fin ? ` → ${formatDateLong(fin, false)}` : " → ∞"}
              </TableCell>
              <TableCell>
                {r.activa ? (
                  <Badge variant="outline" className="text-primary border-primary/30">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Activa
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <PauseCircle className="mr-1 h-3 w-3" />
                    Pausada
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(r)}
                    aria-label={vinculada ? "Ir a la pantalla padre" : "Editar"}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!vinculada && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(r)}
                      className="text-destructive hover:text-destructive"
                      aria-label="Borrar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
