# Finanzas

Aplicación personal de finanzas para **escritorio**, multiplataforma, con base
de datos **local SQLite**, **multimoneda** y **multiusuario** (acceso por PIN).
Todo funciona en local: no hay servidor ni nube.

---

## Qué hace

Gestión integral de las finanzas personales, organizada por secciones:

### Resumen
- **Dashboard**: KPIs del mes (ingresos, gastos, ahorro y tasa de ahorro,
  patrimonio neto), gráfico de gasto por categoría, presupuesto del mes y
  últimos movimientos.
- **Evolución**: gráfico mensual de ingresos vs gastos con varios estilos
  (líneas, barras agrupadas/apiladas, áreas, combo barras + línea de ahorro).
- **Proyección**: estimación del patrimonio neto futuro según tu tasa de ahorro
  media, con las **metas** superpuestas (líneas-hito y fecha estimada de
  cumplimiento vs objetivo).
- **Presupuestos**: seguimiento por categoría del consumo del mes y del
  **acumulado anual** (gastado ene–mes vs presupuesto acumulado).

### Movimientos
- **Movimientos**: gastos, ingresos, transferencias y ajustes, con filtros por
  periodo y tipo. El importe siempre es positivo; el tipo y las cuentas
  origen/destino determinan el signo.
- **Recurrentes**: reglas que generan movimientos automáticamente cada mes al
  arrancar la app (salario, alquiler, cuotas, intereses…). Idempotentes.

### Patrimonio
- **Cuentas**: corrientes, ahorro, broker, efectivo, crédito. El **saldo se
  calcula** desde los movimientos (no se guarda); incluye conciliación (ajuste)
  y cuenta por defecto.
- **Inversiones**: cartera (acciones, ETF, fondos, cripto, oro, etc.) con P/L.
  Aportaciones **puntuales y periódicas** (diaria/semanal/mensual), retiradas a
  una cuenta, "modo solo dinero" para tipos sin participaciones, y **archivar**
  posiciones cerradas. Cada aportación mueve el saldo de una cuenta real.
- **Metas**: objetivos de ahorro (importe + fecha) con progreso automático si
  vinculas una cuenta, más una meta de **tasa de ahorro** (% de ingresos y/o
  importe €/mes) con seguimiento de cumplimiento de los últimos 12 meses.

### Deuda
- **Hipoteca**: cálculo de cuota (PMT) y tabla de amortización; puede integrar
  la cuota en el dashboard y generar su movimiento recurrente.
- **Otras deudas**: préstamos, coche, tarjetas, personales.

### Catálogos y sistema
- **Categorías** (con presupuesto mensual), **Monedas** (con tipo de cambio).
- **Ajustes**: moneda local/vista, objetivo de ahorro, hipoteca, patrimonio
  inicial, backup (exportar/importar JSON), cambio de PIN propio.
- **Papelera**: restauración de elementos borrados (soft-delete).

---

## Multiusuario y seguridad

- **Una base de datos por usuario** (`user_<id>.db`); el aislamiento de datos es
  físico, no por columnas. Un registro aparte (`_users.db`) guarda los usuarios.
- **Login por PIN** (4–8 dígitos) hasheado con PBKDF2-SHA256. Hay un usuario
  `admin` para gestionar usuarios (crear, resetear PIN, borrar). También hay
  autorregistro desde la pantalla de login.
- Opción **"mantener sesión iniciada"**: recuerda el usuario (no el PIN) y entra
  directo al reabrir; cerrar sesión lo olvida.
- **Tema** (claro/oscuro/sistema) global del equipo.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Shell de escritorio | **Tauri 2** (Rust) + WebView del sistema |
| UI | **Next.js 16** (App Router, export estático) + **React 19** |
| Lenguaje | **TypeScript** |
| Base de datos | **SQLite** vía `@tauri-apps/plugin-sql` |
| ORM | **Drizzle ORM** (+ driver proxy a Tauri SQL) |
| Estado servidor | **TanStack Query** |
| Componentes | **shadcn/ui** (Radix UI) + **Tailwind CSS 4** |
| Gráficos | **Recharts** |
| Formularios | **react-hook-form** + **Zod** |
| Iconos / toasts | **lucide-react** / **sonner** |
| Tests | **Vitest** (capa de dominio) |

---

## Requisitos previos

- **Node.js 20+**
- **Rust** stable (toolchain de Tauri)
- **Windows**: Visual Studio Build Tools 2022 con "Desktop development with C++"
  y WebView2 (preinstalado en Windows 11)
- **Git**

---

## Puesta en marcha

```powershell
npm install
npm run tauri:dev      # app de escritorio con hot reload
```

La primera vez se crean la base de datos, las migraciones, el seed (monedas y
categorías por defecto) y el usuario `admin` (PIN inicial `0000`, que se debe
cambiar al entrar).

---

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run tauri:dev` | App de escritorio completa con hot reload |
| `npm run dev` | Solo frontend Next en `:3000` (sin Tauri) |
| `npm run build` | Genera el frontend estático en `/out` |
| `npm run tauri:build` | Genera el ejecutable nativo (`.exe`/`.msi`) |
| `npm run typecheck` | Verifica tipos sin compilar |
| `npm test` | Ejecuta los tests de dominio (Vitest) |
| `npm run db:generate` | Genera una migración SQL desde cambios en `schema.ts` |
| `npm run db:studio` | Abre Drizzle Studio (UI web para la BD) |

---

## Estructura del proyecto

```
.
├── src/
│   ├── app/                     # Páginas (App Router): dashboard, movimientos,
│   │                            #   cuentas, inversiones, metas, presupuestos,
│   │                            #   proyeccion, hipoteca, deudas, ajustes, ...
│   ├── components/
│   │   ├── ui/                  # Primitivos shadcn/ui
│   │   ├── auth/                # Login, consola admin, cambio de PIN
│   │   ├── forms/               # Diálogos de formularios (CRUD)
│   │   ├── charts/              # Gráficos (recharts)
│   │   ├── dashboard/ · metas/ · layout/   # Componentes por sección
│   ├── contexts/
│   │   ├── AuthProvider.tsx     # Sesión por PIN
│   │   ├── DatabaseProvider.tsx # Init de BD del usuario + repos
│   │   └── GlobalThemeProvider.tsx
│   ├── hooks/                   # Hooks de datos (TanStack Query) y utilidades
│   └── lib/
│       ├── auth/                # registro de usuarios + hashing de PIN
│       ├── db/                  # schema.ts, client, proxy-driver, migrate, seed
│       ├── domain/              # lógica pura (moneda, inversiones, hipoteca,
│       │                        #   agregaciones, metas, recurrentes) — testeada
│       ├── repositories/        # acceso a datos por tabla (Drizzle)
│       ├── services/            # orquestación (recurrentes, aportaciones, backup…)
│       ├── schemas/             # validación de formularios (Zod)
│       └── utils/               # fechas, cn, etc.
├── drizzle/                     # Migraciones SQL (0000_init … 0014_*)
├── src-tauri/                   # Proyecto Tauri (Rust) + tauri.conf.json
├── tests/                       # Tests de dominio (Vitest)
├── ARQUITECTURA.md              # Detalle de decisiones de arquitectura
└── README.md
```

---

## Base de datos, migraciones y backup

- Las migraciones viven en `drizzle/NNNN_*.sql`, se importan con `?raw` y se
  registran en el array `MIGRATIONS` de `src/lib/db/migrate.ts`. El runner es
  **idempotente** (se aplican una sola vez por base de datos).
- Para cambiar el esquema: editar `src/lib/db/schema.ts`, generar la migración
  (`npm run db:generate`) o escribirla a mano, y registrarla en `migrate.ts`.
- Los ficheros `.db` viven en el AppDataDir del sistema operativo:
  - **Windows**: `C:\Users\<usuario>\AppData\Roaming\personal.finanzas.app\`
  - **macOS**: `~/Library/Application Support/personal.finanzas.app/`
  - **Linux**: `~/.local/share/personal.finanzas.app/`
  - Contiene `_users.db` (registro de usuarios) y un `user_<id>.db` por usuario.
- **Backup recomendado**: Ajustes → Exportar (JSON, versión 4). También puedes
  copiar los ficheros `.db`. **Importante**: haz un backup **antes de aplicar
  migraciones** (al actualizar la app).

Para inspeccionar la BD puedes usar la extensión "SQLite Viewer" de VS Code o
`npm run db:studio`.
