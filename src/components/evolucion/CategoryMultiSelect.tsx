"use client";

/**
 * src/components/evolucion/CategoryMultiSelect.tsx
 *
 * Selector MULTIPLE de categorias (no existia en la app; todos los selectores
 * eran de valor unico). Se usa en la pestaña "Por categoria" de Evolucion para
 * elegir que categorias comparar mes a mes.
 *
 * UI: un boton que abre un popover con buscador + lista de casillas. Muestra un
 * punto del color de cada categoria. El estado (ids seleccionados) lo gestiona
 * el componente padre.
 */

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils/cn";

export type CategoryOption = {
  id: string;
  nombre: string;
  color?: string | null;
};

type Props = {
  options: CategoryOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  /** Maximo de categorias seleccionables a la vez (opcional). */
  max?: number;
  className?: string;
};

export function CategoryMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Selecciona categorias",
  max,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [options, query]);

  const atMax = max != null && selected.length >= max;

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      if (atMax) return;
      onChange([...selected, id]);
    }
  }

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.nombre ?? "1 categoria")
        : `${selected.length} categorias`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            selected.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] bg-popover p-0 shadow-lg"
        style={{ backgroundColor: "var(--color-popover)" }}
        align="start"
      >
        <div className="border-b p-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar categoria..."
            className="h-8"
          />
          {max != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              {selected.length}/{max} seleccionadas
            </p>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              Sin resultados
            </p>
          ) : (
            filtered.map((o) => {
              const checked = selectedSet.has(o.id);
              const disabled = !checked && atMax;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(o.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border"
                    style={{ backgroundColor: o.color ?? "transparent" }}
                  />
                  <span className="flex-1 truncate">{o.nombre}</span>
                  {checked && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange([])}
            >
              Limpiar seleccion
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
