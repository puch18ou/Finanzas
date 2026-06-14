"use client";

/**
 * src/components/backup/AutoBackupRunner.tsx
 *
 * Al abrir la app (una vez por sesion) crea la copia de seguridad del dia si
 * aun no existe. Best-effort y silencioso. Rotacion y compresion las maneja
 * local-backup-service. No pinta nada. Se monta dentro de DatabaseReady.
 */

import { useEffect, useRef } from "react";
import { useRepos } from "@/contexts/DatabaseProvider";
import {
  createDailyBackup,
  todayBackupExists,
  isTauriRuntime,
} from "@/lib/services/local-backup-service";

export function AutoBackupRunner() {
  const repos = useRepos();
  const lanzado = useRef(false);

  useEffect(() => {
    if (lanzado.current) return;
    if (!isTauriRuntime()) return;
    lanzado.current = true;

    (async () => {
      try {
        // Una copia por dia: si ya existe la de hoy, no re-exportamos.
        if (await todayBackupExists()) return;
        await createDailyBackup(repos.backup);
      } catch (e) {
        console.error("[backup] no se pudo crear la copia diaria", e);
      }
    })();
  }, [repos]);

  return null;
}
