"use client";

/**
 * src/components/layout/AppSidebar.tsx
 *
 * Lote 11b: añade "Recurrentes" al grupo Movimientos.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarClock,
  LayoutDashboard,
  TrendingUp,
  Telescope,
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
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrivacyToggle } from "@/components/system/PrivacyToggle";
import { useTour } from "@/contexts/TourProvider";
import { MENU_TOUR } from "@/lib/help/tours";

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
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarFooterHints } from "@/components/layout/SidebarFooterHints";
import { useAuth } from "@/contexts/AuthProvider";

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
      { title: "Presupuestos", url: "/presupuestos", icon: Wallet },
    ],
  },
  {
    label: "Movimientos",
    items: [
      { title: "Movimientos", url: "/movimientos", icon: ArrowLeftRight },
      { title: "Recurrentes", url: "/recurrentes", icon: CalendarClock },
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
    items: [
      { title: "Ajustes", url: "/ajustes", icon: Settings },
      { title: "Papelera", url: "/papelera", icon: Trash2 },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const { startTour } = useTour();

  // En movil, al navegar cerramos el panel para ver la pagina completa.
  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar>
      <SidebarHeader
        className="border-b border-sidebar-border"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Coins className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Finanzas</span>
            <span className="text-xs text-muted-foreground">
              {user ? user.username : "local"}
            </span>
          </div>
          <div className="ml-auto flex items-center">
            <PrivacyToggle className="h-7 w-7" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Guia del menu"
              title="Guia: que hay en cada seccion"
              onClick={() => startTour(MENU_TOUR)}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
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
                  const isActive =
                    pathname === item.url ||
                    pathname.startsWith(`${item.url}/`);

                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          href={item.url}
                          onClick={handleNav}
                          data-tour={`menu-${item.url.slice(1)}`}
                        >
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

      <SidebarFooterHints />
    </Sidebar>
  );
}
