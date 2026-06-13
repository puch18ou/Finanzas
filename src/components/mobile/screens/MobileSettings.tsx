"use client";

import { useEffect, useState } from "react";
import { LogOut, Sun, Moon, Monitor } from "lucide-react";
import { MobileScreen } from "../MobileScreen";
import { SyncCard } from "@/components/sync/SyncCard";
import { useAuth } from "@/contexts/AuthProvider";
import { useGlobalTheme, type ThemeValue } from "@/contexts/GlobalThemeProvider";
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
