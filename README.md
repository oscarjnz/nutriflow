# NutriFlow

PWA de tracking nutricional, ayuno intermitente y composicion corporal. Mercado primario Espana y LATAM. North-Star: registrar una comida en menos de 5 segundos.

Stack: Next.js 15 · React 19 · TypeScript strict · TailwindCSS 4 · Drizzle ORM · Supabase Postgres · **Clerk (auth)** · Groq (LLM) · Serwist (PWA).

> Este README cubre **Sprint 0 completo (Lotes 1-3)**: schema + RLS, auth con Clerk, NLP de logging con Groq, catalogo sembrado desde USDA + Open Food Facts, tests y CI.

---

## Estado actual

| Capa | Estado |
|------|--------|
| Configuracion (TS strict, ESLint, Prettier, Tailwind 4) | listo |
| Validacion de env vars con Zod (server + client) | listo |
| Schema Drizzle + tipos | listo |
| Migraciones SQL (catalogo, NLP cache, perfil, comidas, recetas, ayuno, peso, streaks) | listo |
| RLS policies para cada tabla | listo |
| Cliente DB con contexto RLS (opcion A1) | listo |
| **Auth con Clerk** (sign-in / sign-up / UserButton) | listo |
| Middleware de proteccion de rutas (clerkMiddleware) | listo |
| Mapeo Clerk → perfil interno (UUID) con creacion idempotente | listo |
| Bottom nav + theming claro/oscuro/sistema | listo |
| shadcn/ui base (button con press feedback, input, card, dialog, form, sonner) | listo |
| PWA (Serwist + manifest + icons) | listo |
| **Lib de nutricion determinista** (units + macros, 100% test) | listo |
| **Cliente Groq + `parseFoodInput()`** con cache + fallback | listo |
| **Repositorios** (foods tsvector+trigram, nlp-cache, meal-logs) | listo |
| **Seed USDA + Open Food Facts** (47 alimentos + alias + barcodes) | listo |
| **Pagina `/test/nlp`** | listo |
| Tests Vitest (38) + skeleton Playwright | listo |
| GitHub Actions CI (lint + typecheck + test) | listo |

---

## Prerrequisitos

- **Node.js 22.x** (`.nvmrc` lo fija).
- **pnpm 9+** (`npm install -g pnpm`).
- Cuenta gratuita en **[Supabase](https://supabase.com)** — solo para Postgres (no para auth).
- Cuenta gratuita en **[Clerk](https://dashboard.clerk.com)** — autenticacion (10k MAU free, sin tarjeta).
- Cuenta gratuita en **[Groq](https://console.groq.com)** — LLM para el NLP de logging.
- API key gratuita de **[USDA FoodData Central](https://fdc.nal.usda.gov/api-key-signup.html)** — solo para sembrar el catalogo.

> **Por que Clerk y no Supabase Auth:** el SMTP de pruebas de Supabase limita a ~2-3 correos/hora, insuficiente incluso para uso domestico. Clerk free cubre el caso sin friccion.

---

## Bootstrap

```bash
# 1. Instalar dependencias
pnpm install

# 2. Crear el archivo de entorno y rellenar las variables
cp .env.example .env.local
# Edita .env.local con tus valores reales (ver tabla abajo)

# 3. Aplicar migraciones a tu proyecto Supabase
pnpm db:migrate          # 10 migraciones

# 4. Sembrar el catalogo de alimentos (USDA + Open Food Facts)
pnpm db:seed             # ~47 alimentos con alias en espanol y barcodes

# 5. Levantar el dev server
pnpm dev                 # http://localhost:3000 → redirige a /sign-in
```

### Variables de entorno

| Variable | De donde la sacas |
|----------|-------------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | dashboard.clerk.com → API Keys (`pk_test_…`) |
| `CLERK_SECRET_KEY` | dashboard.clerk.com → API Keys (`sk_test_…`, secreto) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (secreto) |
| `DATABASE_URL_DIRECT` | Supabase → Database → Connection string (session pooler, puerto 5432) |
| `DATABASE_URL_POOLER` | Supabase → Database → Connection string (transaction pooler, puerto 6543) |
| `GROQ_API_KEY` | console.groq.com → API Keys |
| `GROQ_MODEL_PRIMARY` | `llama-3.1-8b-instant` |
| `GROQ_MODEL_FALLBACK` | `openai/gpt-oss-120b` |
| `FDC_API_KEY` | fdc.nal.usda.gov/api-key-signup.html (solo para `pnpm db:seed`) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (local) o tu URL de Vercel |

---

## Despliegue en Vercel

1. Importa el repo en Vercel. Framework: Next.js (autodetectado).
2. **Settings → Environment Variables**: copia TODAS las variables de la tabla anterior (las mismas claves `pk_test_`/`sk_test_` de desarrollo funcionan en cualquier dominio, incluido `*.vercel.app`).
3. Deploy. El build corre lint + typecheck + build; las migraciones y el seed se ejecutan desde tu maquina contra la misma DB (no en el build de Vercel).

> **Instancia de produccion de Clerk:** no la crees hasta tener un dominio propio. Requiere registros DNS que `*.vercel.app` no permite. Hasta entonces usa las claves de desarrollo.

---

## Configuracion de Clerk (una sola vez)

1. Crea una aplicacion en [dashboard.clerk.com](https://dashboard.clerk.com).
2. Habilita los metodos de inicio que quieras (email + contrasena, magic link, Google, etc.) en **User & Authentication**.
3. Copia `Publishable key` y `Secret key` a `.env.local` y a Vercel.

No hay que configurar redirect URLs manualmente: las rutas `/sign-in` y `/sign-up` viven en la app (catch-all de Clerk) y el middleware protege el resto.

---

## NLP de logging (Groq)

`parseFoodInput(text)` ([src/lib/groq/parse-food-input.ts](src/lib/groq/parse-food-input.ts)) convierte texto libre en candidatos del catalogo:

1. Normaliza y hashea el input (SHA-256).
2. Busca en `nlp_cache` por `(hash, modelo)`. Hit → reusa la extraccion; miss → llama a Groq.
3. Groq (primario, luego fallback) extrae **solo** entidades: nombre, cantidad, unidad, terminos de busqueda. Validado con Zod; si falla, se descarta.
4. El ranking de candidatos contra `foods` + `food_aliases` es **codigo determinista** (tsvector + trigram), nunca el LLM.
5. Los macros se calculan en `src/lib/nutrition/` a partir de los datos del catalogo, jamas del modelo.

Pruebalo en **`/test/nlp`** (requiere sesion): escribe «dos huevos fritos y una taza de arroz blanco» y veras la extraccion + candidatos rankeados con su score.

---

## Catalogo de alimentos

El seed ([scripts/seed-foods.ts](scripts/seed-foods.ts)) usa dos fuentes (CLAUDE.md §4):

- **USDA FoodData Central** — nutricion por 100 g de alimentos enteros (arroz, pollo, huevo, aguacate…).
- **Open Food Facts** — productos empaquetados por codigo de barras (Nutella, Coca-Cola, Oreo…).

Resuelve cada item, escribe un snapshot reproducible en `supabase/seed/catalog-snapshot.json`, e inserta de forma idempotente (IDs UUIDv5 deterministas por clave). Re-ejecutar es seguro:

```bash
pnpm db:seed             # reusa el snapshot si existe
pnpm db:seed --refresh   # vuelve a consultar las APIs
```

Para agregar alimentos, edita [scripts/seed-data.ts](scripts/seed-data.ts) y re-corre el seed.

---

## Scripts disponibles

| Script | Descripcion |
|--------|-------------|
| `pnpm dev` | Servidor de desarrollo. |
| `pnpm build` | Build de produccion. |
| `pnpm lint` / `pnpm lint:fix` | ESLint. |
| `pnpm format` / `pnpm format:check` | Prettier. |
| `pnpm typecheck` | `tsc --noEmit` strict. |
| `pnpm test` / `pnpm test:watch` | Vitest (unit). |
| `pnpm test:e2e` | Playwright (instala navegadores con `pnpm exec playwright install chromium`). |
| `pnpm db:migrate` | Aplica migraciones SQL pendientes. Idempotente. |
| `pnpm db:seed` | Siembra el catalogo (USDA + Open Food Facts). |
| `pnpm db:studio` | Drizzle Studio. |

---

## Arquitectura

### Identidad: Clerk + perfil interno

Clerk es la fuente de identidad. Cada usuario de Clerk (`user_xxx`) se mapea a una fila en `public.users` con un **UUID v7 interno** (`users.id`) y la columna `clerk_id`. En el primer login, [src/lib/auth/get-user.ts](src/lib/auth/get-user.ts) crea el perfil + settings de forma idempotente (`onConflictDoNothing` sobre `clerk_id` para sobrevivir la carrera de requests concurrentes del primer render).

El UUID interno es lo que viaja como `sub` a `withUserContext`, asi que `auth.uid()` en las policies RLS sigue resolviendo correctamente — el modelo de seguridad no cambia respecto al diseno original.

### Modelo dual de acceso a Postgres

[`src/db/client.ts`](src/db/client.ts):

- **`adminDb`** — conexion directa (5432), bypassea RLS. Migraciones, seed, catalogo, `nlp_cache`.
- **`withUserContext(userId, fn)`** — pooler (6543), rol `authenticated`, `auth.uid()` resuelve al usuario. Defensa en profundidad.
- **`withAnonContext(fn)`** — pooler, rol `anon`. Lecturas publicas del catalogo.

`userId` SOLO proviene del UUID interno derivado de la sesion de Clerk, nunca de input del cliente.

### Migraciones

SQL es la unica fuente de verdad en `supabase/migrations/*.sql`. El runner ([scripts/migrate.ts](scripts/migrate.ts)) lleva su propia tabla `_migrations`.

---

## Estructura del proyecto (Lote 3)

```
nutriflow/
├── .github/workflows/ci.yml        Lint + typecheck + test en cada push/PR
├── scripts/
│   ├── migrate.ts                  Runner de migraciones
│   ├── seed-data.ts                Lista curada (USDA + OFF)
│   └── seed-foods.ts               Motor de seed (fetch → snapshot → upsert)
├── src/
│   ├── app/
│   │   ├── (auth)/sign-in|sign-up  Paginas Clerk catch-all
│   │   ├── (dashboard)/            Rutas protegidas + bottom nav
│   │   └── test/nlp/               Banco de pruebas de parseFoodInput
│   ├── lib/
│   │   ├── nutrition/              units.ts + macros.ts (deterministico, 100% test)
│   │   ├── groq/                   client.ts + prompt.ts + parse-food-input.ts
│   │   ├── crypto/                 uuid.ts + hash.ts
│   │   └── validation/             nlp.ts + meal.ts (Zod)
│   └── repositories/               foods · nlp-cache · meal-logs
├── supabase/
│   ├── migrations/                 0001–0010 (.sql)
│   └── seed/catalog-snapshot.json  Snapshot reproducible del seed
└── tests/
    ├── unit/                       Vitest (nutrition + validation)
    └── e2e/                        Playwright skeleton
```

---

## Convenciones

- Commits: [Conventional Commits](https://www.conventionalcommits.org/).
- Codigo, identificadores, comentarios: **ingles**. UI y copy: **espanol**.
- Tipos estrictos. `any` prohibido. `as` solo con comentario justificando el narrowing.
- Calculos numericos: siempre deterministas en `src/lib/nutrition/`, nunca en el LLM.

Mas detalles en [`CLAUDE.md`](CLAUDE.md).
