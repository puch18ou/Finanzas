"use client";

/**
 * ============================================================================
 *  src/app/ajustes/page.tsx — Pantalla de Ajustes (fix monedaLocal/tema)
 * ============================================================================
 *
 *  BUG DETECTADO (Lote 9b)
 *  -----------------------
 *  El <Select> de shadcn/Radix dispara onValueChange("") cuando se monta
 *  con un value que no coincide con ninguno de sus SelectItem actualmente
 *  disponibles. Esto sucedia con:
 *
 *    - monedaLocal: cuando settings.monedaLocal era "SGD" pero la lista
 *      `currencies` aun estaba vacia (carga asincrona).
 *    - tema: por carrera similar entre hidratacion y mount del portal.
 *
 *  El sintoma: tras guardar, monedaLocal y tema se persistian como vacio,
 *  y al recargar quedaban perdidos.
 *
 *  FIX
 *  ---
 *  1. No renderizar los Selects hasta que `settings` Y `currencies` esten
 *     cargados. Antes mostramos un placeholder.
 *
 *  2. Ademas, el handleSubmit ignora silenciosamente cualquier "" que
 *     llegue de algun otro Select y mantiene el valor previo. Cinturon y
 *     tirantes.
 *
 *  3. El onValueChange ignora "" — solo aplica cambios reales. Asi
 *     evitamos que se ensucie el state si Radix dispara con "".
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { useAccounts } from "@/hooks/useAccounts";
import { useGlobalTheme, type ThemeValue } from "@/contexts/GlobalThemeProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BackupCard } from "@/components/papelera/BackupCard";
import { SecurityCard } from "@/components/auth/SecurityCard";

type Feedback = { kind: "success" | "error"; text: string } | null;

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/**
 * Helper: ignora cambios a string vacio. Util para envolver setStateXxx
 * en los onValueChange de Select. Si Radix dispara con "" por una carrera
 * de mount, el state local NO se contamina.
 */
function safeSet<T extends string>(
  setter: (v: T) => void,
): (v: string) => void {
  return (v: string) => {
    if (v === "") return;
    setter(v as T);
  };
}

export default function AjustesPage() {
  const { settings, update, isLoading: settingsLoading } = useSettings();
  const { data: currencies = [], isLoading: currenciesLoading } =
    useCurrencies();
  const { accounts, isLoading: accountsLoading } = useAccounts();

  const cuentasActivas = accounts.filter((a) => a.activa);

  const [monedaLocal, setMonedaLocal] = useState("EUR");
  const [monedaVista, setMonedaVista] = useState("EUR");
  const [anioActual, setAnioActual] = useState<number>(
    new Date().getFullYear(),
  );
  const [mesActual, setMesActual] = useState<number>(new Date().getMonth() + 1);
  const [objetivoAhorroPct, setObjetivoAhorroPct] = useState<number>(0.2);
  const [tieneHipoteca, setTieneHipoteca] = useState(false);
  const [monedaHipoteca, setMonedaHipoteca] = useState("");
  const [patrimonioInicial, setPatrimonioInicial] = useState<number>(0);
  const [patrimonioInicialMoneda, setPatrimonioInicialMoneda] = useState("");
  const [mostrarFab, setMostrarFab] = useState(true);
  const [integrarCuotaHipoteca, setIntegrarCuotaHipoteca] = useState(false);
  const [cuentaPorDefectoId, setCuentaPorDefectoId] = useState("");

  // El tema es GLOBAL del equipo (no por usuario): vive en localStorage.
  const { theme, setTheme } = useGlobalTheme();

  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!settings) return;
    setMonedaLocal(settings.monedaLocal);
    setMonedaVista(settings.monedaVista);
    setAnioActual(settings.anioActual);
    setMesActual(settings.mesActual);
    setObjetivoAhorroPct(settings.objetivoAhorroPct);
    setTieneHipoteca(settings.tieneHipoteca);
    setMonedaHipoteca(settings.monedaHipoteca ?? "");
    setPatrimonioInicial(settings.patrimonioInicial);
    setPatrimonioInicialMoneda(settings.patrimonioInicialMoneda ?? "");
    setMostrarFab(settings.mostrarFab);
    setIntegrarCuotaHipoteca(settings.integrarCuotaHipoteca);
    setCuentaPorDefectoId(settings.cuentaPorDefectoId ?? "");
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!monedaLocal || !monedaVista) {
      setFeedback({
        kind: "error",
        text: "Selecciona moneda local y moneda vista antes de guardar.",
      });
      return;
    }
    if (tieneHipoteca && !monedaHipoteca) {
      setFeedback({
        kind: "error",
        text: 'Has activado "Tengo hipoteca" pero falta seleccionar su moneda.',
      });
      return;
    }

    try {
      const emptyToNull = (v: string | null | undefined) =>
        v === "" || v == null ? null : v;

      await update({
        monedaLocal,
        monedaVista,
        anioActual,
        mesActual,
        objetivoAhorroPct,
        tieneHipoteca,
        monedaHipoteca: tieneHipoteca ? emptyToNull(monedaHipoteca) : null,
        patrimonioInicial,
        patrimonioInicialMoneda: emptyToNull(patrimonioInicialMoneda),
        mostrarFab,
        integrarCuotaHipoteca,
        cuentaPorDefectoId: emptyToNull(cuentaPorDefectoId),
      });
      setFeedback({ kind: "success", text: "Ajustes guardados" });
    } catch (e) {
      setFeedback({
        kind: "error",
        text: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  };

  // No renderizamos hasta tener settings Y currencies cargadas. Esto
  // previene que los Select de monedas se monten con value="SGD" cuando
  // sus options aun no existen, lo que causaria que Radix dispare
  // onValueChange("") y ensucie el state.
  if (
    settingsLoading ||
    currenciesLoading ||
    accountsLoading ||
    !settings ||
    currencies.length === 0
  ) {
    return <p className="text-sm text-muted-foreground">Cargando ajustes...</p>;
  }

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Configuracion global de la app. Los cambios se aplican al guardar.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Monedas</CardTitle>
            <CardDescription>
              La moneda local es la que usas para los ingresos del trabajo. La
              moneda vista es la que se muestra en los totales.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="moneda-local">Moneda local</Label>
              <Select
                value={monedaLocal}
                onValueChange={safeSet(setMonedaLocal)}
              >
                <SelectTrigger id="moneda-local">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="moneda-vista">Moneda vista</Label>
              <Select
                value={monedaVista}
                onValueChange={safeSet(setMonedaVista)}
              >
                <SelectTrigger id="moneda-vista">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Periodo activo</CardTitle>
            <CardDescription>
              Mes y anio por defecto al abrir pantallas de gastos e ingresos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="anio">Anio</Label>
              <Select
                value={String(anioActual)}
                onValueChange={(v) => v && setAnioActual(Number(v))}
              >
                <SelectTrigger id="anio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mes">Mes</Label>
              <Select
                value={String(mesActual)}
                onValueChange={(v) => v && setMesActual(Number(v))}
              >
                <SelectTrigger id="mes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, idx) => (
                    <SelectItem key={idx} value={String(idx + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Movimientos</CardTitle>
            <CardDescription>
              Cuenta que se precarga al crear un movimiento nuevo (formulario
              y gasto rapido). Puedes cambiarla en cada movimiento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="cuenta-defecto">Cuenta por defecto</Label>
              <Select
                value={cuentaPorDefectoId || "__none__"}
                onValueChange={(v) => {
                  if (v === "") return;
                  setCuentaPorDefectoId(v === "__none__" ? "" : v);
                }}
              >
                <SelectTrigger id="cuenta-defecto" className="max-w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin cuenta por defecto</SelectItem>
                  {cuentasActivas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.alias} ({a.moneda})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cuentasActivas.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay cuentas activas. Crea una en la seccion Cuentas.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Objetivo de ahorro</CardTitle>
            <CardDescription>
              Porcentaje de ingresos que quieres ahorrar cada mes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="ahorro">Objetivo (%)</Label>
              <Input
                id="ahorro"
                type="number"
                step="1"
                min={0}
                max={100}
                value={Number((objetivoAhorroPct * 100).toFixed(0))}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  setObjetivoAhorroPct(isNaN(pct) ? 0 : pct / 100);
                }}
                className="max-w-[200px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hipoteca</CardTitle>
            <CardDescription>
              Si tienes hipoteca, los calculos del Dashboard pueden integrar la
              cuota.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="tiene-hipoteca" className="flex flex-col gap-1">
                <span>Tengo hipoteca</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Habilita la seccion Hipoteca y los campos asociados.
                </span>
              </Label>
              <Switch
                id="tiene-hipoteca"
                checked={tieneHipoteca}
                onCheckedChange={setTieneHipoteca}
              />
            </div>
            {tieneHipoteca && (
              <div className="space-y-2">
                <Label htmlFor="moneda-hipo">Moneda hipoteca</Label>
                <Select
                  value={monedaHipoteca}
                  onValueChange={safeSet(setMonedaHipoteca)}
                >
                  <SelectTrigger id="moneda-hipo" className="max-w-[200px]">
                    <SelectValue placeholder="Selecciona moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Patrimonio inicial</CardTitle>
            <CardDescription>
              Valor base para la pagina de Proyeccion.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pat-inicial">Importe</Label>
              <Input
                id="pat-inicial"
                type="number"
                step="100"
                min={0}
                value={patrimonioInicial}
                onChange={(e) => setPatrimonioInicial(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-moneda">Moneda</Label>
              <Select
                value={patrimonioInicialMoneda || "__none__"}
                onValueChange={(v) => {
                  if (v === "") return;
                  setPatrimonioInicialMoneda(v === "__none__" ? "" : v);
                }}
              >
                <SelectTrigger id="pat-moneda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin especificar</SelectItem>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Apariencia y comportamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="mostrar-fab" className="flex flex-col gap-1">
                <span>Boton flotante de gasto rapido</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Muestra el boton + en la esquina inferior derecha. Aunque lo
                  ocultes, el atajo Ctrl+Shift+G sigue funcionando.
                </span>
              </Label>
              <Switch
                id="mostrar-fab"
                checked={mostrarFab}
                onCheckedChange={setMostrarFab}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label
                htmlFor="integrar-hipoteca"
                className="flex flex-col gap-1"
              >
                <span>Integrar cuota de hipoteca en Dashboard</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Si esta activo, la cuota mensual de la hipoteca activa se suma
                  a los gastos del mes en el Dashboard.
                </span>
              </Label>
              <Switch
                id="integrar-hipoteca"
                checked={integrarCuotaHipoteca}
                onCheckedChange={setIntegrarCuotaHipoteca}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tema">Tema</Label>
              <Select
                value={theme}
                onValueChange={(v) => setTheme(v as ThemeValue)}
              >
                <SelectTrigger id="tema" className="max-w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Oscuro</SelectItem>
                  <SelectItem value="system">Seguir al sistema</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ajuste global del equipo: se aplica al instante a todos los
                usuarios de este PC.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {feedback && (
            <p
              className={`text-sm ${
                feedback.kind === "success"
                  ? "text-primary"
                  : "text-destructive"
              } flex items-center gap-1`}
            >
              {feedback.kind === "success" ? (
                <Check className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {feedback.text}
            </p>
          )}
          <Button type="submit">Guardar ajustes</Button>
        </div>
      </form>

      <SecurityCard />

      <BackupCard />
    </div>
  );
}
