-- ─────────────────────────────────────────────────────────────────────────────
-- 0003 — nlp_cache
--
-- Caches LLM-extracted entities by SHA-256(input). The (input_hash, model)
-- unique constraint invalidates the cache automatically when the model name
-- changes — switching from llama-3.1-8b-instant to a successor model never
-- serves stale parses.
--
-- last_hit_at is indexed to support a future LRU eviction job (not in Sprint 0).
-- Access is restricted to service_role in 0008_rls.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.nlp_cache (
  id              uuid primary key,
  input_hash      text not null,
  input_text      text not null,
  model           text not null,
  parsed_result   jsonb not null,
  hit_count       integer not null default 1 check (hit_count > 0),
  created_at      timestamptz not null default now(),
  last_hit_at     timestamptz not null default now(),
  unique (input_hash, model)
);

create index nlp_cache_last_hit_idx on public.nlp_cache (last_hit_at);
