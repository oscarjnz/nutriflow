# NutriFlow

PWA de tracking nutricional, ayuno intermitente y composicion corporal. Mercado primario Espana y LATAM. North-Star: registrar una comida en menos de 5 segundos.

Stack: Next.js 15 · React 19 · TypeScript strict · TailwindCSS 4 · Drizzle ORM · Supabase (Postgres + Auth) · Groq (LLM) · Serwist (PWA).

> Este README cubre los **Lotes 1 y 2 del Sprint 0**. El Lote 3 (NLP + Nutrition + Seed + Tests + CI) ampliara este documento.

---

## Estado actual

| Capa | Estado |
|------|--------|
| Configuracion (TS strict, ESLint, Prettier, Tailwind 4) | listo |
| Validacion de env vars con Zod | listo |
| Schema Drizzle + tipos | listo |
| Migraciones SQL (catalogo, NLP cache, perfil, comidas, recetas, ayuno, peso, streaks) | listo |
| RLS policies para cada tabla | listo |
| Cliente DB con contexto RLS (opcion A1) | listo |
| Runner de migraciones idempotente | listo |
| Layout root mobile-first | listo |
| Supabase Auth (magic link + Google OAuth) | listo |
| Middleware de proteccion de rutas | listo |
| Bottom nav + theming claro/oscuro/sistema | listo |
| shadcn/ui base (button, input, card, dialog, form, sonner) | listo |
| PWA (Serwist + manifest + icons) | listo |
| Cliente Groq + `parseFoodInput()` | proximo lote |
| Seed USDA + alias en espanol | proximo lote |

---

## Prerrequisitos

- **Node.js 22.x** (`.nvmrc` lo fija). Si usas `nvm` o `fnm`, `nvm install` / `fnm use` lo lee automaticamente.
- **pnpm 9+**. Si no lo tienes: `npm install -g pnpm`.
- Una cuenta gratuita en **[Supabase](https://supabase.com)** (no requiere tarjeta).
- Una cuenta gratuita en **[Groq](https://console.groq.com)** (no requiere tarjeta). Necesaria a partir del Lote 3.
- Una API key gratuita de **[USDA FoodData Central](https://fdc.nal.usda.gov/api-key-signup.html)**. Necesaria a partir del Lote 3 (seed).

---

## Bootstrap

```bash
# 1. Instalar dependencias
pnpm install

# 2. Crear el archivo de entorno y rellenar las variables marcadas como requeridas
cp .env.example .env.local
# Edita .env.local con tus valores reales
```

### Variables que debes rellenar antes de migrar

| Variable | De donde la sacas |
|----------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard Supabase → Project Settings → API → Project API keys → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard Supabase → Project Settings → API → Project API keys → `service_role` (secreto) |
| `DATABASE_URL_DIRECT` | Dashboard Supabase → Project Settings → Database → Connection string → URI (direct, puerto 5432) |
| `DATABASE_URL_POOLER` | Dashboard Supabase → Project Settings → Database → Connection string → URI (transaction pooler, puerto 6543) |
| `GROQ_API_KEY` | console.groq.com → API Keys (se puede dejar en blanco hasta el Lote 3) |
| `FDC_API_KEY` | fdc.nal.usda.gov/api-key-signup.html (se puede dejar en blanco hasta el Lote 3) |

```bash
# 3. Aplicar las migraciones a tu proyecto Supabase
pnpm db:migrate
# Deberias ver 8 migraciones aplicadas (extensiones, catalogo, nlp_cache,
# perfil, comidas, recetas, body+ayuno, RLS).

# 4. Levantar el dev server
pnpm dev
# Abre http://localhost:3000
```

---

## Configuracion de auth (una sola vez)

### Magic link (correo)

Funciona out-of-the-box. Supabase envia el correo desde su SMTP gratuito de pruebas (3 correos/hora). Para produccion configura tu propio SMTP en Supabase → Authentication → Settings → SMTP Settings.

**Importante**: en Supabase → Authentication → URL Configuration:

- `Site URL`: `http://localhost:3000` (en local) o tu URL de Vercel en prod.
- `Redirect URLs`: agrega `http://localhost:3000/auth/callback` y, cuando deploys, `https://<tu-dominio>/auth/callback`.

Sin esto el enlace del correo rebota.

### Google OAuth

1. Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.
2. **Authorized redirect URIs**: `https://drvijhxhthadzitvnitz.supabase.co/auth/v1/callback` (lo lees en Supabase → Authentication → Providers → Google).
3. Copia el `Client ID` y `Client Secret` al panel de Supabase → Authentication → Providers → Google → enable + paste + save.
4. En Supabase → Authentication → URL Configuration agrega `http://localhost:3000/auth/callback` a Redirect URLs (mismo paso que magic link).

Hasta que termines esto, el boton "Continuar con Google" mostrara un error de Supabase. El magic link sigue funcionando independientemente.

---

## Verificacion del Lote 1

Despues de `pnpm db:migrate`, en el SQL Editor de Supabase:

```sql
-- Cuenta tablas creadas (esperado: 16 + _migrations = 17)
select count(*) from information_schema.tables
 where table_schema = 'public';

-- Verifica que RLS este activa en todas las tablas de usuario
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
 order by tablename;

-- Lista las policies (esperado: ~45 entre catalogo y user-owned)
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;
```

`pnpm typecheck` y `pnpm lint` deben pasar sin errores.

## Verificacion del Lote 2

1. `pnpm dev` → http://localhost:3000.
2. Sin sesion: el middleware te redirige a `/login`.
3. Ingresa tu correo, recibe el enlace, haz clic. Vuelve a `/` autenticado.
4. En la BD: `select * from public.users;` y `select * from public.user_settings;` deben tener una fila tuya (creadas por el trigger `handle_new_auth_user`).
5. Navega entre `/`, `/log`, `/fasting`, `/profile` con la bottom nav. El boton central (verde) lleva a `/log`.
6. En `/profile` cambia el tema con el icono superior derecho — debe ciclar system → light → dark.
7. En `/profile` pulsa "Cerrar sesion" y verifica que vuelves a `/login`.
8. Lighthouse → Application → Manifest debe mostrar NutriFlow como installable. En Chrome desktop aparece el icono de instalacion en la barra de URL.

---

## Scripts disponibles

| Script | Descripcion |
|--------|-------------|
| `pnpm dev` | Servidor de desarrollo Next.js. |
| `pnpm build` | Build de produccion. |
| `pnpm start` | Sirve el build de produccion. |
| `pnpm lint` / `pnpm lint:fix` | ESLint. |
| `pnpm format` / `pnpm format:check` | Prettier. |
| `pnpm typecheck` | `tsc --noEmit` con la config strict del proyecto. |
| `pnpm test` | Vitest (configurado en Lote 3). |
| `pnpm db:migrate` | Aplica las migraciones SQL pendientes contra `DATABASE_URL_DIRECT`. Idempotente. |
| `pnpm db:studio` | Drizzle Studio (UI para inspeccionar la DB en `localhost:4983`). |
| `pnpm db:seed` | Seed USDA (disponible desde el Lote 3). |

---

## Arquitectura

### Modelo dual de acceso a Postgres

El modulo [`src/db/client.ts`](src/db/client.ts) expone tres formas de hablar con Postgres:

- **`adminDb`** — conexion directa (puerto 5432), bypassea RLS. Reservada para migraciones, seed, mutaciones al catalogo y operaciones sobre `nlp_cache` (que es service_role-only). Nunca usar para datos de usuario.
- **`withUserContext(userId, fn)`** — abre una transaccion contra el pooler (puerto 6543), inyecta `request.jwt.claims.sub` y cambia el rol a `authenticated`. Dentro del callback, `auth.uid()` resuelve al usuario y RLS filtra naturalmente. Defensa en profundidad: aunque un repositorio olvide el `where user_id = $1`, las policies bloquean filas ajenas.
- **`withAnonContext(fn)`** — pooler con rol `anon`. Para lecturas publicas del catalogo sin sesion.

`userId` SOLO debe provenir de `supabase.auth.getUser()` (sesion verificada), nunca de input del cliente.

### Migraciones

SQL es la unica fuente de verdad. Las DDL de tablas, indices, generated columns, triggers, funciones y RLS viven en `supabase/migrations/*.sql` con timestamp prefijado.

- `drizzle-kit generate` NO esta en el workflow — se reemplaza por SQL escrito a mano.
- `drizzle-kit studio` SI se usa para introspeccion.
- El runner ([`scripts/migrate.ts`](scripts/migrate.ts)) lleva su propia tabla `_migrations` y aplica los archivos pendientes en orden.

### Variables de entorno

- `src/env.server.ts` — server-only, parseado por Zod, crashea el proceso si falta algo.
- `src/env.client.ts` — solo `NEXT_PUBLIC_*`, safe en cualquier componente.

Importar `env.server.ts` desde un Client Component es un error de compilacion (chequeo `typeof window`).

---

## Estructura del proyecto

```
nutriflow/
├── CLAUDE.md                      Contrato persistente del proyecto
├── README.md                      Este archivo
├── drizzle.config.ts              Config de drizzle-kit
├── eslint.config.mjs              ESLint flat config
├── next.config.ts
├── package.json
├── postcss.config.mjs             Tailwind 4 via PostCSS
├── tsconfig.json                  TS strict + paths "@/*"
├── .env.example
├── scripts/
│   └── migrate.ts                 Runner de migraciones SQL
├── src/
│   ├── app/                       App Router
│   │   ├── globals.css            Tailwind + tokens via @theme
│   │   ├── layout.tsx             Root layout mobile-first
│   │   └── page.tsx               Landing minimal
│   ├── db/
│   │   ├── client.ts              adminDb + withUserContext + withAnonContext
│   │   ├── schema.ts              Drizzle schema (todas las tablas)
│   │   └── types.ts               Inferred TS types
│   ├── env.client.ts
│   ├── env.server.ts
│   └── lib/
│       └── crypto/
│           └── uuid.ts            UUID v7
└── supabase/
    └── migrations/
        ├── 20260613_0001_extensions_and_functions.sql
        ├── 20260613_0002_catalog_tables.sql
        ├── 20260613_0003_nlp_cache.sql
        ├── 20260613_0004_user_tables.sql
        ├── 20260613_0005_meal_tables.sql
        ├── 20260613_0006_recipes_and_favorites.sql
        ├── 20260613_0007_body_and_fasting.sql
        └── 20260613_0008_rls.sql
```

---

## Troubleshooting

**`pnpm db:migrate` falla con `unaccent dictionary not found`.** Supabase ya tiene la extension `unaccent` instalada por defecto, pero requiere que el rol que aplica la migracion sea super. El runner usa `DATABASE_URL_DIRECT` que conecta como `postgres` (super). Si conectas con un rol restringido fallaria — usa la URL direct, no la pooler.

**`pnpm db:migrate` falla con `permission denied to create extension`.** La connection string del pooler (transaction mode) no permite DDL en una unica conexion. Asegurate de que `DATABASE_URL_DIRECT` apunte a `db.<project>.supabase.co:5432` y no al pooler.

**`tsx scripts/migrate.ts` no encuentra `.env.local`.** El runner usa `dotenv` y busca el archivo en la raiz del repo. Verifica que `.env.local` exista alli (no en `~/.env` ni en subdirectorios).

**Las variables `DATABASE_URL_*` aparecen como `undefined` al correr `db:studio`.** `drizzle-kit` no lee `.env.local` automaticamente — el config invoca `dotenv` explicitamente, pero si lanzas drizzle-kit desde otra carpeta no encuentra el archivo. Lanzalo desde la raiz del repo.

---

## Convenciones

- Commits: [Conventional Commits](https://www.conventionalcommits.org/). Ejemplo: `feat(db): add user_streaks table`.
- Codigo, identificadores, comentarios tecnicos: **ingles**. UI, copy, mensajes al usuario: **espanol**.
- Tipos estrictos. `any` prohibido. `as` solo con comentario justificando el narrowing.
- Mobile-first en Tailwind: clases base sin prefijo son mobile; `sm:`/`md:`/`lg:` para escalar.

Mas detalles en [`CLAUDE.md`](CLAUDE.md).
