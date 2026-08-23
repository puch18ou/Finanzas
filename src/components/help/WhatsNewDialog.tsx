"use client";

/**
 * src/components/help/WhatsNewDialog.tsx
 *
 * Al abrir una version nueva, muestra un aviso corto con las novedades de las
 * versiones que te has saltado desde la ultima vista en ESTE dispositivo
 * (device-local, localStorage). Se marca como vista al mostrarlo.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  LATEST_VERSION,
  entriesNewerThan,
  type ChangelogEntry,
} from "@/lib/help/changelog";

const KEY = "finanzas.changelog.lastSeen";

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    let lastSeen: string | null = null;
    try {
      lastSeen = window.localStorage.getItem(KEY);
    } catch {
      // sin acceso a localStorage: no mostramos nada
      return;
    }
    if (lastSeen === LATEST_VERSION) return; // nada nuevo

    const nuevas = entriesNewerThan(lastSeen);
    // Marcamos como vista para no repetir en el proximo arranque.
    try {
      window.localStorage.setItem(KEY, LATEST_VERSION);
    } catch {
      // ignorar
    }
    if (nuevas.length > 0) {
      setEntries(nuevas);
      setOpen(true);
    }
  }, []);

  if (entries.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novedades</DialogTitle>
          <DialogDescription>Lo nuevo desde tu última versión.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto">
          {entries.map((e) => (
            <div key={e.version}>
              <p className="text-sm font-semibold">v{e.version}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                {e.cambios.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
