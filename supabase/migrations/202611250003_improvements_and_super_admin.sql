-- Migration 0003: Super Admin assignment for design.revamplabs@gmail.com,
-- strict super_admin RBAC on user_roles, default_emails management, and copy updates.

-- 1) Helper to check super_admin role
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = check_user_id
      AND ur.role = 'super_admin'
  );
$$;

-- 2) Tighten user_roles RLS so only super_admin can grant/revoke super_admin privileges
DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_super_admin_manage" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_non_super_manage" ON public.user_roles;

CREATE POLICY "user_roles_super_admin_manage" ON public.user_roles
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "user_roles_admin_non_super_manage" ON public.user_roles
  FOR ALL
  USING (public.is_admin() AND role <> 'super_admin')
  WITH CHECK (public.is_admin() AND role <> 'super_admin');

-- 3) Upgrade existing account design.revamplabs@gmail.com to super_admin (no duplicate account, no password change)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE LOWER(email) = 'design.revamplabs@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 4) Seed editable default_emails setting (separate from system-critical email_config)
INSERT INTO public.website_settings (key, value, is_public)
VALUES (
  'default_emails',
  '[
    {
      "id": "email-support",
      "label": "Customer Support",
      "address": "support@yourdomain.com",
      "purpose": "support",
      "is_active": true
    },
    {
      "id": "email-noreply",
      "label": "Transactional Sender",
      "address": "noreply@yourdomain.com",
      "purpose": "transactional",
      "is_active": true
    }
  ]'::jsonb,
  false
)
ON CONFLICT (key) DO NOTHING;

-- 5) Update initial copy in website_settings to reflect Bachs.io instead of Paystack
UPDATE public.website_settings
SET value = jsonb_set(
  value,
  '{instantDeliveryBody}',
  '"Once Bachs.io confirms your payment or your wallet is debited, our backend connects directly to the configured supplier API or operations queue to provision your service and deliver credentials into your dashboard and inbox."'::jsonb
)
WHERE key = 'homepage' AND value ->> 'instantDeliveryBody' LIKE '%Paystack%';

UPDATE public.website_settings
SET value = jsonb_set(
  value,
  '{privacy}',
  '"We collect only the account, billing, and service records necessary to authenticate your session, verify payments via Bachs.io, deliver digital services, and provide support."'::jsonb
)
WHERE key = 'policies' AND value ->> 'privacy' LIKE '%Paystack%';

UPDATE public.website_settings
SET value = '[
  {
    "id": "faq-1",
    "category": "Payments",
    "question": "What payment methods are supported?",
    "answer": "All prices are in Nigerian Naira (₦). You can pay directly via Bachs.io using cards, Nigerian bank transfers, mobile money, or fund your account wallet for instant checkout."
  },
  {
    "id": "faq-2",
    "category": "Delivery",
    "question": "How does automated product delivery work?",
    "answer": "After backend payment verification, orders mapped to an active API supplier are provisioned automatically and credentials appear in your Customer Dashboard and email."
  },
  {
    "id": "faq-3",
    "category": "UK Numbers",
    "question": "Do UK virtual numbers work with every third-party service?",
    "answer": "No virtual number provider can guarantee acceptance by every third-party platform. Always check the listed SMS/voice capabilities and temporary vs dedicated classification before purchasing."
  }
]'::jsonb
WHERE key = 'faqs' AND value::text LIKE '%Paystack%';
