"use client";

/**
 * src/components/backup/LocalBackupsCard.tsx
 *
 * Copias de seguridad AUTOMATICAS en disco (.json.gz). Lista las copias
 * existentes (una por dia, se conservan las 10 mas recientes) y permite crear
 * una al momento, restaurar (reemplaza todos los datos) o borrar.
 */

import { useState } from "react";
import { HardDriveDownload, RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { useLocalBackups } from "@/hooks/useLocalBackups";
import { KEEP_BACKUPS } from "@/lib/services/local-backup-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { parseDateOnlyString, formatInstantLong } from "@/lib/utils/dates";

function diaLargo(dia: string): string {
  try {
    return formatInstantLong(parseDateOnlyString(dia), false);
  } catch {
    return dia;
  }
}

export function LocalBackupsCard() {
  const {
    backups,
    isLoading,
    create,
    isCreating,
    restore,
    isRestoring,
    remove,
    isRemoving,
  } = useLocalBackups();

  const [toRestore, setToRestore] = useState<string | null>(null);

  const handleRestore = async () => {
    if (!toRestore) return;
    await restore(toRestore);
    setToRestore(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDriveDownload className="h-4 w-4" />
          Copias automaticas
        </CardTitle>
        <CardDescription>
          Cada dia que abres la app se guarda una copia comprimida en el equipo.
          Se conservan las {KEEP_BACKUPS} mas recientes; las antiguas se borran
          solas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          onClick={() => create()}
          disabled={isCreating}
        >
          <HardDriveDownload className="mr-2 h-4 w-4" />
          {isCreating ? "Creando..." : "Crear copia ahora"}
        </Button>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando copias...</p>
        ) : backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aun no hay copias. Se creara una automaticamente al abrir la app.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {backups.map((b) => (
              <li
                key={b.name}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="text-sm tabular-nums">{diaLargo(b.dia)}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setToRestore(b.name)}
                    disabled={isRestoring || isRemoving}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Restaurar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(b.name)}
                    disabled={isRestoring || isRemoving}
                    aria-label="Borrar copia"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog
        open={!!toRestore}
        onOpenChange={(v) => !v && setToRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Restaurar copia
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a restaurar la copia del{" "}
              <strong>{toRestore ? diaLargo(backupDay(toRestore)) : ""}</strong>.
              Esto <strong>borrara todos los datos actuales</strong> y los
              reemplazara por los de la copia. Esta accion NO se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={isRestoring}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRestoring ? "Restaurando..." : "Si, restaurar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Saca el dia (YYYY-MM-DD) del nombre de fichero para el dialogo. */
function backupDay(name: string): string {
  const m = name.match(/(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? name;
}
