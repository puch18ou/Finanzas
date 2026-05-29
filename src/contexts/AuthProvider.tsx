"use client";

/**
 * ============================================================================
 *  src/contexts/AuthProvider.tsx — Sesion de usuario (login por PIN)
 * ============================================================================
 *
 *  Carga el registro de usuarios (_users.db) y mantiene en memoria el usuario
 *  con sesion iniciada. La sesion NO se persiste: al cerrar la app se vuelve a
 *  pedir el PIN.
 *
 *  El AuthProvider va por ENCIMA de DatabaseProvider: primero sabemos QUIEN
 *  entra (y por tanto que fichero .db cargar) y solo entonces se abre la BD de
 *  finanzas. Ver AuthGate.
 * ============================================================================
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listUsers, verifyLogin, type User } from "@/lib/auth/registry";

type AuthState = {
  /** true cuando el registro ya esta cargado (bootstrap hecho). */
  ready: boolean;
  /** Error fatal al cargar el registro, si lo hay. */
  error: Error | null;
  /** Usuario con sesion iniciada, o null. */
  user: User | null;
  /** Lista de usuarios para la pantalla de login. */
  users: User[];
  refreshUsers: () => Promise<void>;
  login: (
    username: string,
    pin: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  /** Refresca el usuario en sesion desde el registro (tras cambiar su PIN). */
  setSessionUser: (user: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  const refreshUsers = useCallback(async () => {
    setUsers(await listUsers());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listUsers(); // dispara bootstrap del registro
        if (!cancelled) {
          setUsers(list);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, pin: string) => {
    const found = await verifyLogin(username, pin);
    if (!found) return { ok: false, error: "Usuario o PIN incorrecto." };
    setUser(found);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    // Cancelar y limpiar la cache de queries ANTES de desmontar: evita que
    // queries en vuelo/refetch golpeen una conexion que ya no toca, y que el
    // siguiente usuario vea datos cacheados del anterior. La conexion .db no se
    // cierra aqui; getDb() la reabre/cambia sola si entra otro usuario.
    queryClient.cancelQueries();
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const setSessionUser = useCallback((u: User) => setUser(u), []);

  return (
    <AuthContext.Provider
      value={{
        ready,
        error,
        user,
        users,
        refreshUsers,
        login,
        logout,
        setSessionUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
