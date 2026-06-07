"use client";

/**
 * src/components/sync/SyncCard.tsx — Sincronizacion por fichero (Fase 2, G-2)
 *
 * Card para Ajustes con dos acciones:
 *   - Exportar: descarga un paquete con todos tus datos de ESTE dispositivo.
 *   - Importar: lee el paquete del OTRO dispositivo y FUSIONA (last-write-wins;
 *     no reemplaza: para cada dato gana la version mas reciente).
 *
 * MVP sin red: el fichero lo mueves tu (nube, cable...). El transporte
 * automatico por LAN llega despues.
 */

import { useEffect, useRef, useState } from "react";
import { Download, Upload, RefreshCw, Smartphone } from "lucide-react";
import { useSync } from "@/hooks/useSync";
import { getDeviceId, getDeviceName, setDeviceName } from "@/lib/sync/device";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SyncCard() {
  const { exportBundle, importBundle, isExporting, isImporting } = useSync();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");

  // localStorage solo existe en cliente: leemos tras montar.
  useEffect(() => {
    setDeviceId(getDeviceId());
    setName(getDeviceName() ?? "");
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (file) await importBundle(file);
  };

  const handleNameBlur = () => {
    setDeviceName(name.trim());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Sincronizacion entre dispositivos
        </CardTitle>
        <CardDescription>
          Comparte tus datos entre el PC y el movil. Exporta un paquete en un
          dispositivo e importalo en el otro: se <strong>fusionan</strong> (para
          cada dato gana la version mas reciente; no se borra nada por error).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Nombre de este dispositivo (opcional)
          </label>
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              placeholder="p. ej. Portatil de Pedro"
              className="max-w-xs"
            />
          </div>
          {deviceId && (
            <p className="text-xs text-muted-foreground">
              ID: <code>{deviceId.slice(0, 8)}</code>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => exportBundle()}
            disabled={isExporting}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exportando..." : "Exportar paquete"}
          </Button>

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="mr-2 h-4 w-4" />
            {isImporting ? "Fusionando..." : "Importar y fusionar"}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Para sincronizar en ambos sentidos, exporta en cada dispositivo e
          importa el paquete del otro. El fichero lo pasas tu (nube, cable…); la
          sincronizacion automatica por WiFi llegara mas adelante.
        </p>
      </CardContent>
    </Card>
  );
}
