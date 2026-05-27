"use client";

/**
 * src/components/papelera/BackupCard.tsx
 *
 * Card para Ajustes con dos botones:
 *   - Exportar: descarga finanzas-backup-YYYY-MM-DD.json
 *   - Importar: pide archivo, valida, pregunta confirmacion, reemplaza todo
 *
 * El input file esta oculto y se dispara mediante un ref desde el boton.
 */

import { useRef, useState } from "react";
import {
  Download,
  Upload,
  AlertTriangle,
  FileJson,
} from "lucide-react";
import { useBackup } from "@/hooks/useBackup";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function BackupCard() {
  const { exportAll, importAll, isExporting, isImporting } = useBackup();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    // Reset el input para que se pueda seleccionar el mismo archivo otra vez
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    await importAll(pendingFile);
    setPendingFile(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-4 w-4" />
          Copia de seguridad
        </CardTitle>
        <CardDescription>
          Exporta todos tus datos a un archivo JSON o restaura desde uno.
          Util para hacer copias o migrar entre dispositivos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => exportAll()}
            disabled={isExporting}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exportando..." : "Exportar a JSON"}
          </Button>

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="mr-2 h-4 w-4" />
            {isImporting ? "Importando..." : "Importar desde JSON"}
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
          La importacion <strong>reemplaza todos los datos actuales</strong>.
          Haz una exportacion antes por seguridad.
        </p>
      </CardContent>

      <AlertDialog
        open={!!pendingFile}
        onOpenChange={(v) => !v && setPendingFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar importacion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a importar <strong>{pendingFile?.name}</strong>. Esto{" "}
              <strong>borrara todos los datos actuales</strong> y los reemplazara
              por los del archivo. Esta accion NO se puede deshacer.
              <br />
              <br />
              Si no estas seguro, cancela y haz primero una exportacion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isImporting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmImport}
              disabled={isImporting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isImporting ? "Importando..." : "Si, reemplazar datos"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
