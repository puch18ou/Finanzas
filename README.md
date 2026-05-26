# Finanzas

Aplicación personal de finanzas — escritorio multiplataforma, base de datos local SQLite, multimoneda.

> Estado actual: **Lote 2** — base de datos funcionando. Pantalla de diagnóstico que verifica que todo está en orden.

## Requisitos previos

- Node.js 20+ (probado con 24)
- Rust stable (probado con 1.95)
- Visual Studio 2022 Build Tools con workload "Desktop development with C++" (Windows)
- WebView2 (preinstalado en Windows 11)
- Git

## Puesta en marcha (si vienes del Lote 1)

Como el Lote 2 añade ficheros y modifica algunos, conviene reinstalar dependencias por si hay nuevas:

```powershell
# Si ya tenías node_modules del Lote 1, lo borramos para empezar limpio
Remove-Item -Recurse -Force node_modules
del package-lock.json

# Instalar (incluye drizzle-orm, drizzle-kit, raw-loader y otras)
npm install

# Arrancar la app
npm run tauri:dev
```

## Qué debería pasar al arrancar

1. Se abre la ventana titulada "Finanzas"
2. Muestra brevemente "Inicializando base de datos..."
3. Tras 1-2 segundos cambia a "Base de datos lista" con un resumen:
   - Migraciones aplicadas: `0000_init`
   - Monedas insertadas: 13
   - Categorías insertadas: 12
   - Fila de settings creada: sí
4. Más abajo aparece una tabla con el conteo de filas (currencies=13, categories=12, settings=1, el resto a 0)

Si **reinicias la app**:
- Migraciones aplicadas: `ninguna (ya estaban)`
- Monedas y categorías insertadas: 0 (el seed es idempotente)
- Los conteos persisten

## Estructura actualizada

```
.
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Envuelto en DatabaseProvider
│   │   ├── page.tsx         # Pantalla diagnóstico del Lote 2
│   │   └── globals.css
│   ├── contexts/
│   │   └── DatabaseProvider.tsx   # Inicializa DB + expone via context
│   ├── lib/
│   │   └── db/
│   │       ├── schema.ts          # Esquema Drizzle (las 12 tablas)
│   │       ├── client.ts          # Singleton que abre SQLite + Drizzle
│   │       ├── proxy-driver.ts    # Adaptador Drizzle ↔ Tauri SQL
│   │       ├── migrate.ts         # Aplicador de migraciones
│   │       └── seed.ts            # Inserción inicial (monedas/categorías)
│   └── types.d.ts                 # Declaraciones para imports ?raw
├── drizzle/
│   └── 0000_init.sql              # Primera migración (creación tablas)
├── drizzle.config.ts              # Config drizzle-kit
├── src-tauri/                     # Sin cambios respecto al Lote 1
├── ...
```

## Dónde vive el fichero `.db`

El plugin SQL de Tauri lo crea en el AppDataDir del SO:

- **Windows**: `C:\Users\<TuUsuario>\AppData\Roaming\personal.finanzas.app\finanzas.db`
- **macOS**: `~/Library/Application Support/personal.finanzas.app/finanzas.db`
- **Linux**: `~/.local/share/personal.finanzas.app/finanzas.db`

**Backup**: copia ese fichero. **Restaurar**: pégalo en la misma ruta.
**Empezar de cero**: bórralo y reinicia la app.

Puedes abrir el fichero con la extensión "SQLite Viewer" de VS Code para inspeccionar tablas, ejecutar SELECTs, etc.

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Solo frontend Next, sirve en :3000 |
| `npm run tauri:dev` | App de escritorio completa con hot reload |
| `npm run build` | Genera frontend estático en `/out` |
| `npm run tauri:build` | Genera ejecutable nativo (`.exe`/`.msi`) |
| `npm run typecheck` | Verifica tipos sin compilar |
| `npm run db:generate` | Genera nueva migración SQL desde cambios en schema.ts |
| `npm run db:studio` | Abre Drizzle Studio (UI web para la BD) |

## Próximos pasos

- **Lote 3**: Contexto de Settings + página de configuración (cambiar moneda local/vista, año/mes activo, etc.)
- **Lote 4**: Capa de dominio (conversión de monedas, PMT hipoteca, agregaciones)
- **Lote 5**: Primer CRUD completo (Cuentas o Categorías)
- ...
