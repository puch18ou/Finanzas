# Finanzas App — Arquitectura

> Documento de referencia del proyecto. Versión 2.0 — actualizado a 2026-05-29.
>
> Describe **qué se ha construido**, **con qué piezas** y **por qué**. La Fase A
> (app de escritorio local) está **implementada y completa**; además se añadió
> **multiusuario por PIN**, no contemplado en el diseño original. Las secciones
> de conceptos (stack, patrones) siguen vigentes; las de estructura, esquema y
> roadmap se han puesto al día con el estado real. La Fase C (PWA + sync) sigue
> siendo trabajo futuro.

---

## 1. Resumen ejecutivo

Aplicación personal de gestión financiera que reemplaza una hoja de cálculo Excel/SGD con macros (16 hojas, fórmulas complejas, doble moneda SGD/EUR). **Multiusuario en el mismo equipo** (acceso por PIN, una base de datos por usuario). Cubre:

- **Movimientos unificados** (gastos, ingresos, transferencias, ajustes) con categorización
- **Reglas recurrentes** que generan movimientos automáticamente cada mes
- Cuentas bancarias y patrimonio neto (**saldo calculado** desde los movimientos)
- Cartera de inversiones con P/L automático, **aportaciones puntuales y periódicas**, retiradas y archivado
- Simulador de hipoteca con tabla de amortización
- Otras deudas (préstamos, tarjetas) con cálculo de cuota
- Metas de ahorro con seguimiento, y meta de **tasa de ahorro** (% y/o €/mes)
- **Presupuestos** por categoría (mensual y acumulado anual)
- Dashboard con KPIs mensuales/anuales y evolución
- Proyección de patrimonio a futuro (con las metas superpuestas)
- Multi-moneda (entrada en moneda local, visualización en moneda secundaria)

### Plan de desarrollo en dos grandes fases

**Fase A — App de escritorio local.** Aplicación instalable en Windows/Mac/Linux. Base de datos SQLite en disco local. Solo accesible desde el ordenador donde se instale. Cero hosting, cero cuenta, cero costes recurrentes.

**Fase C — PWA con sincronización.** Aplicación web instalable también como app en móvil (PWA = Progressive Web App). Base de datos local en cada dispositivo (SQLite en navegador vía WebAssembly) más sincronización con servidor (Turso). Funciona offline, sincroniza al recuperar conexión.

> **Decisión clave del proyecto:** la Fase A se construye desde el día uno **respetando los patrones que la Fase C necesitará**. Mismo código TypeScript/React, distinto entorno de ejecución. El salto entre fases debe ser de **añadir** sin reescribir.

---

## 2. Concepto previo: ¿qué es una "stack" web moderna?

Si vienes de Python/C#/C, los proyectos web modernos pueden parecer un zoológico. Vamos a aclararlo brevemente.

Una app web tiene tres bloques tradicionales:

1. **Frontend** — lo que ve el usuario en pantalla. Código HTML/CSS/JavaScript que corre en el navegador.
2. **Backend** — el servidor que sirve datos. En Python sería Django/Flask/FastAPI; en C# sería ASP.NET.
3. **Base de datos** — donde viven los datos. Postgres, MySQL, SQLite, etc.

En una app **local** (estilo Excel), no hay frontend/backend separados: todo corre en tu ordenador. Tradicionalmente esto eran apps en C#/WinForms, Java/Swing, Python/Tkinter, etc.

**Lo que hacemos en este proyecto es algo intermedio**: una aplicación web embebida en una ventana de escritorio (Tauri). El "frontend" y la "lógica de negocio" están en TypeScript. El "backend" es opcional: en Fase A no hay servidor; en Fase C habrá uno para sincronizar.

Es la misma idea que VS Code, Discord, Slack o Spotify: por dentro son apps web; por fuera, ventanas nativas.

---

## 3. Stack tecnológico

### 3.1. TypeScript

**Qué es.** JavaScript con tipos estáticos. Sintaxis muy similar a C#. Tú escribes TypeScript, un compilador lo convierte a JavaScript "normal" para que lo entienda el navegador.

**Por qué.** Manejar dinero sin tipos es buscar bugs. TypeScript te avisa en tiempo de compilación si confundes `string` con `number`, si olvidas un campo obligatorio, si pasas un objeto mal formado. El autocompletado en el editor es serio. Viniendo de C# te vas a sentir como en casa.

**Ejemplo:**

```typescript
type Expense = {
  id: string;
  fecha: Date;
  importe: number;
  moneda: 'EUR' | 'SGD' | 'USD';  // tipo unión — solo estos tres
};

function addExpense(e: Expense): void { /* ... */ }

addExpense({ id: '1', fecha: new Date(), importe: 50, moneda: 'JPY' });
// ❌ Error de compilación: 'JPY' no es asignable al tipo 'EUR' | 'SGD' | 'USD'
```

### 3.2. React

**Qué es.** Una librería de JavaScript para construir interfaces de usuario de forma **declarativa**. En lugar de manipular elementos del DOM uno a uno ("coge este `<div>` y cámbiale el color"), describes **cómo debe verse la UI según el estado actual** y React se encarga del resto.

Para alguien viniendo de programación imperativa (C, Python), el cambio de mentalidad es: en lugar de *decir cómo hacer las cosas paso a paso*, *describes el resultado* y la librería computa los cambios mínimos para llegar ahí.

**Ejemplo:**

```tsx
function ExpenseCard({ expense }: { expense: Expense }) {
  return (
    <div className="rounded-lg border p-4">
      <h3>{expense.concepto}</h3>
      <p>{expense.importe} {expense.moneda}</p>
    </div>
  );
}
```

Eso es un "componente". Una función que recibe `props` (entradas) y devuelve la descripción de la UI. Si cambia `expense`, React vuelve a llamar la función y actualiza solo lo que cambió.

**El concepto central: `state`.** Los componentes pueden tener estado interno con `useState`:

```tsx
function MesSelector() {
  const [mes, setMes] = useState(1);  // estado: el mes actual, valor inicial 1

  return (
    <div>
      <p>Mes seleccionado: {mes}</p>
      <button onClick={() => setMes(mes + 1)}>Siguiente</button>
    </div>
  );
}
```

Cuando llamas `setMes`, React vuelve a renderizar el componente con el nuevo valor.

### 3.3. Next.js

**Qué es.** Un framework construido encima de React. Aporta enrutado por carpetas (cada subcarpeta de `app/` es una ruta URL), renderizado del lado servidor opcional, optimización automática, etc.

**Por qué en este proyecto.** Es el estándar más sólido del ecosistema React, tiene la mejor documentación y nos da una estructura de proyecto profesional desde el día uno. En Fase C lo seguimos usando exactamente igual.

**Nota importante.** No vamos a usar las funcionalidades de servidor de Next.js en Fase A (no hay servidor, todo corre en cliente dentro de Tauri). Usaremos solo su sistema de rutas y componentes. En Fase C, cuando haya servidor, aprovecharemos más cosas.

### 3.4. Tailwind CSS

**Qué es.** Un sistema de CSS basado en "clases utilitarias". En lugar de escribir CSS en hojas aparte, aplicas clases predefinidas directamente en el HTML/JSX:

```tsx
<div className="rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md">
  ...
</div>
```

Cada palabra es una propiedad CSS: `rounded-lg` = border-radius medio-grande, `p-4` = padding 1rem, etc.

**Por qué.** Productividad altísima una vez te acostumbras (1-2 horas). Sin saltar entre ficheros .css y .tsx. Sin pensar nombres de clases. Diseño consistente porque solo hay un set acotado de espaciados, colores, tipografías.

### 3.5. shadcn/ui

**Qué es.** *No es una librería que instales*. Es un catálogo de componentes (botones, inputs, dialogs, tablas, etc.) cuyo código copias a tu proyecto. Cada componente queda en `src/components/ui/` y lo puedes editar libremente.

**Por qué.** Diseño profesional desde el primer día, total control del código (no es una caja negra como otras librerías), accesibilidad y modo oscuro incluidos. Es lo que usa media industria en 2026.

```bash
npx shadcn@latest add button input dialog table
# Te genera src/components/ui/button.tsx, etc.
```

### 3.6. Drizzle ORM

**Qué es.** Un ORM (Object-Relational Mapper) de TypeScript. Si vienes de Python, piensa SQLAlchemy core o Tortoise ORM; de C#, piensa Entity Framework. Tú describes tablas en TypeScript, Drizzle te genera tipos automáticos y te ofrece un constructor de queries que se siente como SQL pero con autocompletado.

**Por qué Drizzle y no otro.** Tres razones:

1. **Tipos automáticos**: si añades una columna a una tabla, el tipo TypeScript se actualiza solo. Olvidas un campo obligatorio al insertar → error de compilación.
2. **Migraciones generadas**: Drizzle compara tu esquema con la base de datos y genera el SQL `ALTER TABLE` automáticamente.
3. **Funciona igual en SQLite local y en cliente WASM** — para la Fase C esto es crítico.

**Ejemplo:**

```typescript
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  fecha: integer('fecha', { mode: 'timestamp_ms' }).notNull(),
  importe: real('importe').notNull(),
  moneda: text('moneda').notNull(),
  categoriaId: text('categoria_id').notNull().references(() => categories.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

// Luego, en código de negocio:
const result = await db.select().from(expenses).where(eq(expenses.moneda, 'SGD'));
// result tiene tipo Expense[] automáticamente, autocompletado en cada campo
```

### 3.7. TanStack Query (antes "React Query")

**Qué es.** Una librería para manejar **datos del servidor en React**. Resuelve el problema de "cómo coordinar fetch, cache, refetch, sincronización entre componentes, estados de carga y error" sin escribir tu propio `useState` para cada cosa.

**Por qué importa muchísimo para Fase C.** Está diseñada con offline-first en mente. Maneja:

- Cache automático de queries
- Refetch al recuperar conexión / al volver a la ventana
- Reintentos automáticos
- Optimistic updates (la UI cambia antes de que el servidor confirme; si falla, se revierte)
- Cola de mutaciones offline

En Fase A lo usaremos contra la base de datos local (parece sobrecargado pero **ya nos pone el patrón mental** y la API que usaremos igual en Fase C). En Fase C, cuando metamos sync, no hay que reescribir los componentes.

**Ejemplo:**

```tsx
function ListaGastos() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses', { mes: 1, anio: 2026 }],
    queryFn: () => expenseRepository.list({ mes: 1, anio: 2026 }),
  });

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorBox error={error} />;
  return <ExpenseTable data={data} />;
}
```

### 3.8. Zod

**Qué es.** Librería de validación de esquemas en TypeScript. **Es a TypeScript lo que Pydantic es a Python**. Defines un esquema una vez, lo usas para:

- Validar inputs de formularios
- Validar respuestas de API
- Inferir tipos TypeScript automáticamente
- Validar el parseo de imports (CSV, JSON, Excel)

**Ejemplo:**

```typescript
import { z } from 'zod';

const ExpenseSchema = z.object({
  fecha: z.date(),
  concepto: z.string().min(1).max(200),
  importe: z.number().positive(),
  moneda: z.enum(['EUR', 'SGD', 'USD', 'GBP']),
  categoriaId: z.string().uuid(),
});

type Expense = z.infer<typeof ExpenseSchema>;
// ↑ esto es el tipo TypeScript, inferido del esquema. Cero duplicación.

// Validación
const result = ExpenseSchema.safeParse(formData);
if (!result.success) {
  console.log(result.error.format());  // errores por campo
}
```

### 3.9. Recharts

**Qué es.** Librería de gráficos para React. Declarativa: describes los gráficos como componentes.

**Por qué.** Suficientemente potente para lo que necesitas (líneas, barras, donuts, áreas, combinados) y mucho más simple de usar que D3. Se integra perfecto con TypeScript.

**Ejemplo:**

```tsx
<LineChart data={evolucionMensual}>
  <XAxis dataKey="mes" />
  <YAxis />
  <Tooltip />
  <Line dataKey="ingresos" stroke="#10b981" />
  <Line dataKey="gastos" stroke="#ef4444" />
  <Line dataKey="ahorro" stroke="#3b82f6" />
</LineChart>
```

### 3.10. Tauri

**Qué es.** Un framework para empaquetar aplicaciones web como ejecutables de escritorio nativos. Es la alternativa moderna a Electron.

**Diferencias con Electron:**

| Aspecto | Electron | Tauri |
|---|---|---|
| Backend | Node.js empaquetado | Rust nativo |
| Renderer | Chromium empaquetado | Webview del sistema |
| Tamaño .exe típico | 80-150 MB | 3-10 MB |
| Consumo de RAM | Alto | Bajo |
| Madurez | Muy alta | Alta (2.0 lanzado en 2024) |

**Cómo lo usamos en este proyecto.** Tauri arranca un proceso nativo que abre una ventana con un webview. Dentro del webview corre nuestra app de Next.js. Tauri ofrece "plugins" para acceder a SQLite, sistema de ficheros, etc., desde la app web mediante un puente JavaScript ↔ Rust.

**No necesitas saber Rust.** Para 95% del proyecto solo tocas TypeScript. Los plugins de Tauri exponen funciones JS listas.

```typescript
import Database from '@tauri-apps/plugin-sql';
const db = await Database.load('sqlite:finanzas.db');
await db.execute('INSERT INTO expenses ...');
```

### 3.11. SQLite

**Qué es.** Base de datos relacional, en un solo fichero, sin servidor. Probablemente la base de datos más desplegada del mundo (está dentro de tu móvil, navegador, miles de apps de escritorio).

**Por qué.** Es perfecta para apps locales mono-usuario. Y la podemos seguir usando en cliente y servidor en Fase C: en cliente vía SQLite WASM (compilado a WebAssembly que corre en el navegador), en servidor vía Turso (servicio cloud que sirve SQLite distribuido). Mismo SQL, cero fricción al migrar.

---

## 4. Patrones de arquitectura

Estos patrones son **obligatorios desde el primer commit**. Son lo que permitirá que el salto Fase A → Fase C sea de añadir, no de reescribir.

### 4.1. Capa de dominio: lógica pura

Toda la lógica de negocio (cálculo de cuota PMT, conversión de monedas, agregaciones por mes/categoría, proyección de patrimonio, etc.) vive en `src/lib/domain/` como **funciones TypeScript puras**. Reciben datos, devuelven datos. Sin tocar base de datos, sin tocar UI, sin efectos.

**Por qué.** En Fase C ese código no se toca. Y es trivial de testear (input → output).

**Ejemplo:**

```typescript
// src/lib/domain/mortgage.ts
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  years: number
): number {
  const monthlyRate = annualRate / 12;
  const totalPayments = years * 12;
  if (monthlyRate === 0) return principal / totalPayments;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) /
         (Math.pow(1 + monthlyRate, totalPayments) - 1);
}
```

### 4.2. Capa de datos: patrón Repository

Toda la lectura/escritura de datos pasa por **repositories** definidos como interfaces. La UI nunca habla directamente con Drizzle ni con la base de datos.

```typescript
// src/lib/repositories/expense-repository.ts
export interface ExpenseRepository {
  list(filter: ExpenseFilter): Promise<Expense[]>;
  getById(id: string): Promise<Expense | null>;
  create(data: NewExpense): Promise<Expense>;
  update(id: string, data: Partial<NewExpense>): Promise<Expense>;
  delete(id: string): Promise<void>;
  sumByCategory(mes: number, anio: number): Promise<Record<string, number>>;
}

// Fase A: implementación local
export class LocalExpenseRepository implements ExpenseRepository { /* Drizzle + SQLite */ }

// Fase C: implementación con sync
export class SyncedExpenseRepository implements ExpenseRepository { /* local + queue de sync */ }
```

La UI consume la interfaz vía inyección. El día que migremos a Fase C, cambiamos la implementación en un único punto (el contenedor de dependencias).

### 4.3. Identificadores: UUID en cliente

Todas las primary keys son **UUIDs (`text`)**, generados en cliente con `crypto.randomUUID()`. **Nunca autoincrementales.**

**Por qué.** En Fase C, dos dispositivos pueden crear filas simultáneamente sin conexión. Si fueran autoincrementales generarían IDs colisivos. UUIDs son globalmente únicos por diseño.

### 4.4. Auditoría y soft delete

Toda tabla principal tiene:

- `created_at: integer` (timestamp en ms desde epoch)
- `updated_at: integer`
- `deleted_at: integer | null` — soft delete

**Por qué.** Esencial para sincronización en Fase C: el servidor necesita saber qué fila ganó (la de `updated_at` mayor) cuando hay conflicto. Y los borrados deben propagarse — un borrado físico no se puede sincronizar (no hay rastro de él).

### 4.5. Migraciones versionadas

Drizzle Kit genera un fichero SQL por cada cambio de esquema, en `/drizzle/`. Estos ficheros se versionan en Git. Al arrancar la app, se aplican las migraciones nuevas en orden.

**Por qué.** En Fase A te permite evolucionar el esquema sin perder datos. En Fase C, las mismas migraciones se aplican al Turso del servidor.

### 4.6. Validación con Zod en los bordes

Cualquier dato que **entre** al sistema (formulario, importación de CSV, futuro endpoint de sync) se valida con Zod antes de tocar dominio o datos. Lo que ya está dentro se asume válido (los tipos TypeScript se encargan).

### 4.7. Estado global y providers

Los datos (settings incluido) se gestionan con **TanStack Query**, no con estado
global: la cache de Query *es* el estado. La configuración del usuario se lee con
el hook `useSettings()` (respaldado por su repositorio), no por un contexto
dedicado.

Los únicos contextos de React globales son de **infraestructura**, no de datos:

- `AuthProvider` — sesión del usuario (login por PIN). Ver 4.8.
- `DatabaseProvider` — abre la BD del usuario en sesión, aplica migraciones,
  ejecuta el seed y expone los **repositorios** (`useRepos()`); también dispara
  la generación de movimientos recurrentes y aportaciones periódicas al arrancar.
- `GlobalThemeProvider` — tema claro/oscuro/sistema, global del equipo
  (persistido en `localStorage`, compartido por todos los usuarios del PC).

### 4.8. Multiusuario y autenticación (Fase A)

Añadido tras el diseño original. Decisiones clave:

- **Una base de datos por usuario** (`user_<id>.db`): el aislamiento de datos es
  físico, no por columna `usuario_id`. La ruta activa se fija dinámicamente
  (`setActiveDbPath`) según quién entra; cada usuario abre su propio fichero.
- **Registro de usuarios aparte** en `_users.db` (`lib/auth/registry.ts`), con
  bootstrap autorreparable. El **PIN** (4–8 dígitos) se hashea con PBKDF2-SHA256
  vía `crypto.subtle` (`lib/auth/pin.ts`). Hay un rol `admin` (gestión de
  usuarios: crear, resetear PIN, borrar) y autorregistro desde el login.
- **Sesión en memoria** (`AuthProvider`); opción "mantener sesión iniciada" que
  recuerda el id del usuario (no el PIN) en `localStorage` para entrar directo al
  reabrir. El logout la olvida.
- El `AuthProvider` va **por encima** del `DatabaseProvider`: primero se sabe
  QUIÉN entra (y por tanto qué `.db` cargar) y solo entonces se abre la BD de
  finanzas.

---

## 5. Estructura del repositorio

```
finanzas/
├── src-tauri/                  # Proyecto Tauri (Rust, casi nunca se toca)
│   ├── tauri.conf.json         # Config: nombre, icono, ventana (maximizada), plugins
│   └── Cargo.toml              # Dependencias Rust
│
├── src/
│   ├── app/                    # Rutas (Next.js App Router)
│   │   ├── layout.tsx          # Layout raíz: providers + sidebar + AuthGate
│   │   ├── page.tsx            # Redirige a /dashboard
│   │   ├── dashboard/ · evolucion/ · proyeccion/ · presupuestos/
│   │   ├── movimientos/ · recurrentes/
│   │   ├── cuentas/ · inversiones/ · metas/
│   │   ├── hipoteca/ · deudas/
│   │   ├── categorias/ · monedas/
│   │   └── ajustes/ · papelera/
│   │
│   ├── components/
│   │   ├── ui/                 # shadcn/ui: button, input, dialog, table…
│   │   ├── auth/               # LoginScreen, AuthGate, AdminConsole, ForcePinChange…
│   │   ├── layout/             # AppSidebar, SidebarFooterHints…
│   │   ├── charts/             # CategoryChart, EvolutionChart…
│   │   ├── forms/              # Diálogos CRUD (Movement, Investment, Goal, Contributions…)
│   │   ├── crud/               # PeriodSelector, DeleteConfirmation…
│   │   ├── dashboard/ · metas/ # Componentes por sección (KPI, BudgetProgress, SavingsRateCard…)
│   │
│   ├── lib/
│   │   ├── auth/               # registry.ts (_users.db), pin.ts (PBKDF2)
│   │   ├── db/
│   │   │   ├── schema.ts       # Esquema Drizzle (single source of truth)
│   │   │   ├── client.ts       # Cliente SQLite por usuario (ruta dinámica)
│   │   │   ├── proxy-driver.ts # Adaptador Drizzle ↔ Tauri SQL
│   │   │   ├── migrate.ts      # Runner de migraciones (idempotente)
│   │   │   └── seed.ts         # Carga inicial: monedas, categorías por defecto
│   │   ├── repositories/       # Acceso a datos por tabla (settings, categories,
│   │   │                       #   accounts, investments, investment-contribution,
│   │   │                       #   goals, mortgage, other-debts, movements,
│   │   │                       #   recurring-rule, currency)
│   │   ├── services/           # Orquestación: recurring, investment-contribution,
│   │   │                       #   mortgage-debt-sync, trash, backup
│   │   ├── domain/             # Lógica pura (testeada): currency, mortgage,
│   │   │                       #   projection-goals, aggregation, goals,
│   │   │                       #   investments, recurring, accounts
│   │   ├── schemas/            # Esquemas Zod de formularios
│   │   └── utils/              # fechas (UTC-noon), cn, formatters
│   │
│   ├── hooks/                  # Hooks de datos (TanStack Query) y utilidades
│   └── contexts/
│       ├── AuthProvider.tsx
│       ├── DatabaseProvider.tsx
│       └── GlobalThemeProvider.tsx
│
├── drizzle/                    # Migraciones SQL versionadas (0000_init … 0014_*)
├── tests/                      # Tests de dominio (Vitest)
├── package.json · tsconfig.json · drizzle.config.ts · next.config.ts
└── README.md · ARQUITECTURA.md
```

---

## 6. Esquema de base de datos

La fuente de verdad es `src/lib/db/schema.ts`. Cada **usuario** tiene su propia
base de datos (`user_<id>.db`) con estas tablas; aparte existe `_users.db` (el
registro de usuarios, fuera de este esquema). Resumen:

| Tabla | Filas esperadas | Propósito |
|---|---|---|
| `settings` | 1 (singleton) | Config del usuario (monedas, objetivo de ahorro %/€, hipoteca, patrimonio inicial…) |
| `currencies` | ~13 | Catálogo de monedas y tipos de cambio |
| `categories` | ~12-20 | Categorías de gasto con presupuesto mensual |
| `accounts` | ~5-15 | Cuentas (corriente, ahorro, broker, efectivo, crédito); saldo calculado |
| `movements` | crece sin tope | **Tabla unificada**: gasto, ingreso, transferencia, ajuste, intereses, cuota |
| `recurring_rules` | ~pocas | Reglas que generan `movements` automáticamente (también planes de aportación periódica a inversiones) |
| `investments` | ~5-50 | Cartera (acciones, ETF, fondos, cripto, oro…); totales cacheados |
| `investment_contributions` | crece | Aportaciones/retiradas por inversión (de aquí se recalculan los totales) |
| `goals` | ~3-10 | Metas de ahorro |
| `mortgage` | 0 o 1 | Hipoteca activa |
| `other_debts` | ~0-5 | Préstamos consumo, tarjetas |
| `sync_log` | (vacía en Fase A) | (Fase C) cola de operaciones por sincronizar |

> **Cambio respecto al diseño original:** lo que iban a ser tablas separadas
> `expenses` / `monthly_incomes` / `extra_incomes` se unificó en una sola tabla
> `movements` (el `tipo` discrimina el comportamiento; el importe siempre es
> positivo y el signo lo deciden el tipo y las cuentas origen/destino).

**No son tablas, son cálculos** (capa de dominio):
- Saldo de cada cuenta (desde `movements`)
- Dashboard, KPIs y evolución mensual (desde `movements`)
- Tabla de amortización (desde `mortgage`)
- P/L y totales de inversión (desde `investment_contributions`)
- Proyección de patrimonio y cumplimiento de metas (desde varios)

---

## 7. Manejo de monedas

Punto especialmente delicado.

**Principio:** Cada importe se guarda **en su moneda original** (la moneda en la que se realizó la transacción) junto al **código de moneda**. La conversión a moneda de visualización se hace **al leer**, nunca al escribir.

**Por qué.** Los tipos de cambio cambian con el tiempo. Si guardas convertido, pierdes la información original. Si guardas en original, puedes recalcular cualquier vista con cualquier tipo de cambio futuro.

**Estructura de tipos de cambio.** Cada moneda tiene `tipo_cambio_vista`: cuántas unidades de moneda de visualización equivale 1 unidad de esa moneda. La moneda de visualización siempre vale 1.

```typescript
function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  // rates está expresado contra la moneda vista actual
  // amount en `from` → moneda vista → `to`
  if (from === to) return amount;
  const inView = amount * rates[from];
  return inView / rates[to];
}
```

**Decisión pendiente Fase C:** ¿quieres que los tipos de cambio se actualicen automáticamente desde una API (e.g. exchangerate.host)? Si sí, lo dejamos preparado pero deshabilitado en Fase A.

---

## 8. Estado actual y roadmap

### Fase A — Completa (implementada)

Todo lo previsto para la app de escritorio local está construido, y desarrollado
en "lotes" incrementales pequeños y verificables:

- **Fundación**: Next.js + Tauri + Tailwind + shadcn; Drizzle + SQLite;
  migraciones; seed; layout con sidebar; ajustes.
- **Datos maestros**: CRUD de Cuentas, Categorías y Monedas.
- **Movimientos**: tabla unificada `movements` (gasto/ingreso/transferencia/
  ajuste) con filtros por periodo y tipo, gasto rápido y cuenta por defecto.
- **Recurrentes**: reglas que generan movimientos automáticamente al arrancar.
- **Patrimonio**: cuentas con **saldo calculado** + conciliación; inversiones
  con P/L, aportaciones puntuales y **periódicas** (diaria/semanal/mensual),
  retiradas y archivado; metas con progreso + meta de **tasa de ahorro** (%/€).
- **Deuda**: hipoteca (PMT + amortización, integrable en el dashboard) y otras
  deudas; con sus reglas recurrentes vinculadas.
- **Vistas calculadas**: dashboard con KPIs y gráficos, evolución, proyección
  (con metas), y **presupuestos** (mensual + acumulado anual).
- **Refinamiento**: export/import JSON (backup v4), tema claro/oscuro, papelera
  (soft-delete + restaurar), tests de la capa de dominio (Vitest).
- **Multiusuario** (no previsto en el diseño original): login por PIN, una BD
  por usuario, consola admin, "mantener sesión". Ver 4.8.

### Fase 2 — Multi-dispositivo con sincronización P2P (en marcha)

> La idea original de Fase C era una PWA con un backend de sync (Turso). Se
> **revisó** (2026-06): el objetivo pasa a ser una **app de móvil con Tauri
> Mobile** (mismo código React/Tauri compilado a Android/iOS) y
> **sincronización peer-to-peer sin servidor central**, para conservar el
> caracter *local-first* (los datos siguen sin pasar por la nube). El antiguo
> plan PWA + Turso queda descartado.

**Modelo de sincronización: last-write-wins (LWW) por registro, basado en
estado.** No hay log de operaciones: como toda tabla ya tiene `updated_at` y
`deleted_at` y las PK son UUID de cliente (sin colisiones entre dispositivos),
sincronizar es "intercambiar las filas cambiadas desde el último cursor y, para
cada `id`, quedarse con la de `updated_at` mayor". Cimientos ya implementados:

- **Motor de fusión puro** (`src/lib/domain/sync.ts`, con tests): `mergeTable`
  (LWW por `id`), `compareVersions` (desempate determinista por `deviceId`, da
  el mismo resultado en ambos pares), `collectChanges` (filas posteriores al
  cursor) y `SYNC_TABLE_ORDER` (orden FK-seguro para aplicar cambios).
- **Estado de sync** (`sync_state`, migración 0025): cursores
  `last_pulled_at` / `last_pushed_at` por dispositivo-par. Es plomería **local**
  (no se sincroniza). El `deviceId` propio vive en `localStorage`
  (`lib/sync/device.ts`): es per-instalación, estable e independiente del
  usuario logueado.
- **Lápidas de borrado** (`tombstones`, migración 0026): al vaciar la papelera
  el registro se borra físicamente, pero queda una lápida ligera
  (`id` + tabla + fecha) que viaja por sync para que el borrado se propague en
  vez de resucitar. Una lápida "mata" la fila viva del par solo si es
  estrictamente más nueva; una edición concurrente posterior gana al borrado
  (LWW). Ver `idsKilledByTombstones` / `mergeTombstones`.

**Pendiente (transporte, fase siguiente):** descubrimiento de dispositivos y
transferencia P2P (Tauri Mobile), el bucle de sync que une motor + cursores +
lápidas, UI de estado/empareja­miento, y consideraciones de reloj (el LWW usa
`updated_at` de pared; para 2 dispositivos personales es suficiente, un reloj
lógico/HLC sería un refinamiento). Nota: importar un backup reescribe los
`updated_at`, lo que invalida los cursores — habrá que resetearlos al importar.

---

## 9. Decisiones pendientes (a tomar conforme avancemos)

| Tema | Estado |
|---|---|
| Precios de inversiones | **Decidido: manual** (sin API en Fase A; candidato a un lote futuro) |
| Actualización de tipos de cambio | **Manual** por ahora (editable en Monedas) |
| Backup en Fase A | **Manual**: export/import JSON (Ajustes) o copia de los `.db` |
| Autenticación local | **Hecho**: PIN multiusuario + rol admin (ver 4.8) |
| Sincronización móvil | **En marcha (Fase 2)**: Tauri Mobile + P2P, LWW por registro. Cimientos hechos (motor, `sync_state`, `tombstones`); transporte pendiente (ver 8) |
| Idioma | Solo español por ahora |
| Más de una hipoteca | La estructura lo permitiría; sin necesidad actual |

---

## 10. Anti-objetivos (lo que NO hacemos)

- **No** hay reportes fiscales / declaración de impuestos.
- **No** hay integración bancaria automática (open banking) en Fase A. Es candidato a fase futura pero no compromiso.
- **No** hay servidor central ni nube: en Fase 2 el móvil llega vía **Tauri Mobile** con sincronización **peer-to-peer**, manteniendo el caracter local-first (ver 8, Fase 2).

> Nota: el diseño original incluía aquí "no multiusuario" y "no permisos". Se
> revisó: ahora **sí** hay multiusuario local por PIN, con un rol `admin` para
> gestionar usuarios (permisos mínimos). No hay roles más finos.

---

## Apéndice: glosario

- **PWA** — Progressive Web App. Web instalable como app, con soporte offline.
- **ORM** — Object-Relational Mapper. Capa que traduce entre objetos del lenguaje y filas SQL.
- **PMT** — fórmula financiera de la cuota fija de un préstamo (la misma de Excel).
- **WASM** — WebAssembly. Código nativo (C, Rust) compilado para correr en navegador.
- **Tauri plugin** — paquete que expone funcionalidad nativa (SQLite, FS…) a JavaScript.
- **JSX/TSX** — sintaxis que mezcla HTML y JavaScript/TypeScript en el mismo fichero.
- **Hook (React)** — función `useAlgo()` que conecta un componente con estado o efectos.
- **Soft delete** — marcar `deleted_at` en lugar de borrar la fila físicamente.
- **Optimistic update** — la UI cambia antes de que el servidor confirme; si falla, se revierte.
