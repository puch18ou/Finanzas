"use client";

/**
 * ============================================================================
 *  src/components/layout/AppSidebar.tsx — Barra lateral de navegacion
 * ============================================================================
 *
 *  Sidebar con todas las secciones de la app. Usa el componente Sidebar
 *  de shadcn (mas su SidebarProvider, SidebarHeader, SidebarMenu, etc.).
 *
 *  La estructura se basa en GRUPOS de items relacionados:
 *
 *    Resumen    → Dashboard, Evolucion, Proyeccion
 *    Movimientos → Gastos, Ingresos
 *    Patrimonio → Cuentas, Inversiones, Metas
 *    Deuda      → Hipoteca, Otras deudas
 *    Catalogos  → Categorias, Monedas
 *    Sistema    → Ajustes
 *
 *  El item activo se detecta con usePathname() de Next y se resalta.
 *
 *  ICONOS: lucide-react. Cada item lleva su icono (16-18px).
 * ============================================================================
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Resumen",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Evolucion", url: "/evolucion", icon: TrendingUp },
      { title: "Proyeccion", url: "/proyeccion", icon: Telescope },
    ],
  },
  {
    label: "Movimientos",
    items: [
      { title: "Gastos", url: "/gastos", icon: Receipt },
      { title: "Ingresos", url: "/ingresos", icon: Wallet },
    ],
  },
  {
    label: "Patrimonio",
    items: [
      { title: "Cuentas", url: "/cuentas", icon: Landmark },
      { title: "Inversiones", url: "/inversiones", icon: PieChart },
      { title: "Metas", url: "/metas", icon: Target },
    ],
  },
  {
    label: "Deuda",
    items: [
      { title: "Hipoteca", url: "/hipoteca", icon: HomeIcon },
      { title: "Otras deudas", url: "/deudas", icon: CreditCard },
    ],
  },
  {
    label: "Catalogos",
    items: [
      { title: "Categorias", url: "/categorias", icon: Tags },
      { title: "Monedas", url: "/monedas", icon: Coins },
    ],
  },
  {
    label: "Sistema",
    items: [{ title: "Ajustes", url: "/ajustes", icon: Settings }],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Coins className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Finanzas</span>
            <span className="text-xs text-muted-foreground">
              v0.1 · local
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  // Una ruta esta activa si el pathname actual empieza por su url.
                  // Para "/dashboard" hace match exacto; para subrutas tambien
                  // (e.g. /gastos/nuevo seguiria activando "Gastos").
                  const isActive =
                    pathname === item.url ||
                    pathname.startsWith(`${item.url}/`);

                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
