"use client";

/**
 * src/hooks/useBackup.ts
 *
 * Hook para export/import del backup JSON.
 *
 * NOTA TYPESCRIPT
 * ---------------
 * `repos` esta tipado EXPLICITAMENTE como Repositories. Es necesario
 * porque llamamos a `repos.backup.validateBackup(obj)`, que es una
 * assertion function (firma con `asserts obj is BackupFile`). TS exige
 * que el caller de una assertion tenga tipo explicito, no inferido.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRepos } from "@/contexts/DatabaseProvider";
import type { Repositories } from "@/lib/repositories";
import {
  downloadJson,
  readJsonFile,
  type BackupFile,
} from "@/lib/services/backup-service";
import { isMobileApp } from "@/lib/utils/platform";

export function useBackup() {
  const repos: Repositories = useRepos();
  const qc = useQueryClient();

  const exportMutation = useMutation({
    mutationFn: async () => {
      const data = await repos.backup.exportAll();
      const date = new Date().toISOString().slice(0, 10);
      const filename = `finanzas-backup-${date}.json`;
      if (isMobileApp()) {
        // Movil: abrir el selector de compartir de Android (el usuario decide
        // donde enviarlo/guardarlo). Import dinamico: solo carga los plugins
        // de Tauri cuando de verdad se usa en el movil.
        const { shareBackupJson } = await import(
          "@/lib/services/backup-share"
        );
        await shareBackupJson(filename, data);
      } else {
        // Escritorio/navegador: descarga clasica.
        downloadJson(filename, data);
      }
      return data;
    },
    onSuccess: () => {
      toast.success(
        isMobileApp() ? "Elige donde guardar o enviar" : "Backup descargado",
      );
    },
    onError: (e) => {
      toast.error(
        `No se pudo exportar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const obj = await readJsonFile(file);
      // valida y lanza si no es valido
      repos.backup.validateBackup(obj);
      await repos.backup.importAll(obj as BackupFile);
    },
    onSuccess: () => {
      qc.invalidateQueries(); // todo cambia
      toast.success("Datos importados correctamente");
    },
    onError: (e) => {
      toast.error(
        `No se pudo importar: ${e instanceof Error ? e.message : "error"}`,
      );
    },
  });

  return {
    exportAll: exportMutation.mutateAsync,
    importAll: importMutation.mutateAsync,
    isExporting: exportMutation.isPending,
    isImporting: importMutation.isPending,
  };
}
