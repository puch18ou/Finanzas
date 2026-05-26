# Finanzas

Aplicación personal de finanzas — escritorio multiplataforma, base de datos local SQLite, multimoneda.

> Estado actual: **Lote 1** — cascarón Tauri + Next.js. Solo arranca una ventana con texto de bienvenida.

## Requisitos previos

- Node.js 20+ (probado con 24)
- Rust stable (probado con 1.95)
- Visual Studio 2022 Build Tools con workload "Desktop development with C++" (Windows)
- WebView2 (preinstalado en Windows 11)
- Git

Verifica con:

```powershell
node --version
npm --version
rustc --version
cargo --version
```

## Primera puesta en marcha

Desde la raíz del proyecto en una terminal de VS Code:

```powershell
# 1. Instalar dependencias de Node (tarda 1-3 minutos)
npm install

# 2. Generar tipos de Next.js (se hace solo al primer arranque, pero por si acaso)
npx next telemetry disable

# 3. Arrancar el modo desarrollo: levanta Next + abre ventana Tauri
npm run tauri:dev
```

La primera vez, `npm run tauri:dev` también compila el binario Rust. Eso descarga ~200 MB de crates y tarda **5-15 minutos**. Solo la primera vez. Las siguientes son instantáneas.

## Qué deberías ver

Al cabo de unos minutos se abre una ventana titulada "Finanzas" con un mensaje de bienvenida. No es el navegador, es una ventana nativa de Windows.

Si solo quieres ver la parte web (sin la ventana nativa), puedes correr `npm run dev` por separado y abrir <http://localhost:3000>.

## Estructura del proyecto

```
.
├── src/                # Frontend Next.js / React / TypeScript
│   ├── app/            # Rutas (App Router)
│   ├── components/     # Componentes reutilizables (vacío de momento)
│   ├── lib/            # Lógica de negocio + DB + repositorios (vacío de momento)
│   ├── hooks/          # Hooks personalizados (vacío de momento)
│   └── contexts/       # Contextos React (vacío de momento)
├── src-tauri/          # Envoltorio Rust de Tauri
│   ├── src/            # Código Rust (mínimo)
│   ├── capabilities/   # Permisos de plugins
│   ├── Cargo.toml
│   └── tauri.conf.json
├── drizzle/            # Migraciones SQL (vacío de momento)
├── package.json
├── tsconfig.json
├── next.config.mjs
└── tailwind.config.ts
```

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Solo frontend Next, sirve en :3000 |
| `npm run tauri:dev` | App de escritorio completa con hot reload |
| `npm run build` | Genera frontend estático en `/out` |
| `npm run tauri:build` | Genera ejecutable nativo (`.exe`/`.msi` en Windows) |
| `npm run typecheck` | Verifica tipos sin compilar |
| `npm run lint` | Linter |

## Próximos pasos

- Lote 2: esquema Drizzle + primera migración + cliente DB
- Lote 3: contexto de Settings + página de configuración
- Lote 4: capa de dominio (conversión monedas, PMT, agregaciones)
- Lote 5: repositorios + primera CRUD (Cuentas o Categorías)
- ...
