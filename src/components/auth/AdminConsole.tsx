"use client";

/**
 * ============================================================================
 *  src/components/auth/AdminConsole.tsx — Consola de administracion
 * ============================================================================
 *
 *  El usuario admin no tiene finanzas: solo gestiona usuarios. Se renderiza en
 *  lugar de la app normal (sin AppShell ni BD de finanzas).
 *
 *  Acciones: crear usuario, resetear PIN (con cambio obligatorio en el proximo
 *  login) y borrar usuario (le quita el acceso; su .db queda huerfano en disco).
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { LogOut, Shield, User as UserIcon, UserPlus, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthProvider";
import {
  createUser,
  updatePin,
  deleteUser,
  type User,
  type UserRole,
} from "@/lib/auth/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmation } from "@/components/crud/DeleteConfirmation";
import { SettingsMenu } from "@/components/auth/SettingsMenu";

const MAX_PIN = 8;
const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, MAX_PIN);

export function AdminConsole() {
  const { user, users, refreshUsers, logout } = useAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      await refreshUsers();
      toast.success(`Usuario "${deleteTarget.username}" eliminado`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex items-center justify-between border-b bg-background px-6 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Administracion</span>
            <span className="text-xs text-muted-foreground">{user?.username}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <SettingsMenu />
          <Button variant="outline" size="sm" className="gap-2" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesion
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Usuarios</CardTitle>
              <CardDescription>
                Gestion de usuarios de la plataforma.
              </CardDescription>
            </div>
            <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Nuevo usuario
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {u.role === "admin" ? (
                            <Shield className="h-4 w-4 text-primary" />
                          ) : (
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                          {u.username}
                          {isSelf && (
                            <span className="text-xs text-muted-foreground">(tu)</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.role === "admin" ? "Administrador" : "Usuario"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => setResetTarget(u)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            PIN
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive hover:text-destructive"
                            disabled={isSelf}
                            onClick={() => setDeleteTarget(u)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Borrar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refreshUsers}
      />

      <ResetPinDialog
        target={resetTarget}
        onOpenChange={(v) => !v && setResetTarget(null)}
        onDone={refreshUsers}
      />

      <DeleteConfirmation
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Borrar usuario"
        description={
          deleteTarget
            ? `"${deleteTarget.username}" perdera el acceso. Sus datos (fichero .db) NO se borran del disco, quedan huerfanos.`
            : ""
        }
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [forceChange, setForceChange] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setUsername("");
    setPin("");
    setRole("user");
    setForceChange(true);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createUser({ username, pin, role, mustChangePin: forceChange });
      await onCreated();
      toast.success(`Usuario "${username.trim()}" creado`);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            Crea un usuario con su PIN inicial (4-8 digitos).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-username">Usuario</Label>
            <Input
              id="new-username"
              autoFocus
              placeholder="nombre de usuario"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-pin">PIN inicial</Label>
            <Input
              id="new-user-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="PIN (4-8 digitos)"
              value={pin}
              maxLength={MAX_PIN}
              onChange={(e) => {
                setPin(onlyDigits(e.target.value));
                setError(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-role">Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger id="new-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="force-change" className="font-normal">
              Pedir cambio de PIN al entrar
            </Label>
            <Switch
              id="force-change"
              checked={forceChange}
              onCheckedChange={setForceChange}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPinDialog({
  target,
  onOpenChange,
  onDone,
}: {
  target: User | null;
  onOpenChange: (v: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await updatePin(target.id, pin, { forceChange: true });
      await onDone();
      toast.success(`PIN de "${target.username}" reseteado`);
      setPin("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo resetear el PIN.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={!!target}
      onOpenChange={(v) => {
        if (!v) {
          setPin("");
          setError(null);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetear PIN</DialogTitle>
          <DialogDescription>
            Nuevo PIN para &quot;{target?.username}&quot;. Se le pedira cambiarlo
            en su proximo inicio de sesion.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reset-pin">Nuevo PIN</Label>
            <Input
              id="reset-pin"
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="PIN (4-8 digitos)"
              value={pin}
              maxLength={MAX_PIN}
              onChange={(e) => {
                setPin(onlyDigits(e.target.value));
                setError(null);
              }}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Resetear PIN"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
