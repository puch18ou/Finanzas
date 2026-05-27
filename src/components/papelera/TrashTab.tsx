"use client";

/**
 * src/components/papelera/TrashTab.tsx
 *
 * Contenido de un tab de la papelera. Para un tipo dado:
 *   - Carga el listado
 *   - Tabla con Nombre, Subtitulo, Fecha de borrado, acciones
 *   - Botones Restaurar / Borrar definitivamente por fila
 *
 * Se reusa el mismo componente para todos los tipos cambiando la prop.
 */

import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import {
  useTrashActions,
  useTrashList,
} from "@/hooks/useTrash";
import type { TrashItemType, TrashItem } from "@/lib/repositories";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { formatDateLong } from "@/lib/utils/dates";

type Props = {
  type: TrashItemType;
  emptyMessage?: string;
};

export function TrashTab({ type, emptyMessage }: Props) {
  const { data: items = [], isLoading } = useTrashList(type);
  const { restore, hardDelete, isMutating } = useTrashActions();
  const [toHardDelete, setToHardDelete] = useState<TrashItem | null>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage ?? "No hay elementos de este tipo en la papelera."}
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Detalle</TableHead>
            <TableHead>Borrado el</TableHead>
            <TableHead className="w-[200px] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => (
            <TableRow key={it.id}>
              <TableCell className="font-medium">{it.displayName}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {it.subtitle ?? "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground tabular-nums">
                {formatDateLong(it.deletedAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => restore({ type, id: it.id })}
                    disabled={isMutating}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Restaurar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setToHardDelete(it)}
                    disabled={isMutating}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Borrar
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DeleteConfirmation
        open={!!toHardDelete}
        onOpenChange={(v) => !v && setToHardDelete(null)}
        title="Borrar definitivamente"
        description={
          toHardDelete
            ? `"${toHardDelete.displayName}" se eliminara para siempre. Esta accion NO se puede deshacer.`
            : ""
        }
        loading={isMutating}
        onConfirm={async () => {
          if (toHardDelete) {
            await hardDelete({ type, id: toHardDelete.id });
            setToHardDelete(null);
          }
        }}
      />
    </>
  );
}
