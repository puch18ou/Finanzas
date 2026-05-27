"use client";

/**
 * ============================================================================
 *  src/app/ajustes/page.tsx — Pagina de Ajustes
 * ============================================================================
 *
 *  Permite editar todos los campos de la fila singleton de `settings`:
 *
 *    Monedas:
 *      - Moneda local (en la que registras gastos del dia a dia)
 *      - Moneda de visualizacion (en la que se muestran los totales)
 *
 *    Periodo activo:
 *      - Anio actual
 *      - Mes actual
 *
 *    Ahorro:
 *      - % objetivo de ahorro
 *
 *    Hipoteca:
 *      - Sí/No tiene hipoteca
 *      - Moneda de la hipoteca (solo si activa)
 *
 *    Patrimonio inicial:
 *      - Importe + moneda
 *
 *    Apariencia:
 *      - Tema (light/dark/system)
 *
 *  PATRON DE FORMULARIO
 *  --------------------
 *  Usamos useState local con los valores del formulario. Al cargar la
 *  pagina, hidratamos el estado desde `settings`. Al pulsar "Guardar"
 *  llamamos a `update()` (mutation de TanStack Query).
 *
 *  Decidimos NO usar react-hook-form aqui porque el formulario es
 *  relativamente simple. En formularios mas complejos (Gastos, Hipoteca)
 *  si usaremos react-hook-form + zod.
 *
 *  La validacion basica (mes 1-12, anio razonable) se hace en el click
 *  del boton. Si todo OK, se envia.
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { useSettings, useCurrencies } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

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

export default function AjustesPage() {
  const { settings, isLoading, update, isUpdating } = useSettings();
  const { data: currencies } = useCurrencies();

  // Estado local del formulario, hidratado desde settings.
  const [monedaLocal, setMonedaLocal] = useState("");
  const [monedaVista, setMonedaVista] = useState("");
  const [anioActual, setAnioActual] = useState<number>(0);
  const [mesActual, setMesActual] = useState<number>(1);
  const [objetivoAhorroPct, setObjetivoAhorroPct] = useState<number>(0);
  const [tieneHipoteca, setTieneHipoteca] = useState(false);
  const [monedaHipoteca, setMonedaHipoteca] = useState("");
  const [patrimonioInicial, setPatrimonioInicial] = useState<number>(0);
  const [patrimonioInicialMoneda, setPatrimonioInicialMoneda] = useState("");
  const [mostrarFab, setMostrarFab] = useState(true);
  const [tema, setTema] = useState<"light" | "dark" | "system">("system");

  // Mensaje de feedback al guardar
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  // Cuando llegan los settings de la BD, sincronizamos el formulario.
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
    setTema(settings.tema);
  }, [settings]);

  if (isLoading || !settings) {
    return <p className="text-sm text-muted-foreground">Cargando ajustes...</p>;
  }

  async function handleSubmit() {
    setFeedback(null);

    // Validaciones basicas
    if (mesActual < 1 || mesActual > 12) {
      setFeedback({ kind: "error", text: "El mes debe estar entre 1 y 12" });
      return;
    }
    if (anioActual < 2000 || anioActual > 2100) {
      setFeedback({
        kind: "error",
        text: "El anio debe ser razonable (2000-2100)",
      });
      return;
    }
    if (objetivoAhorroPct < 0 || objetivoAhorroPct > 1) {
      setFeedback({
        kind: "error",
        text: "El objetivo de ahorro debe estar entre 0 y 100%",
      });
      return;
    }

    try {
      // Normaliza strings vacios a null, para que las foreign keys no
      // intenten apuntar a un codigo de moneda "" que no existe.
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
        tema,
      });
      setFeedback({ kind: "success", text: "Ajustes guardados" });
    } catch (e) {
      setFeedback({
        kind: "error",
        text: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Configuracion global de la aplicacion. Los cambios se guardan al
          pulsar el boton de abajo.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Monedas</CardTitle>
          <CardDescription>
            La moneda local es en la que registras los movimientos del dia a
            dia. La de visualizacion es en la que se muestran los totales del
            dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="moneda-local">Moneda local</Label>
            <Select value={monedaLocal} onValueChange={setMonedaLocal}>
              <SelectTrigger id="moneda-local">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies?.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} — {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="moneda-vista">Moneda de visualizacion</Label>
            <Select value={monedaVista} onValueChange={setMonedaVista}>
              <SelectTrigger id="moneda-vista">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies?.map((c) => (
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
            El dashboard y la pagina de evolucion filtran por este periodo. Lo
            puedes cambiar para revisar otros meses.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="anio">Anio</Label>
            <Input
              id="anio"
              type="number"
              min={2000}
              max={2100}
              value={anioActual}
              onChange={(e) => setAnioActual(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mes">Mes</Label>
            <Select
              value={String(mesActual)}
              onValueChange={(v) => setMesActual(Number(v))}
            >
              <SelectTrigger id="mes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((nombre, idx) => (
                  <SelectItem key={idx} value={String(idx + 1)}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objetivo de ahorro</CardTitle>
          <CardDescription>
            Porcentaje de tus ingresos que aspiras a ahorrar cada mes. La pagina
            de evolucion marca un mes con un check verde si lo cumples.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="ahorro">Porcentaje (%)</Label>
            <Input
              id="ahorro"
              type="number"
              min={0}
              max={100}
              step={1}
              value={Math.round(objetivoAhorroPct * 100)}
              onChange={(e) =>
                setObjetivoAhorroPct(Number(e.target.value) / 100)
              }
              className="max-w-[120px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hipoteca</CardTitle>
          <CardDescription>
            Si tienes hipoteca activa, su cuota mensual se suma a los gastos del
            dashboard automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="tiene-hipoteca" className="flex flex-col gap-1">
              <span>¿Tienes hipoteca?</span>
              <span className="text-xs font-normal text-muted-foreground">
                Si la desactivas, la hoja Hipoteca queda solo como simulador
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
              <Label htmlFor="moneda-hipoteca">Moneda de la hipoteca</Label>
              <Select value={monedaHipoteca} onValueChange={setMonedaHipoteca}>
                <SelectTrigger id="moneda-hipoteca">
                  <SelectValue placeholder="Selecciona una moneda" />
                </SelectTrigger>
                <SelectContent>
                  {currencies?.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.nombre}
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
            Valor de partida de tu patrimonio al inicio del seguimiento. Se usa
            para calcular el ahorro acumulado y la proyeccion.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-[1fr_120px] gap-4">
          <div className="space-y-2">
            <Label htmlFor="patrimonio">Importe</Label>
            <Input
              id="patrimonio"
              type="number"
              min={0}
              step="0.01"
              value={patrimonioInicial}
              onChange={(e) => setPatrimonioInicial(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="patrimonio-moneda">Moneda</Label>
            <Select
              value={patrimonioInicialMoneda}
              onValueChange={setPatrimonioInicialMoneda}
            >
              <SelectTrigger id="patrimonio-moneda">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies?.map((c) => (
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
          <CardTitle>Apariencia</CardTitle>
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

          <div className="space-y-2">
            <Label htmlFor="tema">Tema</Label>
            <Select
              value={tema}
              onValueChange={(v) => setTema(v as "light" | "dark" | "system")}
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
              El cambio de tema se aplica al recargar (la integracion en tiempo
              real llega en lotes futuros).
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="text-sm">
          {feedback && (
            <span
              className={
                feedback.kind === "success"
                  ? "text-primary"
                  : "text-destructive"
              }
            >
              {feedback.text}
            </span>
          )}
        </div>
        <Button onClick={handleSubmit} disabled={isUpdating}>
          {isUpdating ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
