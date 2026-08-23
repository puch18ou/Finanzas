"use client";

/**
 * src/components/backup/AutoBackupRunner.tsx
 *
 * Al abrir la app (una vez por sesion) crea la copia de seguridad del dia si
 * aun no existe. Best-effort y silencioso. Rotacion y compresion las maneja
 * local-backup-service. No pinta nada. Se monta dentro de DatabaseReady.
 */

import { useEffect, useRef } from "react";
import { useRepos, useDbControl } from "@/contexts/DatabaseProvider";
import { useAuth } from "@/contexts/AuthProvider";
import {
  createDailyBackup,
  todayBackupExists,
  isTauriRuntime,
} from "@/lib/services/local-backup-service";

export function AutoBackupRunner() {
  const repos = useRepos();
  const { user } = useAuth();
  // Durante el DEMO la BD activa es la de ejemplo: no queremos que la copia
  // diaria guarde datos de ejemplo en lugar de los reales.
  const { demoActive } = useDbControl();
  const lanzado = useRef(false);

  useEffect(() => {
    if (lanzado.current) return;
    if (demoActive) return;
    if (!isTauriRuntime()) return;
    if (!user) return;
    lanzado.current = true;

    const userId = user.id;
    (async () => {
      try {
        // Una copia por dia y POR USUARIO: si ya existe la de hoy, no re-exportamos.
        if (await todayBackupExists(userId)) return;
        await createDailyBackup(repos.backup, userId);
      } catch (e) {
        console.error("[backup] no se pudo crear la copia diaria", e);
      }
    })();
  }, [repos, user, demoActive]);

  return null;
}
