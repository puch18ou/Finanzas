"use client";

/**
 * ============================================================================
 *  src/contexts/AuthProvider.tsx — Sesion de usuario (login por PIN)
 * ============================================================================
 *
 *  Carga el registro de usuarios (_users.db) y mantiene en memoria el usuario
 *  con sesion iniciada. Por defecto la sesion NO se persiste (al cerrar la app
 *  se vuelve a pedir el PIN), pero si el usuario marca "mantener sesion" al
 *  entrar, se recuerda su id en localStorage y al reabrir entra directo. Cerrar
 *  sesion borra ese recuerdo.
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

// Id del usuario cuya sesion se mantiene entre reinicios (si marco "mantener
// sesion"). Solo guardamos el id; nunca el PIN.
const REMEMBER_KEY = "auth:rememberedUserId";

function getRememberedUserId(): string | null {
  try {
    return window.localStorage.getItem(REMEMBER_KEY);
  } catch {
    return null;
  }
}

function setRememberedUserId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(REMEMBER_KEY, id);
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // sin persistencia de sesion; no es critico
  }
}

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
    remember?: boolean,
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
          // Auto-login si hay sesion recordada y el usuario sigue existiendo.
          const rememberedId = getRememberedUserId();
          if (rememberedId) {
            const remembered = list.find((u) => u.id === rememberedId);
            if (remembered) setUser(remembered);
            else setRememberedUserId(null); // usuario borrado: limpiar
          }
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

  const login = useCallback(
    async (username: string, pin: string, remember = false) => {
      const found = await verifyLogin(username, pin);
      if (!found) return { ok: false, error: "Usuario o PIN incorrecto." };
      setUser(found);
      // "Mantener sesion": recordamos el id para entrar directo al reabrir.
      setRememberedUserId(remember ? found.id : null);
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(() => {
    // Cancelar y limpiar la cache de queries ANTES de desmontar: evita que
    // queries en vuelo/refetch golpeen una conexion que ya no toca, y que el
    // siguiente usuario vea datos cacheados del anterior. La conexion .db no se
    // cierra aqui; getDb() la reabre/cambia sola si entra otro usuario.
    queryClient.cancelQueries();
    queryClient.clear();
    // Cierre explicito de sesion: olvidamos el recuerdo (la proxima vez pedira
    // login). Si el usuario solo cierra la app sin desloguear, sigue recordado.
    setRememberedUserId(null);
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
