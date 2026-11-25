-- Additive migration: Add Bachs.io as a supported payment method & provider
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('bachs', 'paystack', 'wallet'));

ALTER TABLE public.payment_transactions
  ALTER COLUMN provider SET DEFAULT 'bachs';
