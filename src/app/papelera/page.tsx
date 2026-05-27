"use client";

/**
 * src/app/papelera/page.tsx — Papelera
 *
 * Lote 10a-2: el tab "Gastos" e "Ingresos" se sustituyen por
 * "Movimientos".
 */

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { useTrashCounts, useTrashActions } from "@/hooks/useTrash";
import { TrashTab } from "@/components/papelera/TrashTab";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import type { TrashItemType } from "@/lib/repositories";

type TabDef = {
  type: TrashItemType;
  label: string;
};

const TABS: TabDef[] = [
  { type: "movements", label: "Movimientos" },
  { type: "categories", label: "Categorias" },
  { type: "accounts", label: "Cuentas" },
  { type: "investments", label: "Inversiones" },
  { type: "goals", label: "Metas" },
  { type: "mortgage", label: "Hipoteca" },
  { type: "otherDebts", label: "Deudas" },
];

export default function PapeleraPage() {
  const { data: counts } = useTrashCounts();
  const { emptyAll, isMutating } = useTrashActions();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const totalItems = counts
    ? Object.values(counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Papelera</h1>
          <p className="text-sm text-muted-foreground">
            Elementos eliminados. Puedes restaurarlos o borrarlos
            definitivamente.
          </p>
        </div>
        {totalItems > 0 && (
          <Button
            variant="outline"
            onClick={() => setConfirmEmpty(true)}
            disabled={isMutating}
            className="text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Vaciar papelera ({totalItems})
          </Button>
        )}
      </header>

      {totalItems === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Trash2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              La papelera esta vacia.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Elementos en papelera</CardTitle>
            <CardDescription>
              Restaurar devuelve el elemento a su pantalla original. Borrar es
              definitivo y no se puede deshacer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={firstNonEmptyTab(counts) ?? "movements"}>
              <TabsList className="mb-4 flex w-full flex-wrap h-auto">
                {TABS.map((t) => {
                  const c = counts?.[t.type] ?? 0;
                  return (
                    <TabsTrigger
                      key={t.type}
                      value={t.type}
                      disabled={c === 0}
                      className="data-[state=active]:bg-primary/10"
                    >
                      {t.label}
                      {c > 0 && (
                        <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                          {c}
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {TABS.map((t) => (
                <TabsContent key={t.type} value={t.type}>
                  <TrashTab type={t.type} />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Vaciar papelera
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminaran definitivamente los {totalItems} elementos en la
              papelera. Esta accion NO se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await emptyAll();
                setConfirmEmpty(false);
              }}
              disabled={isMutating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isMutating ? "Vaciando..." : "Si, vaciar todo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function firstNonEmptyTab(
  counts: Record<TrashItemType, number> | undefined,
): TrashItemType | null {
  if (!counts) return null;
  for (const t of TABS) {
    if ((counts[t.type] ?? 0) > 0) return t.type;
  }
  return null;
}
