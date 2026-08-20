"use client";

import { useEffect, useState } from "react";
import { LogOut, Sun, Moon, Monitor, Eye, EyeOff } from "lucide-react";
import { MobileScreen } from "../MobileScreen";
import { SyncCard } from "@/components/sync/SyncCard";
import { BackupCard } from "@/components/papelera/BackupCard";
import { useAuth } from "@/contexts/AuthProvider";
import { useGlobalTheme, type ThemeValue } from "@/contexts/GlobalThemeProvider";
import { usePrivacy } from "@/contexts/PrivacyProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const THEMES: { value: ThemeValue; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

export function MobileSettings() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useGlobalTheme();
  const { hidden, toggle } = usePrivacy();

  const [version, setVersion] = useState("");
  useEffect(() => {
    import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then(setVersion)
      .catch(() => {});
  }, []);

  return (
    <MobileScreen title="Ajustes">
      <SyncCard />

      <BackupCard />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tema</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          {THEMES.map((t) => (
            <Button
              key={t.value}
              variant={theme === t.value ? "default" : "outline"}
              className="flex-1 flex-col gap-1 py-6"
              onClick={() => setTheme(t.value)}
            >
              <t.icon className="h-5 w-5" />
              <span className="text-xs">{t.label}</span>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Privacidad</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant={hidden ? "default" : "outline"}
            className="w-full gap-2"
            onClick={toggle}
          >
            {hidden ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {hidden ? "Importes ocultos" : "Ocultar importes"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Oculta todos los importes (patrimonio, cuentas, inversiones,
            gastos…). Solo en este dispositivo.
          </p>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full gap-2" onClick={logout}>
        <LogOut className="h-4 w-4" />
        Cerrar sesion{user ? ` (${user.username})` : ""}
      </Button>

      {version && (
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Finanzas v{version}
        </p>
      )}
    </MobileScreen>
  );
}
