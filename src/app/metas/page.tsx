"use client";

/**
 * ============================================================================
 *  src/app/metas/page.tsx
 * ============================================================================
 *
 *  Listado de metas de ahorro como cards individuales.
 *  El progreso se calcula del saldo de la cuenta vinculada si la hay.
 * ============================================================================
 */

import { useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  Target,
  CheckCircle2,
  AlertCircle,
  Calendar as CalIcon,
  Link2,
} from "lucide-react";
import { useGoals } from "@/hooks/useGoals";
import { useAccounts, useAccountBalances } from "@/hooks/useAccounts";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { GoalFormDialog } from "@/components/forms/GoalFormDialog";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Goal } from "@/lib/db/schema";
import {
  buildRatesMap,
  convert,
  formatAmount,
} from "@/lib/domain/currency";
import { calculateGoalProgress } from "@/lib/domain/goals";
import { formatDateLong } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

export default function MetasPage() {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { accounts } = useAccounts();
  const { balances } = useAccountBalances();
  const {
    goals,
    isLoading,
    create,
    update,
    remove,
    isMutating,
  } = useGoals();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [toDelete, setToDelete] = useState<Goal | null>(null);

  const rates = useMemo(() => buildRatesMap(currencies), [currencies]);

  const effectiveGoal = (goal: Goal): Goal => {
    if (!goal.cuentaVinculadaId) return goal;
    const acc = accounts.find((a) => a.id === goal.cuentaVinculadaId);
    if (!acc) return goal;
    try {
      const saldoCuenta = balances.get(acc.id) ?? 0;
      const saldoEnMoneda = convert(saldoCuenta, acc.moneda, goal.moneda, rates);
      return { ...goal, yaAhorrado: Math.max(0, saldoEnMoneda) };
    } catch {
      return goal;
    }
  };

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metas</h1>
          <p className="text-sm text-muted-foreground">
            Objetivos de ahorro con fecha. El progreso se actualiza
            automaticamente si vinculas una cuenta.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva meta
        </Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando metas...</p>
      ) : goals.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sin metas todavia</CardTitle>
            <CardDescription>
              Define un objetivo de ahorro (entrada para piso, viaje, fondo
              de emergencia...) con su fecha y haz seguimiento del progreso.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((rawGoal) => {
            const goal = effectiveGoal(rawGoal);
            const progress = calculateGoalProgress(goal);
            const accountAlias = goal.cuentaVinculadaId
              ? accounts.find((a) => a.id === goal.cuentaVinculadaId)?.alias ?? null
              : null;
            return (
              <GoalCard
                key={rawGoal.id}
                goal={goal}
                accountAlias={accountAlias}
                progress={progress}
                onEdit={() => {
                  setEditing(rawGoal);
                  setFormOpen(true);
                }}
                onDelete={() => setToDelete(rawGoal)}
              />
            );
          })}
        </div>
      )}

      <GoalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        currencies={currencies}
        accounts={accounts}
        monedaLocal={settings.monedaLocal}
        loading={isMutating}
        onSubmit={async (data) => {
          // Normalizamos `cuentaVinculadaId` y `notas` de undefined a null
          // para que el tipo encaje con el de la BD (que es `string | null`,
          // no `string | null | undefined`).
          const cuentaVinculadaId = data.cuentaVinculadaId ?? null;
          const notas = data.notas ?? null;

          if (editing) {
            await update({
              id: editing.id,
              patch: {
                nombre: data.nombre,
                importeObjetivo: data.importeObjetivo,
                yaAhorrado: data.yaAhorrado,
                moneda: data.moneda,
                fechaObjetivo: data.fechaObjetivo,
                cuentaVinculadaId,
                notas,
              },
            });
          } else {
            await create({
              nombre: data.nombre,
              importeObjetivo: data.importeObjetivo,
              yaAhorrado: data.yaAhorrado,
              moneda: data.moneda,
              fechaObjetivo: data.fechaObjetivo,
              cuentaVinculadaId,
              notas,
              completada: false,
            });
          }
        }}
      />

      <DeleteConfirmation
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Borrar meta"
        description={
          toDelete
            ? `La meta "${toDelete.nombre}" pasara a la papelera.`
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

function GoalCard({
  goal,
  accountAlias,
  progress,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  accountAlias: string | null;
  progress: ReturnType<typeof calculateGoalProgress>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fechaObjetivo =
    goal.fechaObjetivo instanceof Date
      ? goal.fechaObjetivo
      : new Date(goal.fechaObjetivo);

  const statusBadge = progress.completada ? (
    <Badge variant="default" className="bg-primary">
      <CheckCircle2 className="mr-1 h-3 w-3" /> Completada
    </Badge>
  ) : progress.vencida ? (
    <Badge variant="destructive">
      <AlertCircle className="mr-1 h-3 w-3" /> Vencida
    </Badge>
  ) : (
    <Badge variant="secondary">
      <Target className="mr-1 h-3 w-3" /> En progreso
    </Badge>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate">{goal.nombre}</CardTitle>
          <CardDescription className="flex items-center gap-2 mt-1">
            <CalIcon className="h-3 w-3" />
            {formatDateLong(fechaObjetivo)}
            {accountAlias && (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  {accountAlias}
                </span>
              </>
            )}
          </CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1">
          {statusBadge}
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Editar" className="h-7 w-7">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label="Borrar"
              className="h-7 w-7 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium tabular-nums">
              {formatAmount(goal.yaAhorrado, goal.moneda)}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              / {formatAmount(goal.importeObjetivo, goal.moneda)}
            </span>
          </div>
          <Progress
            value={progress.progreso * 100}
            className={cn(
              progress.completada && "[&>div]:bg-primary",
              progress.vencida && "[&>div]:bg-destructive",
            )}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{(progress.progreso * 100).toFixed(1)}%</span>
            {progress.restante > 0 && (
              <span className="tabular-nums">
                Faltan {formatAmount(progress.restante, goal.moneda)}
              </span>
            )}
          </div>
        </div>

        {!progress.completada && (
          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Meses restantes</p>
              <p
                className={cn(
                  "font-semibold tabular-nums",
                  progress.vencida && "text-destructive",
                )}
              >
                {progress.mesesRestantes >= 0
                  ? progress.mesesRestantes
                  : `${Math.abs(progress.mesesRestantes)} de retraso`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ahorro mensual</p>
              <p className="font-semibold tabular-nums">
                {progress.ahorroMensualNecesario > 0
                  ? formatAmount(progress.ahorroMensualNecesario, goal.moneda)
                  : "—"}
              </p>
            </div>
          </div>
        )}

        {goal.notas && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            {goal.notas}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
