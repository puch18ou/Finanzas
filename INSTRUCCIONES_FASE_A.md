# Lote 3 — Fase A: Tailwind v4 + Repositorios + Hooks + Query

> Aplicar este pack ANTES de ejecutar los comandos de Fase B (shadcn).

## Pasos (en orden)

### 1. Aplicar este zip al proyecto

Descomprime `finanzas-lote3-faseA.zip` sobre la carpeta del proyecto, sobrescribiendo. Modifica:

- `package.json` (sube Tailwind a v4, añade TanStack Query, shadcn deps, lucide-react)
- `postcss.config.mjs` (cambia a la sintaxis de Tailwind v4)
- `src/app/globals.css` (paleta emerald + variables CSS de shadcn)

Añade ficheros nuevos:

- `components.json` (manifiesto de shadcn)
- `src/lib/utils/cn.ts`
- `src/lib/repositories/` (base, settings, currency, index)
- `src/hooks/useSettings.ts`
- `src/contexts/QueryProvider.tsx`
- `src/contexts/DatabaseProvider.tsx` (modificado: ahora expone repos)

### 2. Borrar ficheros que ya no se usan (Tailwind v4 no los necesita)

```powershell
Remove-Item tailwind.config.ts -ErrorAction SilentlyContinue
```

> El `tailwind.config.ts` de Tailwind v3 ya no es necesario. En v4 toda la
> configuración vive dentro del CSS con las directivas `@theme` y `@custom-variant`.
> Si decidiéramos volver a v3 más adelante, el archivo se puede recrear.

### 3. Reinstalar dependencias

Como hay nuevos paquetes y cambios mayores (Tailwind v4):

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install
```

Tarda 2-4 minutos.

### 4. Verificar que sigue compilando

Antes de añadir shadcn, verifica que la app sigue arrancando con los cambios:

```powershell
npm run tauri:dev
```

Debería abrirse igual que en el Lote 2 (pantalla verde de diagnóstico). Si hay error, **párate y avisa antes de seguir** con la Fase B.

### 5. Si todo OK → continuar con Fase B (comandos shadcn)

Pasa a las instrucciones de la Fase B que te paso en el siguiente mensaje.
