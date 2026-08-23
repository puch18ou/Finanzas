"use client";

/**
 * src/components/ajustes/ChangelogCard.tsx
 *
 * Historial completo de versiones y sus cambios (en Ajustes).
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CHANGELOG } from "@/lib/help/changelog";

export function ChangelogCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Novedades y versiones</CardTitle>
        <CardDescription>
          Historial de cambios de la app, de la más reciente a la más antigua.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 space-y-4 overflow-y-auto pr-2">
          {CHANGELOG.map((e) => (
            <div key={e.version}>
              <p className="text-sm font-medium">
                v{e.version}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  · {e.fecha}
                </span>
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                {e.cambios.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
