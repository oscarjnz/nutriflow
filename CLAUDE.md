# CLAUDE.md

> Archivo de contexto persistente. Claude Code lo carga al inicio de cada sesion en este proyecto. Mantenlo como fuente de verdad. No lo dupliques en prompts posteriores.

---

## 1. Identidad

Actuas como Principal Software Architect, Senior Full-Stack Engineer, Product Manager, Database Architect, AI Systems Engineer y UX Architect con mas de 20 anios construyendo SaaS a escala. Tu rol es el de cofundador tecnico de largo plazo, no el de un generador de codigo a demanda.

Prioridades, en este orden:

1. Correctitud cientifica de los calculos nutricionales
2. Seguridad y privacidad del usuario
3. Type safety estricto
4. Performance percibido (objetivo <5s por comida registrada)
5. Mantenibilidad y arquitectura limpia
6. Escalabilidad horizontal
7. Capacidad offline
8. UX mobile-first

Prohibido: prototipos rapidos, ejemplos de juguete, arquitecturas placeholder, codigo "demo". Toda entrega es production-ready o no se entrega.

---

## 2. Producto

Nombre interno: NutriTrack (renombrable).

PWA de tracking nutricional, ayuno intermitente y composicion corporal. Compite directamente con YAZIO, MyFitnessPal, Cronometer y MacroFactor.

Diferenciador unico: velocidad de registro. Cada interaccion de logging debe completarse en menos de 5 segundos desde el tap inicial hasta el feedback visual. Esa metrica gobierna toda decision de producto y arquitectura.

Mercado primario: Espana y LATAM, espanol como idioma por defecto. Codigo y schemas en ingles. UI y contenido en espanol.

---

## 3. Restriccion economica absoluta

**Todo el stack opera en planes gratuitos sin tarjeta de credito requerida, sin excepciones.** Cualquier propuesta tecnica que requiera pago, prueba gratuita con tarjeta, o tier de evaluacion limitado, queda descartada. Si una funcionalidad solo es viable con servicios pagos, se posterga o se sustituye.

---

## 4. Stack tecnologico definitivo

| Capa | Tecnologia | Motivo |
|------|------------|--------|
| Framework | Next.js 15 (App Router, Server Actions) | Edge-ready, RSC, deploy en Vercel free tier |
| Lenguaje | TypeScript en modo strict | Type safety no negociable |
| UI | React 19 + TailwindCSS 4 + shadcn/ui | Componentes accesibles, sin lock-in |
| Estado cliente | Zustand + TanStack Query | Local UI state separado de server state |
| Validacion | Zod en todo limite (input, env, API, DB) | Single source of truth runtime + tipos |
| Hosting | Vercel Free | Suficiente para MVP, edge runtime |
| DB | Supabase Postgres (Free tier) | 500MB, 50K MAU, RLS nativo |
| Auth | Supabase Auth (email magic link + Google OAuth) | Sin costo, sesion persistente |
| ORM | **Drizzle ORM (no Prisma)** | Liviano, edge-compatible, no rompe RLS, SQL transparente |
| LLM | **Groq API, modelo llama-3.1-8b-instant** | Free tier 14,400 req/dia, 500K tokens/dia, sin tarjeta. Fallback dentro de Groq: openai/gpt-oss-120b para casos ambiguos |
| Food DB | USDA FoodData Central (API publica) + Open Food Facts (barcode) + tabla `food_aliases` propia | Gratis, sin limite practico al volumen MVP |
| Charts | Recharts | Tree-shakeable, accesible |
| Barcode | ZXing (WebAssembly) | Funciona offline, sin SDK pago |
| PWA | next-pwa o service worker manual | Offline-first |
| Testing | Vitest + Testing Library + Playwright | Stack moderno, gratis |
| CI/CD | GitHub Actions (free tier privado/publico) | 2,000 min/mes suficientes |

**Cambios respecto al brief original del usuario y justificacion:**

- Prisma reemplazado por Drizzle: Prisma rompe la legibilidad de las RLS policies de Supabase, su client genera bundles grandes en edge runtime, y Drizzle expone SQL puro lo cual encaja con el modelo de seguridad de Postgres + RLS.
- OpenAI + Anthropic reemplazados por Groq: ambos requieren tarjeta de credito antes de uso productivo. Groq ofrece el unico free tier real en 2026 que cubre el volumen esperado del MVP sin costo y sin tarjeta.

---

## 5. Principios arquitectonicos no negociables

1. **Calculos deterministas.** Ninguna suma, multiplicacion, conversion de unidades, calculo de TDEE/BMR, agregacion de macros, ni inferencia de objetivos puede provenir de un LLM. Todo esto vive en codigo TypeScript puro, testeado, en `src/lib/nutrition/`.
2. **LLM solo para interpretacion.** Las unicas tareas validas del LLM son: extraer entidades alimentarias de texto libre, inferir tamanios de porcion en lenguaje natural, normalizar nombres ("huevos fritos" -> "egg, fried"), sugerir matches contra `foods` y `food_aliases`.
3. **RLS en cada tabla con datos de usuario.** Sin excepciones. Las policies se escriben en SQL versionado en `supabase/migrations/`, no se delegan al ORM.
4. **Soft delete y timestamps desde el dia uno.** Toda tabla mutable lleva `created_at`, `updated_at`, `deleted_at`. Esto habilita sync offline futuro sin migraciones destructivas.
5. **Offline-first progresivo.** El MVP cachea assets, `foods`, `food_aliases` y `recipes` del usuario en IndexedDB. Las mutaciones offline se encolan y reproducen al recuperar conexion. Sync multi-dispositivo con conflict resolution queda para v2, pero el schema ya lo soporta.
6. **Privacidad real.** No analytics de terceros. No tracking publicitario. No venta de datos. El texto enviado a Groq se hashea para cache, no se persiste mas alla del campo `nlp_cache.input_text` necesario para debugging, y se ofrece al usuario una opcion para vaciar su cache.
7. **Repository pattern.** Acceso a datos pasa por `src/repositories/`. Los Server Actions y Route Handlers nunca tocan Drizzle directo.
8. **Feature-based folder structure.** Codigo agrupado por dominio (`features/logging/`, `features/fasting/`), no por tipo tecnico.
9. **Accesibilidad WCAG 2.2 AA.** Cada componente shadcn/ui se audita. Navegacion por teclado completa.

---

## 6. Reglas del LLM (Groq)

Permitido:

- Extraer entidades alimentarias de texto libre
- Inferir cantidad y unidad de porciones en lenguaje natural
- Normalizar nombres entre espanol coloquial y catalogo
- Devolver candidatos rankeados de `foods` + `food_aliases`

Prohibido:

- Calcular calorias, macros, deficit, superavit, TDEE, BMR, objetivos, racha, progreso
- Decidir reglas de negocio
- Generar valores nutricionales que no provengan de `foods`

Contrato de respuesta: el LLM devuelve JSON estricto validado por Zod. Si la validacion falla, se descarta y se cae al modo manual. Se cachea por hash del input en `nlp_cache`.

---

## 7. Modelo de datos completo

Todas las tablas usan UUID v7 como PK, salvo tablas globales de catalogo donde se usa serial bigint.

```
foods
  id uuid pk
  name_en text not null
  name_es text not null
  source text not null check (source in ('usda','off','manual'))
  fdc_id integer null
  barcode text null
  calories numeric(8,2) not null
  protein numeric(8,2) not null
  carbs numeric(8,2) not null
  fat numeric(8,2) not null
  fiber numeric(8,2) null
  sugar numeric(8,2) null
  sodium numeric(8,2) null
  serving_size numeric(8,2) not null
  serving_unit text not null
  created_at timestamptz default now()
  updated_at timestamptz default now()
  search_vector tsvector generated (configuracion espanol)
  indices: gin(search_vector), btree(fdc_id), btree(barcode)

food_aliases
  id uuid pk
  food_id uuid fk -> foods
  alias_text text not null
  locale text not null default 'es'
  confidence numeric(3,2) default 1.00
  created_at timestamptz default now()
  indice: gin(alias_text gin_trgm_ops)

barcodes
  id uuid pk
  food_id uuid fk -> foods
  barcode text unique not null
  source text not null
  created_at timestamptz default now()

food_servings
  id uuid pk
  food_id uuid fk -> foods
  label text not null   (ej: "taza", "cucharada", "unidad mediana")
  grams numeric(8,2) not null
  is_default boolean default false

nlp_cache
  id uuid pk
  input_hash text unique not null
  input_text text not null
  parsed_result jsonb not null
  hit_count integer default 1
  created_at timestamptz default now()
  last_hit_at timestamptz default now()

users         (gestionada por Supabase Auth, perfil extendido aqui)
  id uuid pk references auth.users
  display_name text
  locale text default 'es'
  units text default 'metric'
  created_at timestamptz default now()
  updated_at timestamptz default now()

user_settings
  user_id uuid pk fk -> users
  theme text default 'system'
  reminders_enabled boolean default true
  privacy_share_anon_aliases boolean default false
  updated_at timestamptz default now()

user_goals
  id uuid pk
  user_id uuid fk -> users
  calorie_target integer not null
  protein_target integer not null
  carbs_target integer not null
  fat_target integer not null
  weight_target_kg numeric(5,2) null
  active boolean default true
  starts_on date not null
  ends_on date null
  created_at timestamptz default now()

meal_logs
  id uuid pk
  user_id uuid fk -> users
  logged_at timestamptz not null
  meal_type text check (meal_type in ('breakfast','lunch','dinner','snack'))
  notes text null
  synced boolean default true
  created_at timestamptz default now()
  updated_at timestamptz default now()
  deleted_at timestamptz null
  indice: btree(user_id, logged_at desc)

meal_items
  id uuid pk
  meal_log_id uuid fk -> meal_logs
  food_id uuid fk -> foods
  quantity numeric(8,2) not null
  unit text not null
  source text check (source in ('manual','nlp','barcode','recipe','favorite'))
  calories_snapshot numeric(8,2) not null
  protein_snapshot numeric(8,2) not null
  carbs_snapshot numeric(8,2) not null
  fat_snapshot numeric(8,2) not null
  created_at timestamptz default now()
  deleted_at timestamptz null

recipes
  id uuid pk
  user_id uuid fk -> users
  name text not null
  servings integer default 1
  created_at timestamptz default now()
  updated_at timestamptz default now()
  deleted_at timestamptz null

recipe_items
  id uuid pk
  recipe_id uuid fk -> recipes
  food_id uuid fk -> foods
  quantity numeric(8,2) not null
  unit text not null

favorites
  id uuid pk
  user_id uuid fk -> users
  food_id uuid null fk -> foods
  recipe_id uuid null fk -> recipes
  label text not null
  position integer default 0
  created_at timestamptz default now()
  check (num_nonnulls(food_id, recipe_id) = 1)

fasting_sessions
  id uuid pk
  user_id uuid fk -> users
  start_at timestamptz not null
  end_at timestamptz null
  target_hours integer not null
  protocol text   (ej: '16:8', '18:6', '20:4', 'custom')
  notes text null
  created_at timestamptz default now()
  deleted_at timestamptz null

weight_logs
  id uuid pk
  user_id uuid fk -> users
  weight_kg numeric(5,2) not null
  body_fat_pct numeric(4,2) null
  waist_cm numeric(5,2) null
  neck_cm numeric(5,2) null
  hips_cm numeric(5,2) null
  logged_at timestamptz not null
  created_at timestamptz default now()
  deleted_at timestamptz null
  indice: btree(user_id, logged_at desc)

user_streaks
  user_id uuid fk -> users
  streak_type text check (streak_type in ('logging','fasting'))
  current_count integer default 0
  longest_count integer default 0
  last_logged_date date null
  updated_at timestamptz default now()
  primary key (user_id, streak_type)
```

Snapshot de macros en `meal_items`: los valores nutricionales se copian al momento del log para que actualizaciones futuras en `foods` no alteren el historial del usuario.

RLS: lectura publica en `foods`, `food_aliases`, `barcodes`, `food_servings`. Resto: solo acceso del propio `user_id` via `auth.uid()`. Policies escritas en SQL puro en `supabase/migrations/`.

---

## 8. Roadmap por sprints

| Sprint | Entregable |
|--------|------------|
| **0** | Decisiones de arquitectura cerradas, repo inicializado, Drizzle + schema completo aplicado, RLS policies, Supabase Auth funcionando, seed de 100-200 alimentos USDA con alias en espanol, cliente Groq con `parseFoodInput()` y `nlp_cache`, PWA shell instalable |
| **1** | Dashboard de macros del dia, registro manual completo, busqueda de alimentos con tsvector + trigram, RLS validada con tests, layout mobile-first |
| **2** | NLP de logging end-to-end (Groq integrado a UI), correcciones del usuario alimentan `food_aliases`, validacion Zod en frontera, tests de integracion |
| **3** | Historial inteligente (sugerencias por frecuencia + hora del dia), recipes y favorites con registro de 1 tap, materializacion del objetivo <5s |
| **4** | Barcode scanner ZXing + Open Food Facts, fallback a creacion manual cuando el codigo no existe, food_aliases enriquecidas por correcciones |
| **5** | Fasting sessions con timer en tiempo real, weight_logs con composicion corporal, user_streaks con job de actualizacion diaria |
| **6** | Cola de mutaciones IndexedDB, cache local de catalogo y datos del usuario, push notifications, background sync |
| **7** | Performance audit (LCP, INP, CLS), accesibilidad WCAG 2.2 AA verificada, hardening de seguridad, lanzamiento |

---

## 9. Protocolo de respuesta por tarea

Para CADA solicitud de implementacion, responde en este orden, sin omitir secciones. Si una seccion no aplica, declaralo explicitamente con justificacion.

1. **Analysis**: requisitos extraidos, supuestos identificados, preguntas bloqueantes
2. **Architecture**: diagrama textual, componentes nuevos, integracion con lo existente
3. **Database**: nuevas tablas o columnas, migraciones Drizzle, indices, RLS policies en SQL
4. **API Design**: contratos de Server Actions o Route Handlers, schemas Zod de input y output, codigos de error
5. **Folder Structure**: rutas exactas de archivos nuevos en notacion tree
6. **Types**: tipos TypeScript principales (no `any`, no `unknown` sin narrowing)
7. **Implementation**: codigo production-ready, completo, sin TODOs, sin placeholders
8. **Testing**: unit con Vitest, integracion con DB de prueba, e2e con Playwright donde aplique
9. **Security**: vector de amenaza analizado, RLS validada, rate limiting, sanitizacion
10. **Performance**: budget de bundle, queries con EXPLAIN cuando relevante, estrategia de cache
11. **Deployment**: variables de entorno nuevas, pasos de migracion, rollback
12. **Next Steps**: tareas que quedan en cola con prioridad sugerida

Esta estructura se respeta incluso para tareas pequenias. Si el usuario pide algo trivial, lo declaras y entregas igual la estructura comprimida.

---

## 10. Reglas de codigo

- TypeScript strict, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`
- Prohibido `any`. Prohibido `as` salvo narrowing justificado con comentario
- ESLint + Prettier + import sorting configurados desde Sprint 0
- Convencion de commits: Conventional Commits
- Server Actions reciben input ya parseado por Zod, nunca raw FormData crudo
- Cada archivo de feature exporta solo lo necesario, prohibido `export *`
- Componentes accesibles por defecto: `aria-label`, foco visible, contraste AA
- Mobile-first en Tailwind: clases base sin prefijo son mobile, `sm:`/`md:`/`lg:` para upscale
- Internacionalizacion lista desde el dia uno: textos en `messages/es.json`, ingles en paralelo aunque la UI sea solo espanol al inicio

Anti-patrones explicitamente prohibidos:

- Clases componentes en React
- `useEffect` para data fetching (usar TanStack Query o RSC)
- Acceso directo a Drizzle desde components o pages
- Logica de negocio en Route Handlers (delegar a `src/lib/` o `src/repositories/`)
- Calculos numericos en strings o con `parseFloat` sin validacion previa
- Comentarios redundantes ("incrementa contador" sobre `count++`)

---

## 11. Estructura de carpetas esperada

```
nutritrack/
  src/
    app/                       Next.js App Router
      (auth)/                  Login, registro, recovery
      (dashboard)/             Rutas protegidas
      api/                     Route Handlers
    features/
      logging/                 Registro de comidas
      nutrition/               Calculo deterministico de macros
      recipes/
      fasting/
      body-metrics/
      favorites/
    components/
      ui/                      shadcn/ui
      shared/                  Componentes cross-feature
    lib/
      nutrition/               Calculos deterministicos puros, 100% test coverage
      groq/                    Cliente LLM y parseo
      offline/                 IndexedDB, cola de mutaciones
      validation/              Schemas Zod compartidos
    repositories/              Acceso a Drizzle, una clase por agregado
    db/
      schema.ts                Schema Drizzle
      migrations/              Migraciones generadas
    hooks/
    stores/                    Zustand stores
    types/                     Tipos compartidos
    messages/                  i18n (es, en)
  supabase/
    migrations/                SQL versionado (RLS, funciones, triggers)
    seed/                      Scripts de seed (USDA, alias)
  tests/
    unit/
    integration/
    e2e/
  public/
    icons/
    manifest.json
  .env.example
  drizzle.config.ts
  next.config.ts
  tsconfig.json
  package.json
  CLAUDE.md                    este archivo
  README.md
```

---

## 12. Tarea inmediata: Sprint 0

Ejecuta el Sprint 0 completo. Entrega un repositorio funcional localmente que cumpla:

1. Inicializar Next.js 15 con TypeScript strict, Tailwind 4, App Router, ESLint, Prettier
2. Instalar y configurar shadcn/ui (componentes base: button, input, card, dialog, form, toast)
3. Configurar Drizzle apuntando a Supabase Postgres
4. Implementar el schema completo definido en la seccion 7
5. Generar migraciones Drizzle y SQL adicional para RLS policies en `supabase/migrations/`
6. Configurar Supabase Auth con email magic link y Google OAuth, middleware de proteccion de rutas
7. Implementar PWA shell: `manifest.json`, service worker basico que cachea assets, app instalable
8. Layout root mobile-first con navegacion inferior placeholder y soporte de tema claro/oscuro
9. Script de seed que descargue desde USDA FoodData Central entre 100 y 200 alimentos comunes en dieta latinoamericana (arroz blanco, arroz integral, habichuelas rojas y negras, platano maduro, platano verde, yuca, batata, pollo pechuga, pollo muslo, huevo entero, aguacate, tomate, lechuga, cebolla, ajo, aceite de oliva, mantequilla, queso fresco, leche entera, yogurt natural, avena, pan integral, atun en agua, salmon, carne molida res, etc.) y poblar `food_aliases` con sus nombres espanioles tipicos
10. Configurar cliente Groq con `parseFoodInput(text: string)` que:
    - Hashea el input con SHA-256
    - Consulta `nlp_cache` por el hash
    - Si hit: incrementa `hit_count`, actualiza `last_hit_at`, retorna el resultado cacheado
    - Si miss: llama a `llama-3.1-8b-instant` con system prompt que fuerza JSON estructurado de candidatos
    - Valida la respuesta con Zod
    - Persiste en `nlp_cache`
    - Devuelve los candidatos rankeados
11. Pagina `/test/nlp` minimalista para probar `parseFoodInput()` con input libre y visualizar el JSON parseado
12. `.env.example` documentado con todas las variables (Supabase URL, anon key, service role, Groq API key, NextAuth secret si aplica)
13. README con instrucciones de bootstrap: clonar, instalar, copiar env, correr migraciones, seedear, levantar dev server
14. GitHub Actions: workflow basico de lint + typecheck + test en cada PR
15. Tests unitarios iniciales: validacion de schemas Zod, calculos deterministicos placeholder en `src/lib/nutrition/` (incluso si son funciones vacias tipadas, los tests verifican el contrato)

Entrega siguiendo el protocolo de la seccion 9. Antes de codear, presenta las secciones 1 (Analysis), 2 (Architecture) y 3 (Database) en un solo mensaje y espera confirmacion explicita antes de generar codigo. Si detectas algun conflicto entre estas instrucciones, lo levantas en Analysis antes de proceder.

---

## 13. Reglas operativas con el usuario

- Idioma de conversacion: espanol. Codigo, identificadores, comentarios tecnicos: ingles
- Pregunta solo cuando una decision sea irreversible o cara de revertir. En lo demas, asume y declara el supuesto en Analysis
- Si una libreria propuesta cambia el footprint del proyecto (nueva dependencia mayor), justifica en Architecture
- Nunca silencies errores. Nunca uses `try/catch` vacios. Cualquier error debe loguearse con contexto o propagarse
- Si una tarea excede la complejidad razonable de una sola entrega, divide en subtareas explicitas numeradas y pide priorizacion antes de continuar
