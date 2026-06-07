"use client";

/**
 * src/components/sync/QrScanner.tsx — Escaner de QR con la camara.
 *
 * Abre la camara trasera, busca un QR en cada fotograma (jsqr) y llama a
 * onScan con el texto al detectarlo. Se muestra como overlay a pantalla
 * completa con un boton de cerrar. Si la camara falla (permiso/soporte),
 * muestra el error.
 *
 * Nota movil: requiere permiso de camara (AndroidManifest) y que la webview
 * conceda el acceso. Si no, getUserMedia lanza y mostramos el motivo.
 */

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QrScanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      if (stopped) return;
      const v = videoRef.current;
      if (v && ctx && v.readyState === v.HAVE_ENOUGH_DATA) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height);
        if (code && code.data) {
          onScan(code.data);
          return; // se detiene; el padre cierra
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Este dispositivo no expone la camara a la app.");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo abrir la camara.");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm">Escanea el QR del PC</span>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        {/* marco guia */}
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-lg border-2 border-white/80" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="rounded-lg bg-background p-4 text-center text-sm">
              <p className="font-medium text-destructive">No se pudo abrir la camara</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
              <Button className="mt-3" onClick={onClose}>
                Cerrar y escribir a mano
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
