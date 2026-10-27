-- =============================================================================
-- REWARD RIVER - SUPABASE POSTGRESQL DATABASE SCHEMA & MIGRATION SCRIPT
-- =============================================================================
-- Run this complete script in your Supabase Dashboard -> SQL Editor -> Run
-- This sets up all 5 required tables, indexes, and row-level security policies.

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  has_prompted_phone BOOLEAN DEFAULT false,
  phone_number TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LEDGER ENTRIES TABLE (DOUBLE-ENTRY REWARD LEDGER)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  points_change INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL, -- 'credit', 'debit', 'reserved', 'refund', 'chargeback'
  description TEXT NOT NULL,
  reference_id TEXT DEFAULT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. WITHDRAWAL REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  usdt_address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'TRC20', -- 'TRC20' or 'ERC20'
  amount_cents INTEGER NOT NULL,
  points_deducted INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'rejected'
  tx_hash TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SYSTEM SETTINGS TABLE (CPX, AOYTASKS, PROFIT SPLIT & PLATFORM SETTINGS)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  min_withdrawal_cents INTEGER NOT NULL DEFAULT 2500,
  max_withdrawal_cents INTEGER NOT NULL DEFAULT 50000,
  fee_cents_trc20 INTEGER NOT NULL DEFAULT 100,
  fee_cents_erc20 INTEGER NOT NULL DEFAULT 250,
  user_share_percent INTEGER NOT NULL DEFAULT 40,
  points_per_usdt INTEGER NOT NULL DEFAULT 10000,
  survey_display_mode TEXT NOT NULL DEFAULT 'hybrid',
  cpx_app_id TEXT DEFAULT '37479',
  cpx_hash_key TEXT DEFAULT 'yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY',
  aoy_api_key TEXT DEFAULT '',
  aoy_secret_key TEXT DEFAULT '',
  aoy_bearer_token TEXT DEFAULT '',
  meta_title TEXT DEFAULT 'Reward River - Real Opinions. Real Value.',
  meta_description TEXT DEFAULT 'Discover available research surveys, share verified opinions, and earn rewards paid directly in USDT.',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ADMIN AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INITIAL SEED DATA & INDEXES
-- =============================================================================

INSERT INTO public.system_settings (id, min_withdrawal_cents, max_withdrawal_cents, user_share_percent, points_per_usdt, cpx_app_id, cpx_hash_key)
VALUES (1, 2500, 50000, 40, 10000, '37479', 'yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON public.ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access on system settings
CREATE POLICY "Public System Settings Read" ON public.system_settings FOR SELECT USING (true);
