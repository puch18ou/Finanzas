import { redirect } from "next/navigation";

/**
 * La raiz "/" simplemente redirige al dashboard.
 *
 * En Tauri + Next con output: "export" esto se traduce en una pagina HTML
 * que hace navegacion del lado cliente al cargar.
 */
export default function HomePage() {
  redirect("/dashboard");
}
