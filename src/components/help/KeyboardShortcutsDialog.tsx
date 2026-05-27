"use client";

/**
 * src/components/help/KeyboardShortcutsDialog.tsx
 *
 * Modal con la lista de atajos de teclado. Se abre con Ctrl+/.
 *
 * El estado del modal lo gestiona el provider raiz (ShortcutsProvider)
 * para que el atajo este disponible desde cualquier pantalla.
 */

import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Shortcut = {
  keys: string[];
  description: string;
};

type Section = {
  title: string;
  shortcuts: Shortcut[];
};

const SECTIONS: Section[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Abrir paleta de comandos" },
      { keys: ["Ctrl", "/"], description: "Mostrar atajos de teclado" },
      { keys: ["Ctrl", "Shift", "G"], description: "Anadir gasto rapido" },
      { keys: ["Esc"], description: "Cerrar dialogos / modales" },
    ],
  },
  {
    title: "Paleta de comandos (Ctrl+K)",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navegar entre opciones" },
      { keys: ["Enter"], description: "Ejecutar la opcion seleccionada" },
      { keys: ["Esc"], description: "Cerrar la paleta" },
    ],
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KeyboardShortcutsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atajos de teclado
          </DialogTitle>
          <DialogDescription>
            Estos son los atajos disponibles en la app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h3>
              <ul className="space-y-1.5">
                {section.shortcuts.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
                  >
                    <span className="text-sm">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, idx) => (
                        <Kbd key={idx}>{k}</Kbd>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="px-1.5 py-0 font-mono text-[11px] tabular-nums"
    >
      {children}
    </Badge>
  );
}
