"use client";

/**
 * ============================================================================
 *  src/contexts/QueryProvider.tsx — Configuracion de TanStack Query
 * ============================================================================
 *
 *  QUE ES TANSTACK QUERY (resumen de Pydantic-style en ARQUITECTURA)
 *  ----------------------------------------------------------------
 *  Es una libreria que maneja todo lo relacionado con "datos del servidor"
 *  en React: fetch, cache, refetch, sincronizacion entre componentes,
 *  estados de loading/error/success.
 *
 *  TIPOS CLAVE:
 *    - QueryClient: el "almacen" central que cachea queries y mutaciones.
 *      Existe uno por aplicacion.
 *    - useQuery():  hook para LEER datos. Recibe una `queryKey` (string
 *      unico por consulta) y una `queryFn` (funcion async que devuelve los datos).
 *    - useMutation(): hook para ESCRIBIR (crear, actualizar, borrar). Sus
 *      callbacks de exito invalidan queries relacionadas para que se
 *      refresquen automaticamente.
 *
 *  CONFIGURACION POR DEFECTO
 *  -------------------------
 *  - staleTime = 30s: los datos no se consideran "stale" hasta pasados 30s.
 *    Mientras esten frescos, no se refetchean al cambiar de componente.
 *  - retry = 1: si una query falla, se reintenta 1 vez antes de mostrar error.
 *  - refetchOnWindowFocus = false: no refrescamos al volver a la ventana.
 *    En una app local de escritorio no aporta, solo molesta.
 *
 *  DEVTOOLS
 *  --------
 *  En desarrollo, montamos el panel de TanStack Query Devtools. Aparece
 *  como un boton flotante abajo a la izquierda. Permite ver todas las
 *  queries activas, su estado, cache, etc. No se incluye en build prod.
 * ============================================================================
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  // Usamos useState para que el QueryClient se cree una sola vez por
  // montaje del componente, no en cada render. Es la forma idiomatica
  // de TanStack Query en React.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
