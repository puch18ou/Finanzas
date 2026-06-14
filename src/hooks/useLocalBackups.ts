"use client";

/**
 * src/hooks/useLocalBackups.ts
 *
 * Gestiona las copias de seguridad LOCALES (.json.gz en disco): listar, crear
 * una ahora, restaurar y borrar. Ver local-backup-service.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type { Repositories } from "@/lib/repositories";
import {
  listLocalBackups,
  createDailyBackup,
  restoreLocalBackup,
  deleteLocalBackup,
} from "@/lib/services/local-backup-service";

export const LOCAL_BACKUPS_KEY = ["localBackups"] as const;

export function useLocalBackups() {
  const repos: Repositories = useRepos();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: LOCAL_BACKUPS_KEY,
    queryFn: () => listLocalBackups(),
  });

  const create = useMutation({
    mutationFn: () => createDailyBackup(repos.backup),
    onSuccess: (name) => {
      qc.invalidateQueries({ queryKey: LOCAL_BACKUPS_KEY });
      toast.success(name ? "Copia de seguridad creada" : "Copia no disponible");
    },
    onError: (e) =>
      toast.error(
        `No se pudo crear la copia: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  const restore = useMutation({
    mutationFn: (name: string) => restoreLocalBackup(repos.backup, name),
    onSuccess: () => {
      qc.invalidateQueries(); // todo cambia
      toast.success("Datos restaurados desde la copia");
    },
    onError: (e) =>
      toast.error(
        `No se pudo restaurar: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  const del = useMutation({
    mutationFn: (name: string) => deleteLocalBackup(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LOCAL_BACKUPS_KEY });
      toast.success("Copia borrada");
    },
    onError: (e) =>
      toast.error(
        `No se pudo borrar: ${e instanceof Error ? e.message : "error"}`,
      ),
  });

  return {
    backups: list.data ?? [],
    isLoading: list.isLoading,
    create: create.mutateAsync,
    isCreating: create.isPending,
    restore: restore.mutateAsync,
    isRestoring: restore.isPending,
    remove: del.mutateAsync,
    isRemoving: del.isPending,
  };
}
