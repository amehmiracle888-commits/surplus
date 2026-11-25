-- Migration 0006: Enforce strictly 1 user / 1 device across all products,
-- clarify SHARED LOGIN DETAILS on shared-tier VPNs, and update Terms disclaimer.

-- 1) Enforce device_limit = 1 across all products that specify device_limit or belong to VPN category
UPDATE public.products
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{device_limit}', '1'::jsonb, true)
WHERE category_id IN (SELECT id FROM public.product_categories WHERE slug = 'vpn')
   OR (metadata ? 'device_limit');

-- 2) Remove multi-device marketing text from ExpressVPN and Surfshark descriptions
UPDATE public.products
SET
  short_description = 'High-speed ExpressVPN private login across 94 countries with split tunneling — strictly 1 user (1 device).',
  description = 'Genuine ExpressVPN 1-month private login for streaming, gaming, and encrypted browsing across 94 countries. Licensed strictly for 1 user (1 device).'
WHERE slug = 'expressvpn-1-month';

UPDATE public.products
SET
  short_description = 'CleanWeb ad blocker, 3,200+ servers, and Camouflage mode — strictly 1 user (1 device) for ₦3,500 / week.',
  description = 'Surfshark VPN weekly subscription with CleanWeb ad/malware blocking, MultiHop, and Camouflage mode. Licensed strictly for 1 user (1 device).'
WHERE slug = 'surfshark-vpn-1-week';

-- 3) Explicitly mark shared-login VPN products in metadata, descriptions, and option labels
UPDATE public.products
SET
  metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{shared_login}', 'true'::jsonb, true),
  short_description = 'Military-grade encryption, 6,000+ servers, Threat Protection. SHARED LOGIN DETAILS (₦5,000) or Semi-Private/Personal (₦8,500) — strictly 1 user (1 device).',
  description = 'Genuine NordVPN subscription payable in Nigerian Naira (₦). Available as SHARED LOGIN DETAILS (shared account allocation — strictly 1 user / 1 device per purchase; do not change password) or Semi-Private / Personal Login.',
  options_schema = '[{"key":"plan_tier","label":"Account Tier","type":"select","required":true,"options":[{"label":"Shared Login Details (Strictly 1 User / 1 Device)","value":"shared","price_delta_kobo":0},{"label":"Semi-Private / Personal Login (1 User / 1 Device)","value":"personal","price_delta_kobo":350000}]}]'::jsonb
WHERE slug = 'nordvpn-subscription';

UPDATE public.products
SET
  metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{shared_login}', 'true'::jsonb, true),
  short_description = 'Privacy-focused Proton VPN with SHARED LOGIN DETAILS (₦5,000) or Semi-Private Login (₦8,500) — strictly 1 user (1 device).',
  description = 'Swiss privacy-focused Proton VPN subscription available in SHARED LOGIN DETAILS (shared account — strictly 1 user / 1 device per purchase; do not change password) or Semi-Private access tiers.',
  options_schema = '[{"key":"plan_tier","label":"Account Tier","type":"select","required":true,"options":[{"label":"Shared Login Details (Strictly 1 User / 1 Device)","value":"shared","price_delta_kobo":0},{"label":"Semi-Private Login (1 User / 1 Device)","value":"semi_private","price_delta_kobo":350000}]}]'::jsonb
WHERE slug = 'proton-vpn-monthly';

UPDATE public.products
SET
  metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{shared_login}', 'true'::jsonb, true),
  short_description = 'Planet VPN access with SHARED LOGIN DETAILS (₦5,000) or Semi-Private Login (₦8,500) — strictly 1 user (1 device).',
  description = 'Planet VPN subscription for encrypted remote browsing in SHARED LOGIN DETAILS (shared account — strictly 1 user / 1 device per purchase; do not change password) or Semi-Private tiers.',
  options_schema = '[{"key":"plan_tier","label":"Account Tier","type":"select","required":true,"options":[{"label":"Shared Login Details (Strictly 1 User / 1 Device)","value":"shared","price_delta_kobo":0},{"label":"Semi-Private Login (1 User / 1 Device)","value":"semi_private","price_delta_kobo":350000}]}]'::jsonb
WHERE slug = 'planet-vpn-monthly';

-- 4) Update policies.terms with Research & Legitimate Use Disclaimer
UPDATE public.website_settings
SET value = jsonb_set(
  value,
  '{terms}',
  to_jsonb(
    E'1. Authorized Research & Legitimate Use Only: All VPN subscriptions, proxy services, and virtual numbers provisioned on this platform are supplied strictly for lawful privacy protection, academic study, software QA testing, geo-verification, cybersecurity research with proper authorization, and legitimate business or personal workflows.\n\n2. Strictly 1 User / 1 Device Policy: Unless explicitly licensed otherwise in a written enterprise agreement, every product order grants access strictly to 1 user (1 concurrent device). Sharing purchased credentials outside your allocated session or connecting multiple concurrent devices may result in automatic suspension without refund.\n\n3. Shared Login Account Rules: Products clearly marked with SHARED LOGIN DETAILS provide managed shared credentials. Buyers must not change passwords, linked email addresses, recovery methods, subscription settings, or 2FA controls on shared accounts.\n\n4. Prohibited Conduct & Customer Responsibility: Customers are solely responsible for ensuring their usage complies with all applicable local and international laws as well as third-party platform terms. Fraud, unauthorized network intrusion, spamming, credential stuffing, abuse, or illegal activity is strictly prohibited and will lead to immediate termination and potential reporting where required by law.'::text
  )
)
WHERE key = 'policies';
