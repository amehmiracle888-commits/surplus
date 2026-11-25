-- Migration 0005: Import ProxiesVault VPN catalog (NordVPN, ExpressVPN, Surfshark, PIA, CyberGhost, HMA, Proton, Planet, Avast, Windscribe, PureVPN, IPVanish, TunnelBear, Seed4Me, Browsec, Hotspot Shield, VLESS) + additional proxy providers (IPRocket, Loki, 711) and verified images.

WITH vpn_cat AS (
  SELECT id FROM public.product_categories WHERE slug = 'vpn' LIMIT 1
),
proxy_cat AS (
  SELECT id FROM public.product_categories WHERE slug = 'proxy' LIMIT 1
)
INSERT INTO public.products (
  category_id, slug, name, provider, short_description, description,
  image_url, terms_and_conditions, setup_instructions,
  billing_cycle, duration_days, retail_price_kobo, wholesale_cost_kobo, renewal_price_kobo,
  delivery_method, availability_status, is_active, is_featured, is_popular, metadata, options_schema
)
VALUES
  (
    (SELECT id FROM vpn_cat),
    'nordvpn-subscription',
    'NordVPN',
    'NordVPN',
    'Military-grade encryption, 6,000+ servers, Threat Protection. Shared Login (₦5,000) or Semi-Private/Personal (₦8,500).',
    'Genuine NordVPN subscription payable in Nigerian Naira (₦). Choose Shared Login (split with 3-6 users) or Semi-Private / Personal Login for dedicated access.',
    'https://proxiesvault.com.ng/nordvpn-logo.png',
    'Legitimate NordVPN subscription. Delivered to My VPNs and email after payment confirmation.',
    '1. Open My VPNs in your dashboard.\n2. Copy your NordVPN credentials.\n3. Download the official NordVPN app and sign in.',
    'monthly', 30, 500000, 0, 500000,
    'manual', 'in_stock', true, true, true,
    '{"device_limit":6,"server_locations":["60+ Countries (6,000+ Servers)"],"credential_type":"account","renewable":true}'::jsonb,
    '[{"key":"plan_tier","label":"Account Tier","type":"select","required":true,"options":[{"label":"Shared Login (3-6 Users)","value":"shared","price_delta_kobo":0},{"label":"Semi-Private / Personal Login","value":"personal","price_delta_kobo":350000}]}]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'expressvpn-1-month',
    'ExpressVPN — 1 Month Private Login',
    'ExpressVPN',
    'High-speed ExpressVPN private login across 94 countries with split tunneling and 5 simultaneous devices.',
    'Genuine ExpressVPN 1-month private login for streaming, gaming, and encrypted browsing across 94 countries.',
    'https://proxiesvault.com.ng/expressvpn-logo.png',
    'Legitimate ExpressVPN subscription. Delivered after verified payment.',
    '1. Open My VPNs in your dashboard.\n2. Copy your ExpressVPN activation/login details.\n3. Sign in via the official ExpressVPN app.',
    'monthly', 30, 850000, 0, 850000,
    'manual', 'in_stock', true, true, true,
    '{"device_limit":5,"server_locations":["94 Countries"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'surfshark-vpn-1-week',
    'Surfshark VPN — 1 Week',
    'Surfshark',
    'Unlimited devices, CleanWeb ad blocker, 3,200+ servers, and Camouflage mode for ₦3,500 / week.',
    'Surfshark VPN weekly subscription with CleanWeb ad/malware blocking, MultiHop, and Camouflage mode.',
    'https://proxiesvault.com.ng/surfshark-logo.png',
    'Legitimate Surfshark subscription. Delivered after verified payment.',
    '1. Open My VPNs in your dashboard.\n2. Sign in to the Surfshark app using your delivered credentials.',
    'weekly', 7, 350000, 0, 350000,
    'manual', 'in_stock', true, true, true,
    '{"device_limit":10,"server_locations":["100+ Countries (3,200+ Servers)"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'pia-vpn-1-month',
    'PIA VPN (Private Internet Access) — 1 Month',
    'PIA VPN',
    'Open-source, audited VPN with 35,000+ servers across 91 countries and MACE ad blocker.',
    'Private Internet Access (PIA) monthly subscription offering audited privacy, MACE ad blocking, and 35,000+ global servers.',
    'https://proxiesvault.com.ng/pia-logo.png',
    'Legitimate PIA VPN subscription. Delivered after verified payment.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on the official PIA client.',
    'monthly', 30, 500000, 0, 500000,
    'manual', 'in_stock', true, false, true,
    '{"device_limit":10,"server_locations":["91 Countries (35,000+ Servers)"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'cyberghost-vpn-monthly',
    'CyberGhost VPN — Monthly Plan',
    'CyberGhost',
    '9,700+ global servers, NoSpy servers, and dedicated streaming endpoints.',
    'CyberGhost VPN monthly subscription featuring dedicated streaming servers and strong encryption across 9,700+ servers.',
    'https://proxiesvault.com.ng/cyberghost-logo.png',
    'Legitimate CyberGhost subscription. Delivered after verified payment.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on the CyberGhost app.',
    'monthly', 30, 520000, 0, 520000,
    'manual', 'in_stock', true, false, true,
    '{"device_limit":7,"server_locations":["100 Countries (9,700+ Servers)"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'hma-vpn-monthly',
    'HMA VPN — Monthly Plan',
    'HMA VPN',
    'Fast, reliable VPN with servers in 190+ countries and automated IP shuffle.',
    'HMA (HideMyAss) VPN monthly subscription with 1,100+ servers across 190+ countries and IP shuffle.',
    'https://proxiesvault.com.ng/hma-logo.png',
    'Legitimate HMA VPN subscription. Delivered after verified payment.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on the HMA VPN client.',
    'monthly', 30, 550000, 0, 550000,
    'manual', 'in_stock', true, false, false,
    '{"device_limit":5,"server_locations":["190+ Countries"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'proton-vpn-monthly',
    'Proton VPN',
    'Proton VPN',
    'Privacy-focused Proton VPN with Shared Login (₦5,000) or Semi-Private Login (₦8,500).',
    'Swiss privacy-focused Proton VPN subscription available in Shared or Semi-Private access tiers.',
    'https://www.google.com/s2/favicons?domain=protonvpn.com&sz=128',
    'Legitimate Proton VPN subscription. Delivered after verified payment.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on the Proton VPN app.',
    'monthly', 30, 500000, 0, 500000,
    'manual', 'in_stock', true, false, true,
    '{"device_limit":5,"server_locations":["Global Network"],"credential_type":"account","renewable":true}'::jsonb,
    '[{"key":"plan_tier","label":"Account Tier","type":"select","required":true,"options":[{"label":"Shared Login (3-6 Users)","value":"shared","price_delta_kobo":0},{"label":"Semi-Private Login","value":"semi_private","price_delta_kobo":350000}]}]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'planet-vpn-monthly',
    'Planet VPN',
    'Planet VPN',
    'Planet VPN access in Shared Login (₦5,000) or Semi-Private Login (₦8,500) options.',
    'Planet VPN subscription for encrypted remote browsing in Shared or Semi-Private tiers.',
    '',
    'Legitimate Planet VPN subscription. Delivered after verified payment.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on the Planet VPN app.',
    'monthly', 30, 500000, 0, 500000,
    'manual', 'in_stock', true, false, false,
    '{"device_limit":5,"server_locations":["Global Network"],"credential_type":"account","renewable":true}'::jsonb,
    '[{"key":"plan_tier","label":"Account Tier","type":"select","required":true,"options":[{"label":"Shared Login (3-6 Users)","value":"shared","price_delta_kobo":0},{"label":"Semi-Private Login","value":"semi_private","price_delta_kobo":350000}]}]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'avast-secureline-vpn-1-month',
    'Avast SecureLine VPN — 1 Month',
    'Avast',
    'Bank-grade encryption, no-log browsing, and global server locations for 1 device.',
    'Avast SecureLine VPN 1-month subscription keeping your connection private and encrypted across global locations.',
    'https://www.google.com/s2/favicons?domain=avast.com&sz=128',
    'Legitimate Avast SecureLine VPN subscription.',
    '1. Open My VPNs in your dashboard.\n2. Activate or sign in inside Avast SecureLine VPN.',
    'monthly', 30, 650000, 0, 650000,
    'manual', 'in_stock', true, false, false,
    '{"device_limit":1,"server_locations":["Global Network"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'windscribe-vpn-monthly',
    'Windscribe VPN — 1 Month',
    'Windscribe',
    'Fast, secure browsing with strong encryption and built-in R.O.B.E.R.T. ad/tracker blocker.',
    'Windscribe VPN monthly subscription delivering encrypted browsing and tracker blocking.',
    'https://www.google.com/s2/favicons?domain=windscribe.com&sz=128',
    'Legitimate Windscribe VPN subscription.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on Windscribe.',
    'monthly', 30, 600000, 0, 600000,
    'manual', 'in_stock', true, false, false,
    '{"device_limit":1,"server_locations":["60+ Countries"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'purevpn-monthly',
    'PureVPN — 1 Month',
    'PureVPN',
    'Fast speeds, strong security, and massive global server network for streaming and privacy.',
    'PureVPN monthly subscription built for streaming, gaming, and everyday privacy.',
    'https://www.google.com/s2/favicons?domain=purevpn.com&sz=128',
    'Legitimate PureVPN subscription.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on PureVPN.',
    'monthly', 30, 500000, 0, 500000,
    'manual', 'in_stock', true, false, false,
    '{"device_limit":1,"server_locations":["70+ Countries"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'ipvanish-monthly',
    'IPVanish — 1 Month',
    'IPVanish',
    'High-speed, no-log VPN protection built for privacy, speed, and reliability.',
    'IPVanish monthly subscription offering fast no-log VPN encryption across global servers.',
    'https://www.google.com/s2/favicons?domain=ipvanish.com&sz=128',
    'Legitimate IPVanish subscription.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on IPVanish.',
    'monthly', 30, 500000, 0, 500000,
    'manual', 'in_stock', true, false, false,
    '{"device_limit":1,"server_locations":["75+ Locations"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'tunnelbear-vpn-monthly',
    'TunnelBear VPN — 1 Month',
    'TunnelBear',
    'Simple, beginner-friendly VPN protection with solid encryption across multiple countries.',
    'TunnelBear VPN monthly subscription for everyday privacy and unblocking content.',
    'https://icons.duckduckgo.com/ip3/tunnelbear.com.ico',
    'Legitimate TunnelBear subscription.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on TunnelBear.',
    'monthly', 30, 500000, 0, 500000,
    'manual', 'in_stock', true, false, false,
    '{"device_limit":1,"server_locations":["45+ Countries"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'seed4me-vpn-3-months',
    'Seed4Me VPN — 3 Months',
    'Seed4Me',
    'Private browsing across multiple countries with a 3-month subscription.',
    'Seed4Me VPN 3-month subscription providing secure encrypted access across international servers.',
    'https://www.google.com/s2/favicons?domain=seed4.me&sz=128',
    'Legitimate Seed4Me subscription.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on Seed4Me.',
    'quarterly', 90, 650000, 0, 650000,
    'manual', 'in_stock', true, false, false,
    '{"device_limit":1,"server_locations":["30+ Countries"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'browsec-vpn-3-months',
    'Browsec VPN — 3 Months',
    'Browsec',
    'Fast, reliable VPN protection with easy browser/app setup for 3 months.',
    'Browsec VPN 3-month subscription for encrypted browsing and quick location switching.',
    'https://www.google.com/s2/favicons?domain=browsec.com&sz=128',
    'Legitimate Browsec subscription.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on Browsec.',
    'quarterly', 90, 670000, 0, 670000,
    'manual', 'in_stock', true, false, false,
    '{"device_limit":1,"server_locations":["40+ Locations"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'hotspot-shield-vpn-3-months',
    'Hotspot Shield VPN — 3 Months',
    'Hotspot Shield',
    'Fast encrypted browsing with military-grade security and global servers for 3 months.',
    'Hotspot Shield VPN 3-month subscription built for high-speed streaming and secure browsing.',
    'https://www.google.com/s2/favicons?domain=hotspotshield.com&sz=128',
    'Legitimate Hotspot Shield subscription.',
    '1. Open My VPNs in your dashboard.\n2. Sign in on Hotspot Shield.',
    'quarterly', 90, 750000, 0, 750000,
    'manual', 'in_stock', true, false, false,
    '{"device_limit":1,"server_locations":["80+ Countries"],"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM vpn_cat),
    'vless-premium-vpn',
    'VLESS Premium VPN',
    'VLESS',
    'High-performance VLESS VPN config delivery from ₦4,500 (7 days) up to 120 days.',
    'Copy-and-paste VLESS configuration for compatible V2Ray / Xray / Nekobox / Shadowrocket clients.',
    '',
    'Configuration delivered via My VPNs after payment confirmation.',
    '1. Open My VPNs in your dashboard.\n2. Copy your VLESS URI and import into your client.',
    'weekly', 7, 450000, 0, 450000,
    'manual', 'in_stock', true, false, false,
    '{"device_limit":1,"protocols":["VLESS"],"credential_type":"config_file","renewable":true}'::jsonb,
    '[{"key":"duration","label":"Duration","type":"select","required":true,"options":[{"label":"7 Days","value":"7d","price_delta_kobo":0},{"label":"30 Days","value":"30d","price_delta_kobo":750000},{"label":"60 Days","value":"60d","price_delta_kobo":1550000},{"label":"90 Days","value":"90d","price_delta_kobo":2400000},{"label":"120 Days","value":"120d","price_delta_kobo":3250000}]}]'::jsonb
  ),

  -- Additional Proxy Providers from ProxiesVault
  (
    (SELECT id FROM proxy_cat),
    'iprocket-proxy-2gb',
    'IPRocket Proxy — 2GB Premium Residential',
    'IPRocket',
    '2GB premium residential proxies backed by a pool of 90M+ global IPs.',
    'IPRocket Premium Residential Proxies designed for businesses, marketers, and developers backed by 90M+ residential IPs.',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSdIgb51zog1s766M80-tTgMatwkXhhurYmWQ&s',
    'Legitimate business, research, and privacy use only.',
    '1. Open My Proxies in your dashboard.\n2. Copy your IPRocket credentials.',
    'monthly', 30, 730000, 0, 730000,
    'manual', 'in_stock', true, false, true,
    '{"proxy_type":"residential","bandwidth_gb":2,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    'loki-proxy-monthly',
    'Loki Proxy — Residential & Datacenter IPs',
    'Loki Proxy',
    'High-speed Loki Proxy plans starting from ₦2,500 (5 IPs) with scalable IP options.',
    'Loki Proxy delivers fast residential and datacenter IPs built for automation, scraping, and multi-account management.',
    'https://www.lokiproxy.com/images/logo.svg',
    'Legitimate business, research, and privacy use only.',
    '1. Open My Proxies in your dashboard.\n2. Copy your Loki Proxy IP list.',
    'monthly', 30, 250000, 0, 250000,
    'manual', 'in_stock', true, false, false,
    '{"proxy_type":"residential","ip_count":5,"rotation_type":"static","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[{"key":"ip_tier","label":"IP Allocation","type":"select","required":true,"options":[{"label":"5 IPs (Monthly)","value":"5","price_delta_kobo":0},{"label":"10 IPs (Monthly)","value":"10","price_delta_kobo":140000},{"label":"25 IPs (Monthly)","value":"25","price_delta_kobo":490000},{"label":"50 IPs (Monthly)","value":"50","price_delta_kobo":950000},{"label":"100 IPs (Monthly)","value":"100","price_delta_kobo":1650000}]}]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    '711-proxy-monthly',
    '711 Proxy — Residential IPs & Bandwidth',
    '711 Proxy',
    '200+ country residential IP pool starting from ₦2,000 (5 IPs) or 1GB bandwidth.',
    '711 Proxy delivers residential IPs spanning 200+ countries with fixed IP-count plans and flexible 1GB bandwidth options.',
    'https://www.google.com/s2/favicons?domain=711proxy.com&sz=128',
    'Legitimate business, research, and privacy use only.',
    '1. Open My Proxies in your dashboard.\n2. Copy your 711 Proxy endpoints.',
    'monthly', 30, 200000, 0, 200000,
    'manual', 'in_stock', true, false, false,
    '{"proxy_type":"residential","ip_count":5,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[{"key":"plan_tier","label":"Plan Option","type":"select","required":true,"options":[{"label":"5 IPs (Monthly)","value":"5ip","price_delta_kobo":0},{"label":"10 IPs (Monthly)","value":"10ip","price_delta_kobo":150000},{"label":"25 IPs (Monthly)","value":"25ip","price_delta_kobo":370000},{"label":"50 IPs (Monthly)","value":"50ip","price_delta_kobo":750000},{"label":"1 GB Bandwidth","value":"1gb","price_delta_kobo":250000}]}]'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;

-- Attach verified images to previously imported Hide Proxy & Proxy001 rows if still empty
UPDATE public.products
SET image_url = 'https://proxyvault.com.ng/assets/images/product/6a65aa908ddd71785047696.jpeg'
WHERE slug IN ('hide-proxy-5-dedicated-ips', 'hide-proxy-10-dedicated-ips')
  AND COALESCE(image_url, '') = '';

UPDATE public.products
SET image_url = 'https://www.google.com/s2/favicons?domain=proxy001.com&sz=128'
WHERE slug IN ('proxy001-1gb', 'proxy001-2gb', 'proxy001-3gb')
  AND COALESCE(image_url, '') = '';
