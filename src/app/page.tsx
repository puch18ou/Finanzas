export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">Finanzas</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400">
        Cascaron Tauri + Next.js arrancado correctamente.
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <p>Si ves esto dentro de una ventana nativa (no en el navegador), la integracion funciona.</p>
        <p className="mt-1 text-slate-500">Lote 1 OK. Siguiente: esquema y base de datos.</p>
      </div>
    </main>
  );
}
