-- Migration 0004: Representative ProxiesVault proxy catalog (matching exact Naira prices) + VPNClient (₦4,400)
-- Uses ON CONFLICT (slug) DO NOTHING so admin edits or deletions are never overwritten.

WITH proxy_cat AS (
  SELECT id FROM public.product_categories WHERE slug = 'proxy' LIMIT 1
),
vpn_cat AS (
  SELECT id FROM public.product_categories WHERE slug = 'vpn' LIMIT 1
)
INSERT INTO public.products (
  category_id, slug, name, provider, short_description, description,
  image_url, terms_and_conditions, setup_instructions,
  billing_cycle, duration_days, retail_price_kobo, wholesale_cost_kobo, renewal_price_kobo,
  delivery_method, availability_status, is_active, is_featured, is_popular, metadata, options_schema
)
VALUES
  -- Residential Proxies (ProxiesVault exact prices: ₦5,000 / ₦20,000 / ₦35,000 / ₦75,000)
  (
    (SELECT id FROM proxy_cat),
    'residential-proxy-starter-1gb',
    'Residential Proxy Starter — 1GB',
    'Residential Pool',
    '1GB rotating residential proxy bandwidth across 150+ countries with HTTP, HTTPS & SOCKS5 support.',
    'Real home-based residential IP addresses spanning 150+ countries. Designed for light web scraping, price checks, ad verification, and bypassing geo-restrictions.',
    '',
    'Intended strictly for legitimate business, research, and privacy use.',
    '1. Open My Proxies in your dashboard after delivery.\n2. Copy the host:port:username:password credentials.\n3. Configure HTTP, HTTPS, or SOCKS5 in your browser or client.',
    'monthly', 30, 500000, 0, 500000,
    'manual', 'in_stock', true, true, true,
    '{"proxy_type":"residential","bandwidth_gb":1,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"],"countries":["Nigeria","United States","United Kingdom","Canada","Germany","France"]}'::jsonb,
    '[{"key":"country","label":"Preferred Country","type":"select","required":true,"options":[{"label":"United States","value":"US"},{"label":"United Kingdom","value":"GB"},{"label":"Nigeria","value":"NG"},{"label":"Canada","value":"CA"},{"label":"Germany","value":"DE"}]}]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    'residential-proxy-growth-5gb',
    'Residential Proxy Growth — 5GB',
    'Residential Pool',
    '5GB residential proxy bandwidth across 150+ countries with sticky sessions and city-level targeting.',
    'Balanced 5GB residential proxy package supporting sticky sessions and city-level targeting across 150+ countries for regular scraping, automation, and multi-account workflows.',
    '',
    'Intended strictly for legitimate business, research, and privacy use.',
    '1. Open My Proxies in your dashboard.\n2. Select sticky or rotating endpoint format as provided.\n3. Copy your credentials into your browser or automation tool.',
    'monthly', 30, 2000000, 0, 2000000,
    'manual', 'in_stock', true, false, true,
    '{"proxy_type":"rotating_residential","bandwidth_gb":5,"rotation_type":"sticky","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"],"countries":["Nigeria","United States","United Kingdom","Canada","Germany","France"]}'::jsonb,
    '[{"key":"country","label":"Preferred Country","type":"select","required":true,"options":[{"label":"United States","value":"US"},{"label":"United Kingdom","value":"GB"},{"label":"Nigeria","value":"NG"},{"label":"Canada","value":"CA"},{"label":"Germany","value":"DE"}]}]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    'residential-proxy-pro-10gb',
    'Residential Proxy Pro — 10GB',
    'Residential Pool',
    '10GB residential bandwidth across 150+ countries with ISP proxy support and priority setup help.',
    'High-reliability 10GB residential proxy allocation across 150+ countries including ISP proxy routing for sustained scraping and business data collection.',
    '',
    'Intended strictly for legitimate business, research, and privacy use.',
    '1. Open My Proxies in your dashboard.\n2. Copy the HTTP/HTTPS/SOCKS5 endpoint string.\n3. Configure your target region.',
    'monthly', 30, 3500000, 0, 3500000,
    'manual', 'in_stock', true, false, false,
    '{"proxy_type":"isp","bandwidth_gb":10,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"],"countries":["Nigeria","United States","United Kingdom","Canada","Germany","France"]}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    'residential-proxy-enterprise-25gb',
    'Residential Proxy Enterprise — 25GB',
    'Residential Pool',
    '25GB high-volume residential proxy package across 150+ countries for large-scale workloads.',
    'Enterprise-scale 25GB residential proxy bandwidth across 150+ countries built for continuous data extraction, QA monitoring, and high-concurrency teams.',
    '',
    'Intended strictly for legitimate business, research, and privacy use.',
    '1. Open My Proxies in your dashboard.\n2. Copy credentials or export in URI/standard format.',
    'monthly', 30, 7500000, 0, 7500000,
    'manual', 'in_stock', true, false, false,
    '{"proxy_type":"residential","bandwidth_gb":25,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"],"countries":["Global (150+ Countries)"]}'::jsonb,
    '[]'::jsonb
  ),

  -- Hide Proxy Dedicated IPs (ProxiesVault exact prices: ₦2,500 / ₦3,800)
  (
    (SELECT id FROM proxy_cat),
    'hide-proxy-5-dedicated-ips',
    'Hide Proxy — 5 Dedicated IPs',
    'Hide Proxy',
    '5 dedicated non-rotating monthly IPs for stable multi-account management and everyday operations.',
    'Non-rotating dedicated IP package with 5 private IPs billed monthly. Built for consistent identity across multi-account management, e-commerce, and browser profiles.',
    '',
    'Dedicated non-rotating allocation; legitimate use only.',
    '1. Open My Proxies in your dashboard.\n2. Import each IP:Port:Username:Password entry into your browser profile.',
    'monthly', 30, 250000, 0, 250000,
    'manual', 'in_stock', true, true, true,
    '{"proxy_type":"static_residential","ip_count":5,"rotation_type":"static","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    'hide-proxy-10-dedicated-ips',
    'Hide Proxy — 10 Dedicated IPs',
    'Hide Proxy',
    '10 dedicated non-rotating monthly IPs for scaling multi-account workflows and automation.',
    'Monthly allocation of 10 dedicated non-rotating IPs providing stable endpoints for account management, e-commerce dashboards, and automation.',
    '',
    'Dedicated non-rotating allocation; legitimate use only.',
    '1. Open My Proxies in your dashboard.\n2. Export your 10-IP list in standard or URI format.',
    'monthly', 30, 380000, 0, 380000,
    'manual', 'in_stock', true, false, true,
    '{"proxy_type":"static_residential","ip_count":10,"rotation_type":"static","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[]'::jsonb
  ),

  -- Proxy001 (ProxiesVault exact prices: ₦4,000 / ₦7,800 / ₦11,600)
  (
    (SELECT id FROM proxy_cat),
    'proxy001-1gb',
    'Proxy001 — 1GB Residential Plan',
    'Proxy001',
    '1GB bandwidth on Proxy001 residential network covering 190+ countries with smart IP rotation.',
    'Entry-level 1GB residential proxy plan from Proxy001 offering access to 100M+ residential IPs across 190+ countries with smart rotation.',
    '',
    'Bandwidth-based residential allocation; legitimate use only.',
    '1. Open My Proxies in your dashboard.\n2. Use the Proxy001 credentials and endpoint port.',
    'monthly', 30, 400000, 0, 400000,
    'manual', 'in_stock', true, false, false,
    '{"proxy_type":"rotating_residential","bandwidth_gb":1,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"],"countries":["190+ Countries"]}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    'proxy001-2gb',
    'Proxy001 — 2GB Residential Plan',
    'Proxy001',
    '2GB bandwidth on Proxy001 residential network across 190+ countries with smart IP rotation.',
    'Balanced 2GB residential proxy package from Proxy001 for regular web scraping, verification, and automation across 190+ countries.',
    '',
    'Bandwidth-based residential allocation; legitimate use only.',
    '1. Open My Proxies in your dashboard.\n2. Copy the Proxy001 host, port, username, and password.',
    'monthly', 30, 780000, 0, 780000,
    'manual', 'in_stock', true, false, true,
    '{"proxy_type":"rotating_residential","bandwidth_gb":2,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"],"countries":["190+ Countries"]}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    'proxy001-3gb',
    'Proxy001 — 3GB Residential Plan',
    'Proxy001',
    '3GB bandwidth on Proxy001 residential network across 190+ countries with smart IP rotation.',
    '3GB residential data package from Proxy001 built for heavier research and multi-region data collection.',
    '',
    'Bandwidth-based residential allocation; legitimate use only.',
    '1. Open My Proxies in your dashboard.\n2. Copy credentials into your client.',
    'monthly', 30, 1160000, 0, 1160000,
    'manual', 'in_stock', true, false, false,
    '{"proxy_type":"rotating_residential","bandwidth_gb":3,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"],"countries":["190+ Countries"]}'::jsonb,
    '[]'::jsonb
  ),

  -- 9Proxy (ProxiesVault exact prices: ₦3,500 / ₦4,500, verified logo image)
  (
    (SELECT id FROM proxy_cat),
    '9proxy-10-rotating-ips',
    '9Proxy — 10 Rotating Residential IPs',
    '9Proxy',
    '10 rotating residential IPs from 9Proxy for scraping, automation, and multi-account management.',
    '9Proxy residential IP package delivering 10 clean rotating residential IPs suited for web automation, scraping, and multi-account workflows.',
    'https://proxiesvault.com.ng/9proxy-logo.png',
    'Legitimate business, research, and privacy use only.',
    '1. Open My Proxies in your dashboard.\n2. Download or sign in to the 9Proxy client using your delivered credentials.',
    'monthly', 30, 350000, 0, 350000,
    'manual', 'in_stock', true, true, true,
    '{"proxy_type":"rotating_residential","ip_count":10,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    '9proxy-static-ip-1gb',
    '9Proxy — Static Residential IP (1GB)',
    '9Proxy',
    'Fixed 9Proxy static residential IP billed with 1GB data for consistent session identity.',
    'Dedicated static residential IP from 9Proxy with 1GB data allocation so your outbound IP remains fixed for account management.',
    'https://proxiesvault.com.ng/9proxy-logo.png',
    'Legitimate business, research, and privacy use only.',
    '1. Open My Proxies in your dashboard.\n2. Connect using the delivered static IP endpoint.',
    'monthly', 30, 450000, 0, 450000,
    'manual', 'in_stock', true, false, false,
    '{"proxy_type":"static_residential","bandwidth_gb":1,"ip_count":1,"rotation_type":"static","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[]'::jsonb
  ),

  -- CliProxy (ProxiesVault exact prices: ₦3,500 / ₦7,000 / ₦12,000, verified logo image)
  (
    (SELECT id FROM proxy_cat),
    'cliproxy-10-ips',
    'CliProxy — 10 Residential IPs',
    'CliProxy',
    '10 clean rotating residential IPs from CliProxy for light testing and everyday tasks.',
    'CliProxy starter allocation providing 10 rotating residential IPs from a clean residential pool.',
    'https://proxiesvault.com.ng/cliproxy-logo.png',
    'Legitimate business, research, and privacy use only.',
    '1. Open My Proxies in your dashboard.\n2. Sign in to CliProxy with your delivered credentials.',
    'monthly', 30, 350000, 0, 350000,
    'manual', 'in_stock', true, false, false,
    '{"proxy_type":"rotating_residential","ip_count":10,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    'cliproxy-30-ips',
    'CliProxy — 30 Residential IPs',
    'CliProxy',
    '30 rotating residential IPs from CliProxy for scraping, automation, and multi-account work.',
    'CliProxy mid-tier package with 30 rotating residential IPs balancing coverage and cost for automation and scraping.',
    'https://proxiesvault.com.ng/cliproxy-logo.png',
    'Legitimate business, research, and privacy use only.',
    '1. Open My Proxies in your dashboard.\n2. Configure your CliProxy credentials.',
    'monthly', 30, 700000, 0, 700000,
    'manual', 'in_stock', true, false, true,
    '{"proxy_type":"rotating_residential","ip_count":30,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    'cliproxy-50-ips',
    'CliProxy — 50 Residential IPs',
    'CliProxy',
    '50 rotating residential IPs from CliProxy built for heavier scraping and multi-account workloads.',
    'High-capacity CliProxy package with 50 rotating residential IPs for multi-account management and scraping at scale.',
    'https://proxiesvault.com.ng/cliproxy-logo.png',
    'Legitimate business, research, and privacy use only.',
    '1. Open My Proxies in your dashboard.\n2. Configure your CliProxy credentials.',
    'monthly', 30, 1200000, 0, 1200000,
    'manual', 'in_stock', true, false, false,
    '{"proxy_type":"rotating_residential","ip_count":50,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[]'::jsonb
  ),

  -- NovProxy (ProxiesVault exact prices: ₦3,500 / ₦5,500, verified logo image)
  (
    (SELECT id FROM proxy_cat),
    'novproxy-10-ips',
    'NovProxy — 10 Residential IPs',
    'NovProxy',
    '10 rotating residential IPs from NovProxy for testing and light residential browsing tasks.',
    'NovProxy starter plan with 10 clean rotating residential IPs ready for automation and browser profiles.',
    'https://proxiesvault.com.ng/novproxy-logo.png',
    'Legitimate business, research, and privacy use only.',
    '1. Open My Proxies in your dashboard.\n2. Use your NovProxy login details.',
    'monthly', 30, 350000, 0, 350000,
    'manual', 'in_stock', true, false, false,
    '{"proxy_type":"rotating_residential","ip_count":10,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[]'::jsonb
  ),
  (
    (SELECT id FROM proxy_cat),
    'novproxy-25-ips',
    'NovProxy — 25 Residential IPs',
    'NovProxy',
    '25 rotating residential IPs from NovProxy for scraping, automation, and account management.',
    'NovProxy popular package delivering 25 rotating residential IPs for steady automation and multi-account tasks.',
    'https://proxiesvault.com.ng/novproxy-logo.png',
    'Legitimate business, research, and privacy use only.',
    '1. Open My Proxies in your dashboard.\n2. Configure your NovProxy credentials.',
    'monthly', 30, 550000, 0, 550000,
    'manual', 'in_stock', true, false, true,
    '{"proxy_type":"rotating_residential","ip_count":25,"rotation_type":"rotating","protocols":["HTTP","HTTPS","SOCKS5"],"auth_methods":["username_password"]}'::jsonb,
    '[]'::jsonb
  ),

  -- Additional requested VPN product: VPNClient — ₦4,400 (Manual delivery — no fabricated credentials)
  (
    (SELECT id FROM vpn_cat),
    'vpnclient-subscription',
    'VPNClient',
    'VPNClient',
    'VPNClient subscription billed in Nigerian Naira (₦4,400) with managed credential delivery.',
    'VPNClient subscription for encrypted remote browsing and privacy protection. Provisioned through our managed delivery queue after payment verification; credentials and setup instructions appear in My VPNs once fulfilled.',
    '',
    'Delivered manually after verified payment. Intended for lawful privacy and remote-access use.',
    '1. Complete payment via Bachs.io or your Wallet.\n2. Once fulfilled by operations, open My VPNs in your dashboard to view your credentials and setup steps.',
    'monthly', 30, 440000, 0, 440000,
    'manual', 'in_stock', true, true, true,
    '{"credential_type":"account","renewable":true}'::jsonb,
    '[]'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;
