-- =============================================================================
-- REWARD RIVER - PRODUCTION SUPABASE POSTGRESQL DATABASE SCHEMA & MIGRATION
-- =============================================================================
-- Run this complete script in your Supabase Dashboard -> SQL Editor -> Run.
-- Idempotent: safe to run on both fresh and existing Supabase projects.

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  password_hash TEXT DEFAULT '',
  salt TEXT DEFAULT '',
  display_name TEXT DEFAULT '',
  email_verified BOOLEAN DEFAULT true,
  role TEXT NOT NULL DEFAULT 'user',
  external_opaque_id TEXT UNIQUE,
  points BIGINT NOT NULL DEFAULT 0,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  total_earned_points BIGINT NOT NULL DEFAULT 0,
  photo_url TEXT,
  phone_number TEXT,
  whatsapp_number TEXT,
  country_code TEXT,
  provider TEXT DEFAULT 'password',
  has_prompted_phone BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist on existing users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS salt TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS external_opaque_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS points BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS balance_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_earned_points BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'password';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_prompted_phone BOOLEAN DEFAULT true;

-- 2. REWARD LEDGER TABLE (DOUBLE-ENTRY REWARD LEDGER)
CREATE TABLE IF NOT EXISTS public.reward_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider_tx_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  points BIGINT DEFAULT 0,
  gross_cents INTEGER DEFAULT 0,
  admin_profit_cents INTEGER DEFAULT 0,
  applied_share_percent INTEGER DEFAULT 50,
  entry_type TEXT NOT NULL DEFAULT 'credit', -- 'credit' | 'reversal'
  status TEXT NOT NULL DEFAULT 'confirmed',  -- 'pending' | 'confirmed' | 'rejected' | 'reversed'
  description TEXT NOT NULL,
  cpx_offer_id TEXT,
  reversal_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reward_ledger ADD COLUMN IF NOT EXISTS points BIGINT DEFAULT 0;
ALTER TABLE public.reward_ledger ADD COLUMN IF NOT EXISTS gross_cents INTEGER DEFAULT 0;
ALTER TABLE public.reward_ledger ADD COLUMN IF NOT EXISTS admin_profit_cents INTEGER DEFAULT 0;
ALTER TABLE public.reward_ledger ADD COLUMN IF NOT EXISTS applied_share_percent INTEGER DEFAULT 50;
ALTER TABLE public.reward_ledger ADD COLUMN IF NOT EXISTS task_id TEXT;
ALTER TABLE public.reward_ledger ADD COLUMN IF NOT EXISTS approved_by TEXT DEFAULT 'System Verification';

-- 2B. TASKS TABLE (ADMIN-EDITABLE TASK POINT DEFINITIONS)
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  task_type TEXT NOT NULL DEFAULT 'survey', -- 'survey' | 'ptc' | 'shortlink' | 'daily_checkin' | 'profile_verification' | 'custom'
  reward_points INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  daily_limit INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2C. TASK COMPLETIONS TABLE (IDEMPOTENT VERIFIED TASK COMPLETION LOG)
CREATE TABLE IF NOT EXISTS public.task_completions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  provider_tx_id TEXT UNIQUE NOT NULL,
  points BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed' | 'pending' | 'rejected' | 'reversed'
  reason TEXT NOT NULL,
  approved_by TEXT NOT NULL DEFAULT 'System Verification',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. WITHDRAWAL REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  usdt_address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'TRC20', -- 'TRC20' | 'ERC20'
  amount_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL DEFAULT 100,
  net_cents INTEGER NOT NULL,
  gross_usdt TEXT NOT NULL,
  fee_usdt TEXT NOT NULL,
  net_usdt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'under_review', -- 'requested' | 'under_review' | 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled'
  tx_hash TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 4. SYSTEM SETTINGS TABLE (CPX, AOYTASKS, 50% PROFIT SPLIT & PLATFORM SETTINGS)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  min_withdrawal_cents INTEGER NOT NULL DEFAULT 2500,
  max_withdrawal_cents INTEGER NOT NULL DEFAULT 50000,
  fee_cents_trc20 INTEGER NOT NULL DEFAULT 100,
  fee_cents_erc20 INTEGER NOT NULL DEFAULT 250,
  default_user_share_percent INTEGER NOT NULL DEFAULT 50,
  points_rate_per_usd INTEGER NOT NULL DEFAULT 5000,
  survey_display_mode TEXT NOT NULL DEFAULT 'hybrid',
  cpx_app_id TEXT DEFAULT '37699',
  cpx_secure_hash_secret TEXT DEFAULT '1u8hIFGwUYYORM76NM76PDxenCC50bCZ',
  cpx_api_key TEXT DEFAULT '1u8hIFGwUYYORM76NM76PDxenCC50bCZ',
  cpx_integration_mode TEXT DEFAULT 'hybrid_api',
  cpx_max_surveys INTEGER DEFAULT 12,
  cpx_theme_color TEXT DEFAULT '10b981',
  cpx_enable_fallback BOOLEAN DEFAULT true,
  cpx_verify_signature BOOLEAN DEFAULT true,
  aoy_api_key TEXT DEFAULT '',
  aoy_secret_key TEXT DEFAULT '',
  aoy_bearer_token TEXT DEFAULT '',
  aoy_exchange_rate INTEGER DEFAULT 10000,
  aoy_enable_fallback BOOLEAN DEFAULT true,
  aoy_verify_signature BOOLEAN DEFAULT true,
  maintenance_mode BOOLEAN DEFAULT false,
  default_network TEXT DEFAULT 'TRC20',
  google_analytics_id TEXT DEFAULT '',
  google_analytics_enabled BOOLEAN DEFAULT false,
  meta_title TEXT DEFAULT 'Reward River - Real Opinions. Real Value.',
  meta_description TEXT DEFAULT 'Discover available research surveys, share verified opinions, and earn rewards paid directly in USDT.',
  meta_keywords TEXT DEFAULT 'paid surveys, earn USDT, crypto rewards, market research, CPX Research, Reward River, TRC20 payouts',
  og_image_url TEXT DEFAULT '/favicon.svg',
  google_search_console_key TEXT DEFAULT '',
  sitemap_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT 'system'
);

-- 5. PLATFORM TREASURY TABLE (GROSS REVENUE vs USER SHARE vs ADMIN PROFIT)
CREATE TABLE IF NOT EXISTS public.platform_treasury (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL DEFAULT 'cpx_research',
  provider_name TEXT NOT NULL DEFAULT 'CPX Research',
  source_type TEXT NOT NULL DEFAULT 'survey_completion',
  gross_amount_cents INTEGER NOT NULL DEFAULT 0,
  user_share_cents INTEGER NOT NULL DEFAULT 0,
  platform_share_cents INTEGER NOT NULL DEFAULT 0,
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT,
  provider_tx_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ADMIN AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT,
  admin_email TEXT,
  action TEXT NOT NULL,
  target_entity TEXT,
  target_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- 7. STANDARD VIEWS FOR POINTS_LEDGER AND AUDIT_LOG
CREATE OR REPLACE VIEW public.points_ledger AS
SELECT
  id,
  user_id,
  COALESCE(task_id, cpx_offer_id, 'task_cpx_survey') AS task_id,
  provider_tx_id,
  CASE WHEN entry_type IN ('debit', 'reversal') THEN -ABS(points) ELSE ABS(points) END AS points_delta,
  points,
  amount_cents,
  entry_type,
  status,
  description AS reason,
  COALESCE(approved_by, 'System Verification') AS approved_by,
  created_at,
  processed_at
FROM public.reward_ledger;

CREATE OR REPLACE VIEW public.audit_log AS
SELECT
  id,
  admin_user_id,
  admin_email,
  action,
  target_entity,
  target_id,
  details,
  ip_address,
  created_at
FROM public.admin_audit_logs;

-- =============================================================================
-- INITIAL SEED DATA & INDEXES
-- =============================================================================
INSERT INTO public.system_settings (
  id,
  min_withdrawal_cents,
  max_withdrawal_cents,
  fee_cents_trc20,
  fee_cents_erc20,
  default_user_share_percent,
  points_rate_per_usd,
  cpx_app_id,
  cpx_secure_hash_secret
)
VALUES (
  'global',
  2500,
  50000,
  100,
  250,
  50,
  5000,
  '37699',
  '1u8hIFGwUYYORM76NM76PDxenCC50bCZ'
)
ON CONFLICT (id) DO UPDATE SET
  min_withdrawal_cents = EXCLUDED.min_withdrawal_cents,
  default_user_share_percent = EXCLUDED.default_user_share_percent,
  points_rate_per_usd = EXCLUDED.points_rate_per_usd,
  cpx_app_id = EXCLUDED.cpx_app_id,
  cpx_secure_hash_secret = EXCLUDED.cpx_secure_hash_secret;

INSERT INTO public.tasks (id, title, description, task_type, reward_points, is_active, daily_limit)
VALUES
  ('task_cpx_survey', 'CPX Research Verified Survey Completion', 'Full market research survey verified via S2S postback (status=1).', 'survey', 5000, true, 50),
  ('task_cpx_screenout', 'CPX Research Survey Screenout Bonus', 'Qualification attempt / screenout participation bonus (status=2).', 'survey', 100, true, 10),
  ('task_aoy_ptc', 'AdsOnYourPTC Sponsored Campaign Visit', 'Verified PTC campaign timer completion.', 'ptc', 150, true, 25),
  ('task_aoy_shortlink', 'AdsOnYourPTC Verified Shortlink', 'Verified shortlink traversal and anti-bot check completion.', 'shortlink', 250, true, 20),
  ('task_daily_checkin', 'Daily Verified Earner Check-In', 'Daily active earner verification reward.', 'daily_checkin', 100, true, 1),
  ('task_profile_verify', 'Research Profile & Phone Verification', 'One-time bonus for completing full demographic and WhatsApp/Phone verification.', 'profile_verification', 250, true, 1)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_reward_ledger_user_id ON public.reward_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_provider_tx_id ON public.reward_ledger(provider_tx_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_user_id ON public.task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_external_opaque_id ON public.users(external_opaque_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_treasury ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read access on system settings and active tasks
DROP POLICY IF EXISTS "Public System Settings Read" ON public.system_settings;
CREATE POLICY "Public System Settings Read" ON public.system_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Tasks Read" ON public.tasks;
CREATE POLICY "Public Tasks Read" ON public.tasks FOR SELECT USING (true);

