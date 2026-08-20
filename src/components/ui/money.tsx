"use client";

/**
 * src/components/ui/money.tsx — Muestra un importe respetando el modo privacidad.
 *
 * Uso: <Money>{formatAmount(x, moneda)}</Money> o <Money>{formatMoney(x, m)}</Money>.
 * Es agnostico del formateador: recibe el texto YA formateado y, si el modo
 * privacidad esta activo, lo enmascara (•••• conservando la moneda).
 *
 * Para sitios donde no cabe un componente (atributos, tooltips de graficas),
 * usar `usePrivacy()` + `maskMoney()` directamente.
 */

import { usePrivacy } from "@/contexts/PrivacyProvider";
import { maskMoney } from "@/lib/utils/privacy";

export function Money({ children }: { children: string }) {
  const { hidden } = usePrivacy();
  return <>{hidden ? maskMoney(children) : children}</>;
}
