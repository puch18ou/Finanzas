"use client";

/**
 * src/components/mobile/MobileApp.tsx — Interfaz de MOVIL (Fase 2).
 *
 * Sustituye al AppShell de escritorio cuando la app corre en movil. En vez de
 * un sidebar, una barra de PESTAÑAS abajo (estilo app nativa) con un set
 * reducido de pantallas, pensadas para pantalla pequeña y dedo. Un boton ➕
 * flotante abre el "añadir rapido" (gasto/ingreso).
 *
 * Reutiliza los mismos hooks de datos que el escritorio; solo cambia la
 * presentacion.
 */

import { useState } from "react";
import {
  Home,
  ArrowLeftRight,
  Landmark,
  Wallet,
  Settings,
  Plus,
} from "lucide-react";
import { useQuickAdd } from "@/contexts/QuickAddProvider";
import { MobileHome } from "./screens/MobileHome";
import { MobileMovements } from "./screens/MobileMovements";
import { MobileAccounts } from "./screens/MobileAccounts";
import { MobileBudgets } from "./screens/MobileBudgets";
import { MobileSettings } from "./screens/MobileSettings";

type TabId = "inicio" | "movimientos" | "cuentas" | "presupuestos" | "ajustes";

const TABS: {
  id: TabId;
  label: string;
  icon: typeof Home;
}[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "movimientos", label: "Movim.", icon: ArrowLeftRight },
  { id: "cuentas", label: "Cuentas", icon: Landmark },
  { id: "presupuestos", label: "Presup.", icon: Wallet },
  { id: "ajustes", label: "Ajustes", icon: Settings },
];

export function MobileApp() {
  const [tab, setTab] = useState<TabId>("inicio");
  const quickAdd = useQuickAdd();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/20">
      {/* Contenido de la pantalla activa */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {tab === "inicio" && <MobileHome />}
        {tab === "movimientos" && <MobileMovements />}
        {tab === "cuentas" && <MobileAccounts />}
        {tab === "presupuestos" && <MobileBudgets />}
        {tab === "ajustes" && <MobileSettings />}
      </main>

      {/* Boton flotante: añadir rapido (no en Ajustes) */}
      {tab !== "ajustes" && (
        <button
          type="button"
          onClick={quickAdd.open}
          aria-label="Añadir movimiento"
          className="absolute right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" }}
        >
          <Plus className="h-7 w-7" />
        </button>
      )}

      {/* Barra de pestañas */}
      <nav
        className="z-10 flex shrink-0 items-stretch border-t bg-background"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <t.icon className={`h-5 w-5 ${active ? "" : "opacity-70"}`} />
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
