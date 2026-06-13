# Migraciones

Hay **dos formas equivalentes** de aplicar una migración. Usa la que prefieras — el resultado es el mismo.

## Opción A — Pegar en Supabase (estilo S.H.S, sin terminal)

1. Abre [Supabase → SQL Editor](https://supabase.com/dashboard/project/_/sql).
2. Abre el archivo `.sql` de esta carpeta, copia **todo** su contenido.
3. Pégalo y dale **Run**.

Los archivos son SQL puro y autosuficiente (sin comandos de `psql`, sin variables del runner), así que funcionan tal cual en el editor.

## Opción B — Runner (lo corro yo)

```
pnpm db:migrate
```

Aplica solo las migraciones pendientes y las registra en la tabla `_migrations`. Idempotente. **Oscar no necesita correr esto** — lo ejecuto yo cuando hace falta.

> Si pegas manualmente (Opción A) y luego se corre el runner (Opción B), el runner intentará re-aplicar esa migración. Por eso **toda migración nueva debe ser idempotente** (ver convención abajo), así pegar y correr son intercambiables sin romper nada.

---

## Convención: migraciones idempotentes

Toda migración nueva se escribe de forma que correrla dos veces no falle. Esto permite pegar en Supabase O usar el runner, sin conflictos.

| En vez de | Usa |
|-----------|-----|
| `create table foo (...)` | `create table if not exists foo (...)` |
| `create index ...` | `create index if not exists ...` |
| `alter table foo add column bar ...` | `alter table foo add column if not exists bar ...` |
| `create function ...` | `create or replace function ...` |
| `drop ... ` | `drop ... if exists` |
| `create policy ...` | `drop policy if exists ...;` seguido de `create policy ...` |
| `insert into ... ` (seed) | `insert ... on conflict do nothing` |

Las migraciones `0001`–`0010` ya aplicadas no se reescriben (el historial es inmutable); la convención aplica de `0011` en adelante.

## Orden

Los archivos se aplican en orden alfabético del nombre: `YYYYMMDD_NNNN_descripcion.sql`. Mantén el prefijo numérico para que el orden sea inequívoco.
