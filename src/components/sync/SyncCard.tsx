"use client";

/**
 * src/components/sync/SyncCard.tsx — Sincronizacion entre dispositivos (Fase 2)
 *
 * Tres modos:
 *   - Automatica por WiFi (Lote I): este dispositivo puede hacer de SERVIDOR
 *     (el PC: enciende el mini-servidor) y/o de CLIENTE (el movil: se conecta a
 *     la direccion del PC y sincroniza con un boton).
 *   - Manual por fichero (Lote G-2): exportar/importar un paquete .json.
 */

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Upload,
  RefreshCw,
  Smartphone,
  Server,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useSync } from "@/hooks/useSync";
import { useLanSync } from "@/hooks/useLanSync";
import { useAuth } from "@/contexts/AuthProvider";
import { QrScanner } from "@/components/sync/QrScanner";
import { getDeviceId, getDeviceName, setDeviceName } from "@/lib/sync/device";
import {
  startSyncServer,
  stopSyncServer,
  getSyncServerStatus,
  encodePairing,
  decodePairing,
  type SyncServerStatus,
} from "@/lib/sync/lan";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const PC_ADDRESS_KEY = "sync:serverAddress";
const AUTO_KEY = "sync:auto";

export function SyncCard() {
  const { exportBundle, importBundle, isExporting, isImporting } = useSync();
  const lanSync = useLanSync();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");

  const [server, setServer] = useState<SyncServerStatus>(null);
  const [serverBusy, setServerBusy] = useState(false);

  const [pcAddress, setPcAddress] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [scanning, setScanning] = useState(false);

  const handleScan = (text: string) => {
    setScanning(false);
    const info = decodePairing(text);
    if (info) {
      setPcAddress(info.address);
      localStorage.setItem(PC_ADDRESS_KEY, info.address);
      toast.success(`PC detectado: ${info.address}`);
    } else {
      toast.error("Ese QR no es de Finanzas.");
    }
  };

  useEffect(() => {
    setDeviceId(getDeviceId());
    setName(getDeviceName() ?? "");
    setPcAddress(localStorage.getItem(PC_ADDRESS_KEY) ?? "");
    setAutoSync(localStorage.getItem(AUTO_KEY) !== "0");
    getSyncServerStatus().then(setServer).catch(() => setServer(null));
  }, []);

  const toggleAuto = (on: boolean) => {
    setAutoSync(on);
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (file) await importBundle(file);
  };

  const toggleServer = async () => {
    setServerBusy(true);
    try {
      if (server) {
        await stopSyncServer();
        setServer(null);
        toast.success("Servidor de sincronizacion apagado");
      } else {
        const addr = await startSyncServer();
        const idx = addr.lastIndexOf(":");
        setServer([addr.slice(0, idx), Number(addr.slice(idx + 1))]);
        toast.success(`Servidor encendido en ${addr}`);
      }
    } catch (e) {
      toast.error(
        `No se pudo cambiar el servidor: ${e instanceof Error ? e.message : "error"}`,
      );
    } finally {
      setServerBusy(false);
    }
  };

  const handleSyncNow = async () => {
    const addr = pcAddress.trim();
    if (!addr) {
      toast.error("Escribe la direccion del PC (ej. 192.168.1.40:8787).");
      return;
    }
    localStorage.setItem(PC_ADDRESS_KEY, addr);
    setSyncing(true);
    try {
      const stats = await lanSync(addr);
      const cambios = stats.appliedRows + stats.deletedRows;
      toast.success(
        cambios === 0
          ? "Sincronizado: ya estaba todo al dia"
          : `Sincronizado: ${stats.appliedRows} actualizados, ${stats.deletedRows} borrados`,
      );
    } catch (e) {
      toast.error(
        `No se pudo sincronizar: ${e instanceof Error ? e.message : "error"}`,
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Sincronizacion entre dispositivos
        </CardTitle>
        <CardDescription>
          Comparte tus datos entre el PC y el movil. Los datos se{" "}
          <strong>fusionan</strong> (para cada dato gana la version mas reciente;
          nada se borra por error).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {scanning && (
          <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />
        )}

        {/* Nombre del dispositivo */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Nombre de este dispositivo (opcional)
          </label>
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setDeviceName(name.trim())}
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

        {/* Servidor: este dispositivo (el PC) hace de host */}
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Server className="h-4 w-4" />
            Servidor (este dispositivo hace de host)
          </div>
          <p className="text-xs text-muted-foreground">
            Enciendelo en el <strong>PC</strong>. Mientras este encendido y en la
            misma WiFi, el movil podra sincronizar con el.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={server ? "default" : "outline"}
              onClick={toggleServer}
              disabled={serverBusy}
            >
              <Wifi className="mr-2 h-4 w-4" />
              {server ? "Apagar servidor" : "Encender servidor"}
            </Button>
            {server && (
              <span className="text-sm text-muted-foreground">
                Escuchando en{" "}
                <code className="font-medium text-foreground">
                  {server[0]}:{server[1]}
                </code>
              </span>
            )}
          </div>
          {server && user && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG
                  value={encodePairing(`${server[0]}:${server[1]}`, user.username)}
                  size={160}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Escanea este QR desde el movil para conectarte sin teclear.
              </p>
            </div>
          )}
        </div>

        {/* Cliente: conectar a un servidor (el movil) */}
        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wifi className="h-4 w-4" />
            Conectar con el PC
          </div>
          <p className="text-xs text-muted-foreground">
            En el <strong>movil</strong>: escanea el QR del PC (o escribe la
            direccion) y pulsa sincronizar.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScanning(true)}
            className="gap-2"
          >
            <QrCode className="h-4 w-4" />
            Escanear QR del PC
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={pcAddress}
              onChange={(e) => setPcAddress(e.target.value)}
              placeholder="192.168.1.40:8787"
              className="max-w-50 font-mono"
            />
            <Button onClick={handleSyncNow} disabled={syncing}>
              <RefreshCw
                className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Sincronizando..." : "Sincronizar ahora"}
            </Button>
          </div>
          <label className="flex items-center gap-2 pt-1 text-sm">
            <Switch checked={autoSync} onCheckedChange={toggleAuto} />
            <span>
              Sincronizar automaticamente
              <span className="block text-xs text-muted-foreground">
                al abrir la app y cada 30 s (necesita el PC encendido)
              </span>
            </span>
          </label>
        </div>

        {/* Manual por fichero */}
        <div className="space-y-2 rounded-lg border p-3">
          <div className="text-sm font-medium">Manual (por fichero)</div>
          <p className="text-xs text-muted-foreground">
            Si no hay WiFi compartida: exporta un paquete e importalo en el otro
            dispositivo (lo pasas tu por nube, cable…).
          </p>
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
        </div>
      </CardContent>
    </Card>
  );
}
