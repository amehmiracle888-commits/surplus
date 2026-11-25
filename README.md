# Digital Services Reseller Platform (VPN, Proxies & UK Virtual Numbers)

A full-stack digital services e-commerce and reseller platform built with **Next.js (App Router, TypeScript, Tailwind CSS)**, **Supabase (PostgreSQL, Authentication, RLS, Storage, Edge Functions)**, and **Bachs.io (Nigerian Naira ₦)**.

## Step-by-Step Supabase Setup

1. **Create a Supabase Project**
   - Sign in at https://supabase.com/dashboard and create a new project.
   - Open **Project Settings -> API** and copy:
     - **Project URL** -> `NEXT_PUBLIC_SUPABASE_URL`
     - **anon public** key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role** key -> `SUPABASE_SERVICE_ROLE_KEY`

2. **Run the SQL Migrations in Supabase**
   - In the Supabase Dashboard, open **SQL Editor -> New Query**.
   - Paste and run `supabase/migrations/202611250001_initial_schema.sql`.
   - Then paste and run `supabase/migrations/202611250002_bachs_support.sql`.
   - This creates all 20 tables, RLS policies, column-level security, the atomic `apply_wallet_ledger_entry` RPC, `handle_new_user` trigger, Storage buckets (`product-images`, `support-attachments`), and initial structural settings.

3. **Configure Supabase Authentication URLs**
   - Go to **Authentication -> URL Configuration**.
   - Set **Site URL** to `http://localhost:3000` (or your production domain).
   - Add Redirect URL: `http://localhost:3000/auth/callback` (and `https://yourdomain.com/auth/callback`).

4. **Create Your `.env.local` File**
   Copy `.env.example` to `.env.local` and fill in your Supabase keys, Bachs.io keys (`BACHS_SECRET_KEY`, `BACHS_WEBHOOK_SECRET`), and a 64-char hex `SUPPLIER_SECRETS_ENCRYPTION_KEY`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. **Create Your First Admin User**
   - Run `npm run dev`, open `/register`, create your account, and verify your email.
   - In Supabase **SQL Editor**, promote that user to `super_admin`:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'super_admin'::public.app_role
   FROM auth.users
   WHERE email = 'your-admin@yourdomain.com'
   ON CONFLICT (user_id, role) DO NOTHING;
   ```

6. **Configure Bachs.io Webhooks**
   - In your Bachs.io Developer Portal -> **Webhooks**, create an endpoint pointing to:
     - `https://yourdomain.com/api/payments/bachs/webhook` (or forward locally during dev using `bachs listen --forward-to http://localhost:3000/api/payments/bachs/webhook`).
   - Subscribe to `checkout.completed` and `collection.succeeded`.
   - Copy the `whsec_...` signing secret into `BACHS_WEBHOOK_SECRET`.

7. **Verify & Run**
   ```bash
   npm install
   npm run typecheck
   npm test
   npm run build
   npm run start
   ```

