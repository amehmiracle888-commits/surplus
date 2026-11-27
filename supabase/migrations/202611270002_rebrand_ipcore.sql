-- Migration 202611270002: Rebrand platform settings to IPcore

UPDATE public.website_settings
SET value = jsonb_set(
  jsonb_set(value, '{brandName}', '"IPcore"'::jsonb, true),
  '{tagline}',
  '"Proxy, VPN & Digital Access Infrastructure"'::jsonb,
  true
)
WHERE key = 'branding';

UPDATE public.website_settings
SET value = jsonb_set(value, '{fromName}', '"IPcore"'::jsonb, true)
WHERE key = 'email_config';
