# Finanzas App — Arquitectura

> Documento de referencia del proyecto. Versión 1.0 — 26 de mayo de 2026.
>
> Este documento describe **qué vamos a construir**, **con qué piezas** y **por qué**. Cada decisión está justificada y los conceptos nuevos vienen explicados desde cero. Sirve como guía para todas las fases del proyecto.

---

## 1. Resumen ejecutivo

Aplicación personal de gestión financiera que reemplaza una hoja de cálculo Excel/SGD con macros (16 hojas, fórmulas complejas, doble moneda SGD/EUR). Un solo usuario (tú). Cubre:

- Registro y categorización de gastos e ingresos
- Cuentas bancarias y patrimonio neto
- Cartera de inversiones con P/L automático
- Simulador de hipoteca con tabla de amortización
- Otras deudas (préstamos, tarjetas) con cálculo de cuota
- Metas de ahorro con seguimiento
- Dashboard con KPIs mensuales/anuales y evolución
- Proyección de patrimonio a futuro
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

### 4.7. Estado global mínimo: SettingsContext

Solo una cosa es estado global: la configuración del usuario (moneda local, moneda vista, mes/año seleccionado, objetivo de ahorro). Vive en un `SettingsContext` de React. Toda la app lo consume mediante un hook `useSettings()`.

Todo lo demás (lista de gastos, cartera, etc.) se gestiona con TanStack Query, no con estado global. La cache de TanStack Query *es* el estado.

---

## 5. Estructura del repositorio

```
finanzas-app/
├── src-tauri/                  # Configuración Tauri (Rust, lo tocas casi nunca)
│   ├── src/main.rs             # Entry point Rust (vacío salvo plugins)
│   ├── tauri.conf.json         # Config: nombre app, icono, ventanas, permisos
│   └── Cargo.toml              # Dependencias Rust
│
├── src/
│   ├── app/                    # Rutas (Next.js App Router)
│   │   ├── layout.tsx          # Layout raíz: sidebar, providers globales
│   │   ├── page.tsx            # Redirige a /dashboard
│   │   ├── dashboard/page.tsx
│   │   ├── gastos/page.tsx
│   │   ├── ingresos/page.tsx
│   │   ├── cuentas/page.tsx
│   │   ├── inversiones/page.tsx
│   │   ├── metas/page.tsx
│   │   ├── hipoteca/page.tsx
│   │   ├── deudas/page.tsx
│   │   ├── proyeccion/page.tsx
│   │   ├── evolucion/page.tsx
│   │   ├── categorias/page.tsx
│   │   ├── monedas/page.tsx
│   │   └── settings/page.tsx
│   │
│   ├── components/
│   │   ├── ui/                 # shadcn/ui: button, input, dialog, table…
│   │   ├── layout/             # Sidebar, Topbar, PageHeader…
│   │   ├── charts/             # Wrappers Recharts: CategoryChart, EvolutionChart…
│   │   ├── forms/              # AddExpenseForm, AddIncomeForm, MortgageForm…
│   │   └── widgets/            # KPICard, ProgressBar, CurrencyPicker…
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts       # Esquema Drizzle (single source of truth)
│   │   │   ├── client.ts       # Cliente DB (Fase A: Tauri SQL; Fase C: WASM)
│   │   │   └── seed.ts         # Carga inicial: monedas, categorías por defecto
│   │   ├── repositories/
│   │   │   ├── expense-repository.ts
│   │   │   ├── income-repository.ts
│   │   │   ├── account-repository.ts
│   │   │   ├── investment-repository.ts
│   │   │   ├── goal-repository.ts
│   │   │   ├── mortgage-repository.ts
│   │   │   ├── debt-repository.ts
│   │   │   ├── category-repository.ts
│   │   │   ├── currency-repository.ts
│   │   │   └── settings-repository.ts
│   │   ├── domain/
│   │   │   ├── currency.ts     # convert(amount, from, to)
│   │   │   ├── mortgage.ts     # PMT, amortization table
│   │   │   ├── projection.ts   # patrimonio futuro
│   │   │   ├── aggregation.ts  # sumByMonth, sumByCategory
│   │   │   └── goals.ts        # progreso, ahorro mensual necesario
│   │   ├── schemas/            # Zod schemas
│   │   └── utils/              # date helpers, formatters
│   │
│   ├── hooks/                  # Hooks personalizados
│   │   ├── useSettings.ts
│   │   ├── useExpenses.ts
│   │   ├── useDashboard.ts
│   │   └── …
│   │
│   └── contexts/
│       └── SettingsContext.tsx
│
├── drizzle/                    # Migraciones SQL generadas (versionadas)
├── public/                     # Iconos, assets estáticos
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── drizzle.config.ts
└── next.config.js
```

---

## 6. Esquema de base de datos

Ver `schema.sql` adjunto. Resumen:

| Tabla | Filas esperadas | Propósito |
|---|---|---|
| `settings` | 1 (singleton) | Config global del usuario |
| `currencies` | ~13 | Catálogo de monedas y tipos de cambio |
| `categories` | ~12-20 | Categorías de gasto con presupuesto |
| `accounts` | ~5-15 | Cuentas bancarias, broker, efectivo |
| `expenses` | crece sin tope | Movimientos de gasto |
| `monthly_incomes` | 12 por año | Salario/bonus por mes |
| `extra_incomes` | pocos por año | Premios, bonus puntuales |
| `investments` | ~5-50 | Cartera (acciones, ETFs, fondos) |
| `goals` | ~3-10 | Metas de ahorro |
| `mortgage` | 0 o 1 | Hipoteca activa (Fase futura: histórico) |
| `other_debts` | ~0-5 | Préstamos consumo, tarjetas |
| `sync_log` | crece, se purga | (Fase C) cola de operaciones por sincronizar |

**No son tablas, son cálculos:**
- Dashboard
- Tabla de amortización (se computa desde `mortgage`)
- Evolución mensual (se computa desde `expenses` + `monthly_incomes` + `extra_incomes`)
- Proyección de patrimonio (se computa desde varios)

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

## 8. Roadmap detallado de fases

### Fase 1 — Fundación (Fase A, semanas 1-2)

- [ ] Setup repositorio Next.js + Tauri + Tailwind + shadcn
- [ ] Setup Drizzle + SQLite + primera migración
- [ ] SettingsContext + página de configuración funcional
- [ ] Seed de monedas y categorías por defecto
- [ ] Layout principal (sidebar, navegación)
- [ ] CI básica (lint + typecheck)

### Fase 2 — Datos maestros

- [ ] CRUD de Cuentas
- [ ] CRUD de Categorías
- [ ] CRUD de Monedas (con tipo de cambio editable)
- [ ] Importación inicial (manual a través de UI)

### Fase 3 — Movimientos

- [ ] CRUD de Gastos con filtros (mes, año, categoría, cuenta, búsqueda por concepto)
- [ ] Atajo de teclado para añadir gasto rápido (estilo Ctrl+Shift+G de macro)
- [ ] CRUD de Ingresos mensuales (tabla 12 meses)
- [ ] CRUD de Ingresos puntuales

### Fase 4 — Patrimonio

- [ ] CRUD de Inversiones con P/L automático
- [ ] CRUD de Metas con barra de progreso y ahorro mensual necesario

### Fase 5 — Deuda

- [ ] Hipoteca: formulario simulador + cálculo de cuota
- [ ] Tabla de amortización (vista calculada)
- [ ] Comparativa plazos/tipos
- [ ] CRUD de otras deudas con PMT

### Fase 6 — Vistas calculadas

- [ ] Dashboard completo con KPIs y gráficos
- [ ] Página de Evolución con tabla anual y gráfico
- [ ] Página de Proyección con simulador

### Fase 7 — Refinamiento

- [ ] Export/Import JSON (backup completo)
- [ ] Modo oscuro
- [ ] Atajos de teclado globales
- [ ] Búsqueda global
- [ ] Tests de la capa de dominio

### Fase 8 — Salto a PWA (Fase C)

- [ ] Reemplazo del cliente SQLite (Tauri → WASM con sql.js o wa-sqlite)
- [ ] Service Worker + manifest para PWA
- [ ] Backend de sync (Turso + endpoints)
- [ ] Autenticación (e.g. magic links por email)
- [ ] Implementación `SyncedExpenseRepository` y resto de repos
- [ ] UI de estado de sincronización
- [ ] Resolución de conflictos last-write-wins
- [ ] Despliegue (Vercel para la web, Turso para la BD)

---

## 9. Decisiones pendientes (a tomar conforme avancemos)

| Tema | Pregunta | Cuándo decidir |
|---|---|---|
| Autenticación Fase C | ¿Magic links / Google / contraseña? | Antes de Fase 8 |
| Actualización de tipos de cambio | ¿API automática o manual? | Antes de Fase 7 |
| Precios de inversiones | ¿API (Yahoo, Alpha Vantage) o manual? | Antes de Fase 4 |
| Backup en Fase A | ¿Sync con Dropbox/iCloud del fichero .db? | Antes de Fase 7 |
| Más de una hipoteca | ¿La estructura admite refinanciaciones? | Si surge la necesidad |
| Idioma | ¿Solo español o multi-idioma? | Antes de Fase 8 |

---

## 10. Anti-objetivos (lo que NO hacemos)

- **No** soportamos multi-usuario en la misma instalación.
- **No** hay sistema de permisos (siempre eres tú).
- **No** hay reportes fiscales / declaración de impuestos.
- **No** hay integración bancaria automática (open banking) en Fase A. Es candidato a Fase C pero no compromiso.
- **No** hay app móvil nativa. Móvil = PWA en Fase C.

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
