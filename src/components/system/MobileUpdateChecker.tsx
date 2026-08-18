"use client";

/**
 * src/components/system/MobileUpdateChecker.tsx — Auto-update ASISTIDO de movil.
 *
 * Al arrancar (solo movil) comprueba si hay una version mas nueva en GitHub. Si
 * la hay, muestra una PANTALLA a pantalla completa con el progreso: descarga el
 * APK dentro de la app (por trozos, con barra de progreso) y lanza el instalador
 * de Android. Si algo falla, muestra el error y ofrece abrir la descarga en el
 * navegador (metodo antiguo, fiable).
 *
 * Android no permite instalar en silencio: el ultimo paso ("Instalar") lo
 * confirma siempre el usuario en la pantalla del sistema.
 */

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { isMobileApp } from "@/lib/utils/platform";
import {
  checkForUpdate,
  downloadApk,
  installApk,
  openInBrowser,
  type UpdateInfo,
} from "@/lib/services/apk-update-service";
import { Button } from "@/components/ui/button";

type Phase =
  | "off" // sin actualizacion / oculto
  | "prompt" // hay version nueva, preguntamos
  | "downloading"
  | "installing"
  | "done"
  | "error";

export function MobileUpdateChecker() {
  const lanzado = useRef(false);
  const [phase, setPhase] = useState<Phase>("off");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (lanzado.current || !isMobileApp()) return;
    lanzado.current = true;
    void (async () => {
      try {
        const upd = await checkForUpdate();
        if (upd) {
          setInfo(upd);
          setPhase("prompt");
        }
      } catch {
        // sin red / no es movil real: no molestamos.
      }
    })();
  }, []);

  const startUpdate = async () => {
    if (!info) return;
    setProgress(0);
    setPhase("downloading");
    try {
      const path = await downloadApk(info.url, (f) => setProgress(f));
      setPhase("installing");
      await installApk(path);
      setPhase("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  if (phase === "off") return null;

  const pct = Math.round(progress * 100);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        {phase === "error" ? (
          <AlertTriangle className="h-12 w-12 text-amber-500" />
        ) : phase === "done" ? (
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        ) : phase === "downloading" ? (
          <Download className="h-12 w-12 text-primary" />
        ) : (
          <RefreshCw
            className={`h-12 w-12 text-primary ${phase === "installing" ? "animate-spin" : ""}`}
          />
        )}
        <h1 className="text-xl font-semibold">
          {phase === "prompt" && "Actualización disponible"}
          {phase === "downloading" && "Descargando actualización…"}
          {phase === "installing" && "Abriendo el instalador…"}
          {phase === "done" && "Listo para instalar"}
          {phase === "error" && "No se pudo actualizar sola"}
        </h1>
        {info && (
          <p className="text-sm text-muted-foreground">Versión {info.version}</p>
        )}
      </div>

      {phase === "downloading" && (
        <div className="w-full max-w-xs">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-sm tabular-nums text-muted-foreground">{pct}%</p>
        </div>
      )}

      {phase === "installing" && (
        <p className="max-w-xs text-sm text-muted-foreground">
          Cuando Android lo pida, pulsa <strong>Instalar</strong>.
        </p>
      )}

      {phase === "done" && (
        <p className="max-w-xs text-sm text-muted-foreground">
          Sigue en pantalla las instrucciones de Android para instalar la
          actualización.
        </p>
      )}

      {phase === "error" && (
        <p className="max-w-xs break-words text-xs text-muted-foreground">
          {errorMsg}
        </p>
      )}

      <div className="flex flex-col items-stretch gap-2 pt-2">
        {phase === "prompt" && (
          <>
            <Button onClick={() => void startUpdate()} className="gap-2">
              <Download className="h-4 w-4" />
              Actualizar ahora
            </Button>
            <Button variant="ghost" onClick={() => setPhase("off")}>
              Ahora no
            </Button>
          </>
        )}

        {phase === "error" && info && (
          <>
            <Button
              onClick={() => void openInBrowser(info.url)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Descargar en el navegador
            </Button>
            <Button variant="ghost" onClick={() => setPhase("off")}>
              Cerrar
            </Button>
          </>
        )}

        {(phase === "done" || phase === "installing") && (
          <Button variant="ghost" onClick={() => setPhase("off")}>
            Cerrar
          </Button>
        )}
      </div>
    </div>
  );
}
