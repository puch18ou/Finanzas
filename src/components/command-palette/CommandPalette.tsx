"use client";

/**
 * ============================================================================
 *  src/components/command-palette/CommandPalette.tsx
 * ============================================================================
 *
 *  Paleta de comandos. Ctrl+K abre, fuzzy search, flechas + Enter.
 *
 *  NOTA IMPORTANTE — cambio de tema
 *  --------------------------------
 *  `update()` del repo de settings hace un PATCH parcial: solo necesita
 *  los campos que cambian. NO usamos { ...settings, tema } porque eso
 *  reenvia TODOS los campos (incluso ids y timestamps), lo que puede
 *  causar conflictos con el shape esperado por el repo. Pasamos solo
 *  { tema }.
 * ============================================================================
 */

import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Telescope,
  Receipt,
  Wallet,
  Landmark,
  PieChart,
  Target,
  Home as HomeIcon,
  CreditCard,
  Tags,
  Coins,
  Settings,
  Trash2,
  PlusCircle,
  Download,
  Sun,
  Moon,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useSettings } from "@/hooks/useSettings";
import { useQuickAdd } from "@/contexts/QuickAddProvider";
import { useBackup } from "@/hooks/useBackup";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CommandAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords?: string[];
  shortcut?: string;
  run: () => void | Promise<void>;
};

type CommandSection = {
  heading: string;
  actions: CommandAction[];
};

export function CommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { update } = useSettings();
  const { open: openQuickAdd } = useQuickAdd();
  const { exportAll } = useBackup();

  const runAndClose = async (fn: () => void | Promise<void>) => {
    onOpenChange(false);
    await Promise.resolve();
    await fn();
  };

  const go = (url: string) => () => router.push(url);

  // PATCH parcial: solo el campo que cambia, no { ...settings }
  const setTheme = (theme: "light" | "dark" | "system") => async () => {
    await update({ tema: theme });
  };

  const sections: CommandSection[] = [
    {
      heading: "Navegar",
      actions: [
        { id: "nav-dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: ["resumen"], run: go("/dashboard") },
        { id: "nav-evolucion", label: "Evolucion", icon: TrendingUp, keywords: ["meses", "tabla"], run: go("/evolucion") },
        { id: "nav-proyeccion", label: "Proyeccion", icon: Telescope, keywords: ["futuro", "simulador"], run: go("/proyeccion") },
        { id: "nav-gastos", label: "Gastos", icon: Receipt, run: go("/gastos") },
        { id: "nav-ingresos", label: "Ingresos", icon: Wallet, run: go("/ingresos") },
        { id: "nav-cuentas", label: "Cuentas", icon: Landmark, keywords: ["banco"], run: go("/cuentas") },
        { id: "nav-inversiones", label: "Inversiones", icon: PieChart, keywords: ["cartera", "acciones", "etf"], run: go("/inversiones") },
        { id: "nav-metas", label: "Metas", icon: Target, keywords: ["objetivo", "ahorro"], run: go("/metas") },
        { id: "nav-hipoteca", label: "Hipoteca", icon: HomeIcon, run: go("/hipoteca") },
        { id: "nav-deudas", label: "Otras deudas", icon: CreditCard, keywords: ["prestamo"], run: go("/deudas") },
        { id: "nav-categorias", label: "Categorias", icon: Tags, run: go("/categorias") },
        { id: "nav-monedas", label: "Monedas", icon: Coins, keywords: ["divisas"], run: go("/monedas") },
        { id: "nav-ajustes", label: "Ajustes", icon: Settings, keywords: ["configuracion"], run: go("/ajustes") },
        { id: "nav-papelera", label: "Papelera", icon: Trash2, keywords: ["borrados", "eliminados"], run: go("/papelera") },
      ],
    },
    {
      heading: "Crear",
      actions: [
        {
          id: "new-expense",
          label: "Nuevo gasto rapido",
          icon: PlusCircle,
          keywords: ["anadir"],
          shortcut: "Ctrl+Shift+G",
          run: () => openQuickAdd(),
        },
        { id: "new-account", label: "Nueva cuenta", icon: PlusCircle, run: go("/cuentas") },
        { id: "new-investment", label: "Nueva inversion", icon: PlusCircle, run: go("/inversiones") },
        { id: "new-goal", label: "Nueva meta", icon: PlusCircle, run: go("/metas") },
        { id: "new-debt", label: "Nueva deuda", icon: PlusCircle, run: go("/deudas") },
        { id: "new-category", label: "Nueva categoria", icon: PlusCircle, run: go("/categorias") },
      ],
    },
    {
      heading: "Tema",
      actions: [
        { id: "theme-light", label: "Tema claro", icon: Sun, keywords: ["light", "blanco"], run: setTheme("light") },
        { id: "theme-dark", label: "Tema oscuro", icon: Moon, keywords: ["dark", "negro"], run: setTheme("dark") },
        { id: "theme-system", label: "Tema del sistema", icon: Monitor, keywords: ["auto", "automatico"], run: setTheme("system") },
      ],
    },
    {
      heading: "Sistema",
      actions: [
        { id: "sys-export", label: "Exportar backup JSON", icon: Download, keywords: ["copia", "seguridad", "guardar"], run: () => exportAll() },
        { id: "sys-trash", label: "Ver papelera", icon: Trash2, keywords: ["borrados"], run: go("/papelera") },
      ],
    },
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Paleta de comandos"
      description="Busca paginas, acciones y configuraciones"
    >
      <CommandInput placeholder="Escribe para buscar..." />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
        {sections.map((section, idx) => (
          <div key={section.heading}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={section.heading}>
              {section.actions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={[action.label, ...(action.keywords ?? [])].join(" ")}
                  onSelect={() => runAndClose(action.run)}
                >
                  <action.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{action.label}</span>
                  {action.shortcut && (
                    <CommandShortcut>{action.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
