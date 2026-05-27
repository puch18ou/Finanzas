"use client";

/**
 * ============================================================================
 *  src/components/crud/DeleteConfirmation.tsx
 * ============================================================================
 *
 *  Wrapper sobre AlertDialog de shadcn para confirmar borrados. Parametros:
 *
 *    open / onOpenChange    estado controlado del modal
 *    title                  e.g. "¿Borrar categoria?"
 *    description            texto explicativo, opcionalmente con el nombre
 *    onConfirm              callback async; el modal se cierra solo
 *    confirmLabel           texto del boton rojo (por defecto "Borrar")
 *    loading                deshabilita el boton de confirmacion
 *
 *  Patron de uso:
 *
 *    const [toDelete, setToDelete] = useState<Row | null>(null);
 *    <DeleteConfirmation
 *      open={!!toDelete}
 *      onOpenChange={(v) => !v && setToDelete(null)}
 *      title="¿Borrar categoria?"
 *      description={`La categoria "${toDelete?.nombre}" pasara a la papelera.`}
 *      onConfirm={async () => {
 *        if (toDelete) await remove(toDelete.id);
 *        setToDelete(null);
 *      }}
 *      loading={isMutating}
 *    />
 * ============================================================================
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  loading?: boolean;
};

export function DeleteConfirmation({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Borrar",
  loading = false,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // evita cierre automatico antes del await
              void onConfirm();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Borrando..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
