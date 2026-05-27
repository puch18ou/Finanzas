/**
 * src/app/gastos/page.tsx
 *
 * Lote 10a-2: la pantalla de gastos fue sustituida por /movimientos
 * (filtrable por tipo). Esta ruta queda como redireccion para que los
 * enlaces antiguos sigan funcionando.
 *
 * Si quisieras eliminarla del todo, podrias borrar este archivo y la
 * carpeta `gastos/`. Pero conservarla como redirect es una buena practica
 * (no rompe URLs externas, atajos guardados, etc.).
 */

import { redirect } from "next/navigation";

export default function GastosPage() {
  redirect("/movimientos");
}
