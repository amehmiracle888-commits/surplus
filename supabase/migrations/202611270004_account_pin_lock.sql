-- Migration 202611270004: 4-Digit Account Passcode (Quick Lock) on profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS pin_updated_at TIMESTAMPTZ;

-- Never allow anon or authenticated clients to directly read or mutate pin_hash via Supabase PostgREST
REVOKE SELECT (pin_hash) ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (pin_hash, pin_updated_at) ON public.profiles FROM anon, authenticated;
