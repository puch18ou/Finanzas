"use client";

/**
 * src/components/mobile/MobileMovementEditor.tsx
 *
 * Editor de movimientos para la UI de movil: un unico MovementFormDialog
 * (el mismo del escritorio, que soporta gasto / ingreso / devolucion /
 * transferencia) controlado por contexto. Asi:
 *   - el boton ➕ flotante puede CREAR cualquier tipo (no solo gasto), y
 *   - cada fila de Movimientos puede EDITAR.
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { useMovements } from "@/hooks/useMovements";
import { MovementFormDialog } from "@/components/forms/MovementFormDialog";
import type { Movement } from "@/lib/db/schema";
import type { CreateMovementData } from "@/lib/repositories";

type MovementEditorCtx = {
  openCreate: () => void;
  openEdit: (movement: Movement) => void;
};

const Ctx = createContext<MovementEditorCtx | null>(null);

export function useMovementEditor(): MovementEditorCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useMovementEditor debe usarse dentro de <MobileMovementEditorProvider>",
    );
  }
  return ctx;
}

export function MobileMovementEditorProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { settings } = useSettings();
  const { data: currencies = [] } = useCurrencies();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { create, update, isMutating } = useMovements({});

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);

  const openCreate = useCallback(() => {
    setEditing(null);
    setOpen(true);
  }, []);

  const openEdit = useCallback((movement: Movement) => {
    setEditing(movement);
    setOpen(true);
  }, []);

  const handleSubmit = async (data: CreateMovementData) => {
    if (editing) await update({ id: editing.id, patch: data });
    else await create(data);
    setOpen(false);
    setEditing(null);
  };

  return (
    <Ctx.Provider value={{ openCreate, openEdit }}>
      {children}
      <MovementFormDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        initial={editing}
        currencies={currencies}
        categories={categories}
        accounts={accounts}
        monedaLocal={settings?.monedaLocal ?? "EUR"}
        defaultAccountId={settings?.cuentaPorDefectoId ?? null}
        loading={isMutating}
        onSubmit={handleSubmit}
      />
    </Ctx.Provider>
  );
}
