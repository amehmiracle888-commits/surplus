-- Initial Production Schema for Digital Services Reseller Platform
-- Covers all 20 required tables, atomic wallet ledger, strict RLS, and audit logging.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('customer', 'admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_cycle AS ENUM ('once', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_method AS ENUM ('automated', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.availability_status AS ENUM ('in_stock', 'low_stock', 'out_of_stock', 'discontinued');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'pending_payment', 'paid', 'processing', 'delivered', 'failed', 'cancelled', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fulfilment_status AS ENUM ('pending', 'processing', 'delivered', 'failed', 'retrying');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_entry_type AS ENUM ('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_tx_category AS ENUM ('deposit', 'purchase', 'renewal', 'refund', 'admin_adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'awaiting_customer', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. TABLES (20 Core Tables)
-- ============================================================================

-- 1) profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  country TEXT NOT NULL DEFAULT 'NG',
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  suspended_reason TEXT,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'customer',
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 3) product_categories
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'shield',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) suppliers (Admin-only)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  adapter_key TEXT NOT NULL DEFAULT 'manual',
  category_slug TEXT NOT NULL REFERENCES public.product_categories(slug) ON UPDATE CASCADE,
  api_base_url TEXT DEFAULT '',
  auth_method TEXT NOT NULL DEFAULT 'bearer',
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  api_docs_url TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 10,
  balance_amount NUMERIC(14, 4),
  balance_currency TEXT DEFAULT 'USD',
  last_connected_at TIMESTAMPTZ,
  connection_status TEXT NOT NULL DEFAULT 'untested',
  last_error TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT DEFAULT '',
  terms_and_conditions TEXT NOT NULL DEFAULT '',
  setup_instructions TEXT NOT NULL DEFAULT '',
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'monthly',
  duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  retail_price_kobo BIGINT NOT NULL CHECK (retail_price_kobo >= 0),
  wholesale_cost_kobo BIGINT NOT NULL DEFAULT 0 CHECK (wholesale_cost_kobo >= 0),
  renewal_price_kobo BIGINT CHECK (renewal_price_kobo IS NULL OR renewal_price_kobo >= 0),
  delivery_method public.delivery_method NOT NULL DEFAULT 'manual',
  availability_status public.availability_status NOT NULL DEFAULT 'in_stock',
  stock_quantity INTEGER CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  default_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  options_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6) supplier_products (Admin-only)
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  external_product_id TEXT NOT NULL,
  external_plan_code TEXT DEFAULT '',
  wholesale_cost_kobo BIGINT NOT NULL DEFAULT 0 CHECK (wholesale_cost_kobo >= 0),
  wholesale_currency TEXT NOT NULL DEFAULT 'NGN',
  priority INTEGER NOT NULL DEFAULT 10,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, product_id)
);

-- 7) orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_reference TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status public.order_status NOT NULL DEFAULT 'pending_payment',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('paystack', 'wallet')),
  payment_reference TEXT UNIQUE,
  subtotal_kobo BIGINT NOT NULL CHECK (subtotal_kobo >= 0),
  discount_kobo BIGINT NOT NULL DEFAULT 0 CHECK (discount_kobo >= 0),
  processing_fee_kobo BIGINT NOT NULL DEFAULT 0 CHECK (processing_fee_kobo >= 0),
  total_kobo BIGINT NOT NULL CHECK (total_kobo >= 0),
  wholesale_cost_kobo BIGINT NOT NULL DEFAULT 0 CHECK (wholesale_cost_kobo >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  customer_email TEXT NOT NULL,
  notes TEXT DEFAULT '',
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8) order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  category_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_kobo BIGINT NOT NULL CHECK (unit_price_kobo >= 0),
  unit_wholesale_cost_kobo BIGINT NOT NULL DEFAULT 0 CHECK (unit_wholesale_cost_kobo >= 0),
  total_price_kobo BIGINT NOT NULL CHECK (total_price_kobo >= 0),
  duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  selected_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9) order_fulfilments
CREATE TABLE IF NOT EXISTS public.order_fulfilments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  fulfilment_mode public.delivery_method NOT NULL DEFAULT 'manual',
  status public.fulfilment_status NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  external_reference TEXT,
  supplier_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  fulfilled_by UUID REFERENCES auth.users(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10) supplier_transactions (Admin-only)
CREATE TABLE IF NOT EXISTS public.supplier_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_fulfilment_id UUID REFERENCES public.order_fulfilments(id) ON DELETE SET NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  http_status INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11) customer_services
CREATE TABLE IF NOT EXISTS public.customer_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  category_slug TEXT NOT NULL,
  service_label TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('pending_activation', 'active', 'expiring_soon', 'expired', 'suspended', 'released')
  ),
  credentials_encrypted TEXT,
  public_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  external_service_id TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  renewal_price_kobo BIGINT,
  last_usage_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12) wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_kobo BIGINT NOT NULL DEFAULT 0 CHECK (balance_kobo >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13) payment_transactions
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('wallet_deposit', 'order_payment', 'renewal_payment')),
  provider TEXT NOT NULL DEFAULT 'paystack',
  reference TEXT NOT NULL UNIQUE,
  provider_reference TEXT,
  channel TEXT,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  fee_kobo BIGINT NOT NULL DEFAULT 0 CHECK (fee_kobo >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'initialized' CHECK (
    status IN ('initialized', 'pending', 'success', 'failed', 'abandoned')
  ),
  verified_at TIMESTAMPTZ,
  webhook_received_at TIMESTAMPTZ,
  raw_verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14) wallet_transactions (Append-only immutable ledger)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  entry_type public.wallet_entry_type NOT NULL,
  category public.wallet_tx_category NOT NULL,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  balance_before_kobo BIGINT NOT NULL CHECK (balance_before_kobo >= 0),
  balance_after_kobo BIGINT NOT NULL CHECK (balance_after_kobo >= 0),
  reference TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15) renewals
CREATE TABLE IF NOT EXISTS public.renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_service_id UUID NOT NULL REFERENCES public.customer_services(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo >= 0),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'paid', 'processing', 'completed', 'failed', 'refunded')
  ),
  previous_expires_at TIMESTAMPTZ,
  new_expires_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16) support_tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'other',
  subject TEXT NOT NULL,
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'open',
  assigned_admin_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- 17) support_messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'admin')),
  message TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18) notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'in_app')),
  recipient_email TEXT,
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT DEFAULT '',
  body_text TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  provider_message_id TEXT,
  error_message TEXT,
  read_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19) website_settings
CREATE TABLE IF NOT EXISTS public.website_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 20) audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status, payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_fulfilments_order ON public.order_fulfilments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_fulfilments_retry ON public.order_fulfilments(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_customer_services_user ON public.customer_services(user_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_services_expiry ON public.customer_services(expires_at, status);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_tx_user ON public.payment_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages(ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ============================================================================
-- 4. SECURITY DEFINER HELPERS & TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
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
      AND ur.role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Updated_at triggers
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles', 'product_categories', 'suppliers', 'products',
    'supplier_products', 'orders', 'order_fulfilments', 'customer_services',
    'wallets', 'payment_transactions', 'renewals', 'support_tickets', 'website_settings'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', tbl, tbl);
  END LOOP;
END $$;

-- Prevent mutation of wallet_transactions and audit_logs
CREATE OR REPLACE FUNCTION public.prevent_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only and cannot be modified or deleted', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallet_tx_immutable ON public.wallet_transactions;
CREATE TRIGGER trg_wallet_tx_immutable
  BEFORE UPDATE OR DELETE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_mutation();

-- Automatic profile, role, and wallet creation on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance_kobo, currency)
  VALUES (NEW.id, 0, 'NGN')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic, row-locked, idempotent wallet ledger RPC
CREATE OR REPLACE FUNCTION public.apply_wallet_ledger_entry(
  p_user_id UUID,
  p_entry_type public.wallet_entry_type,
  p_category public.wallet_tx_category,
  p_amount_kobo BIGINT,
  p_reference TEXT,
  p_description TEXT DEFAULT '',
  p_order_id UUID DEFAULT NULL,
  p_payment_transaction_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.wallet_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_existing public.wallet_transactions%ROWTYPE;
  v_new_balance BIGINT;
  v_inserted public.wallet_transactions%ROWTYPE;
BEGIN
  IF p_amount_kobo <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive (got %)', p_amount_kobo;
  END IF;

  -- Idempotency check
  SELECT * INTO v_existing
  FROM public.wallet_transactions
  WHERE reference = p_reference;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Lock wallet row
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance_kobo, currency)
    VALUES (p_user_id, 0, 'NGN')
    RETURNING * INTO v_wallet;
  END IF;

  IF p_entry_type = 'credit' THEN
    v_new_balance := v_wallet.balance_kobo + p_amount_kobo;
  ELSE
    IF v_wallet.balance_kobo < p_amount_kobo THEN
      RAISE EXCEPTION 'Insufficient wallet balance (available: %, requested: %)', v_wallet.balance_kobo, p_amount_kobo;
    END IF;
    v_new_balance := v_wallet.balance_kobo - p_amount_kobo;
  END IF;

  UPDATE public.wallets
  SET balance_kobo = v_new_balance
  WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, entry_type, category, amount_kobo,
    balance_before_kobo, balance_after_kobo, reference,
    order_id, payment_transaction_id, description, metadata, created_by
  )
  VALUES (
    v_wallet.id, p_user_id, p_entry_type, p_category, p_amount_kobo,
    v_wallet.balance_kobo, v_new_balance, p_reference,
    p_order_id, p_payment_transaction_id, p_description, COALESCE(p_metadata, '{}'::jsonb), p_created_by
  )
  RETURNING * INTO v_inserted;

  RETURN v_inserted;
END;
$$;

-- ============================================================================
-- 5. COLUMN-LEVEL SECURITY FOR WHOLESALE COSTS & INTERNAL FIELDS
-- ============================================================================
REVOKE SELECT (wholesale_cost_kobo) ON public.products FROM anon, authenticated;
REVOKE SELECT (wholesale_cost_kobo) ON public.orders FROM anon, authenticated;
REVOKE SELECT (unit_wholesale_cost_kobo) ON public.order_items FROM anon, authenticated;
REVOKE SELECT (supplier_response) ON public.order_fulfilments FROM anon, authenticated;
REVOKE SELECT (raw_verification) ON public.payment_transactions FROM anon, authenticated;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_fulfilments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND is_suspended = (SELECT is_suspended FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- user_roles
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- product_categories (public read active, admin write)
CREATE POLICY "categories_public_read" ON public.product_categories
  FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "categories_admin_manage" ON public.product_categories
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- products (public read active, admin write; wholesale_cost_kobo column revoked for non-service roles)
CREATE POLICY "products_public_read" ON public.products
  FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "products_admin_manage" ON public.products
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- suppliers / supplier_products / supplier_transactions (strictly admin only)
CREATE POLICY "suppliers_admin_only" ON public.suppliers
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "supplier_products_admin_only" ON public.supplier_products
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "supplier_transactions_admin_only" ON public.supplier_transactions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- orders (owner read, admin all; mutations happen via backend service role)
CREATE POLICY "orders_select_own_or_admin" ON public.orders
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "orders_admin_manage" ON public.orders
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- order_items
CREATE POLICY "order_items_select_own_or_admin" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    OR public.is_admin()
  );

-- order_fulfilments
CREATE POLICY "order_fulfilments_select_own_or_admin" ON public.order_fulfilments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    OR public.is_admin()
  );

-- customer_services (credentials_encrypted never mutated by customer)
CREATE POLICY "customer_services_select_own_or_admin" ON public.customer_services
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "customer_services_admin_manage" ON public.customer_services
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- wallets & wallet_transactions (read own or admin; mutations strictly via SECURITY DEFINER RPC/service role)
CREATE POLICY "wallets_select_own_or_admin" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "wallet_tx_select_own_or_admin" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- payment_transactions
CREATE POLICY "payment_tx_select_own_or_admin" ON public.payment_transactions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- renewals
CREATE POLICY "renewals_select_own_or_admin" ON public.renewals
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- support_tickets & support_messages
CREATE POLICY "tickets_select_own_or_admin" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "tickets_insert_own" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tickets_update_own_close_or_admin" ON public.support_tickets
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "ticket_messages_select_own_or_admin" ON public.support_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
    OR public.is_admin()
  );
CREATE POLICY "ticket_messages_insert_own_or_admin" ON public.support_messages
  FOR INSERT WITH CHECK (
    (sender_role = 'customer' AND sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()
    ))
    OR (sender_role = 'admin' AND public.is_admin())
  );

-- notifications
CREATE POLICY "notifications_select_own_or_admin" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "notifications_update_own_read" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- website_settings (public keys readable by all, private keys admin-only)
CREATE POLICY "website_settings_read" ON public.website_settings
  FOR SELECT USING (is_public = true OR public.is_admin());
CREATE POLICY "website_settings_admin_manage" ON public.website_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- audit_logs (admin-only read)
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- ============================================================================
-- 7. STORAGE BUCKETS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "product_images_admin_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
CREATE POLICY "product_images_admin_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "support_attachments_owner_or_admin_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'support-attachments'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())
  );
CREATE POLICY "support_attachments_owner_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'support-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 8. INITIAL STRUCTURAL SEED (Categories & Editable Site Settings Only)
-- ============================================================================
INSERT INTO public.product_categories (slug, name, description, icon, sort_order, is_active)
VALUES
  ('vpn', 'VPN Subscriptions', 'Encrypted global VPN plans across trusted providers for privacy, remote access, and secure browsing.', 'shield', 1, true),
  ('proxy', 'Proxy Services', 'Residential, ISP, mobile 4G/5G, and datacenter proxy infrastructure with transparent capabilities.', 'network', 2, true),
  ('uk-number', 'UK Virtual Numbers', 'Dedicated and temporary +44 UK virtual numbers with clearly disclosed SMS and voice capabilities.', 'phone', 3, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.website_settings (key, value, is_public)
VALUES
  ('branding', '{
    "brandName": "Veltrix Digital",
    "tagline": "Premium Digital Access Infrastructure",
    "logoUrl": "",
    "primaryColor": "#3B82F6",
    "accentColor": "#8B5CF6",
    "backgroundColor": "#070B19"
  }'::jsonb, true),
  ('homepage', '{
    "heroHeadline": "Your Digital Essentials. One Destination.",
    "heroSubtext": "Premium VPN subscriptions, reliable proxy services and UK virtual numbers. Get the digital services you need with secure payments and automated delivery.",
    "primaryCta": "Explore Products",
    "secondaryCta": "Create Account",
    "instantDeliveryTitle": "Automated Provisioning After Verified Payment",
    "instantDeliveryBody": "Once Paystack confirms your payment or your wallet is debited, our backend connects directly to the configured supplier API to provision your service and deliver credentials into your dashboard and inbox."
  }'::jsonb, true),
  ('contact', '{
    "supportEmail": "support@yourdomain.com",
    "whatsappUrl": "https://wa.me/2348000000000",
    "whatsappDisplay": "+234 800 000 0000",
    "telegramUrl": "",
    "businessHours": "Mon - Sat, 8:00 AM - 8:00 PM WAT",
    "officeLocation": "Lagos, Nigeria"
  }'::jsonb, true),
  ('payment_limits', '{
    "minDepositNaira": 500,
    "maxDepositNaira": 5000000,
    "currency": "NGN"
  }'::jsonb, true),
  ('banners', '{"enabled": false, "text": "", "href": "/shop"}'::jsonb, true),
  ('social_links', '{"twitter": "", "telegram": "", "instagram": "", "linkedin": ""}'::jsonb, true),
  ('faqs', '[
    {
      "id": "faq-1",
      "category": "Payments",
      "question": "What payment methods are supported?",
      "answer": "All prices are in Nigerian Naira (₦). You can pay directly via Paystack using Nigerian debit cards, bank transfers, USSD, or fund your account wallet for instant checkout."
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
  ]'::jsonb, true),
  ('setup_guides', '[
    {
      "id": "guide-vpn",
      "category": "vpn",
      "title": "Getting Started with Your VPN Subscription",
      "summary": "How to locate your credentials or activation key and sign in across desktop and mobile apps.",
      "content": "1. Open My VPNs in your Customer Dashboard.\n2. Copy your username/password or activation key.\n3. Download the official provider client for Windows, macOS, iOS, or Android.\n4. Sign in and select your preferred server location."
    },
    {
      "id": "guide-proxy",
      "category": "proxy",
      "title": "Configuring HTTP, HTTPS & SOCKS5 Proxies",
      "summary": "Connect using host, port, username, and password across browsers, curl, and automation tools.",
      "content": "1. Open My Proxies in your Customer Dashboard.\n2. Copy the formatted proxy string (host:port:username:password).\n3. Choose the protocol supported by your plan (HTTP, HTTPS, or SOCKS5).\n4. Monitor bandwidth usage directly from your dashboard when supported by the supplier."
    },
    {
      "id": "guide-uk",
      "category": "uk-number",
      "title": "Managing Your +44 UK Virtual Number",
      "summary": "Understanding temporary vs dedicated UK numbers, SMS inbox access, and renewal windows.",
      "content": "1. Open My UK Numbers in your Customer Dashboard.\n2. Confirm whether your number supports SMS, Voice, or both.\n3. Use the live inbox panel for SMS-capable numbers connected to an active supplier.\n4. Renew dedicated numbers before expiry to retain the same +44 number."
    }
  ]'::jsonb, true),
  ('policies', '{
    "terms": "All digital services are provisioned strictly for lawful use. Availability, renewal eligibility, and capabilities depend on the selected product specification and upstream supplier terms.",
    "privacy": "We collect only the account, billing, and service records necessary to authenticate your session, verify payments via Paystack, deliver digital services, and provide support.",
    "refund": "Verified payment failures or confirmed automated supplier fulfilment failures are automatically credited back to your wallet or refunded. Delivered digital credentials and active virtual number allocations are non-refundable unless defective at delivery."
  }'::jsonb, true),
  ('email_config', '{
    "provider": "resend",
    "fromEmail": "noreply@yourdomain.com",
    "fromName": "Veltrix Digital",
    "replyTo": "support@yourdomain.com",
    "templates": {
      "welcome": {"subject": "Welcome to {{brandName}}", "enabled": true},
      "payment_success": {"subject": "Payment Confirmed - {{reference}}", "enabled": true},
      "delivery_success": {"subject": "Your Digital Service is Ready - {{orderReference}}", "enabled": true},
      "delivery_failed": {"subject": "Order Fulfilment Update - {{orderReference}}", "enabled": true},
      "expiry_reminder": {"subject": "Subscription Expiring Soon - {{serviceLabel}}", "enabled": true},
      "renewal_success": {"subject": "Subscription Renewed - {{serviceLabel}}", "enabled": true},
      "wallet_deposit": {"subject": "Wallet Credited - {{amount}}", "enabled": true},
      "ticket_update": {"subject": "Support Ticket Update - {{ticketNumber}}", "enabled": true}
    }
  }'::jsonb, false)
ON CONFLICT (key) DO NOTHING;
