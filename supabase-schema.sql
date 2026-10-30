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

ALTER TABLE public.reward_ledger ADD COLUMN IF NOT EXISTS completion_id TEXT;
ALTER TABLE public.task_completions ADD COLUMN IF NOT EXISTS offer_id TEXT;
ALTER TABLE public.task_completions ADD COLUMN IF NOT EXISTS payout_usd NUMERIC(12, 4) DEFAULT 0;

-- 7. STANDARD VIEWS FOR POINTS_LEDGER AND AUDIT_LOG
CREATE OR REPLACE VIEW public.points_ledger AS
SELECT
  id,
  user_id,
  COALESCE(completion_id, provider_tx_id) AS completion_id,
  COALESCE(task_id, cpx_offer_id, 'task_cpx_survey') AS task_id,
  provider_tx_id AS trans_id,
  provider_tx_id,
  CASE WHEN entry_type IN ('debit', 'reversal') THEN -ABS(points) ELSE ABS(points) END AS points,
  CASE WHEN entry_type IN ('debit', 'reversal') THEN -ABS(points) ELSE ABS(points) END AS points_delta,
  amount_cents,
  gross_cents,
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_ledger_provider_tx_id_unique ON public.reward_ledger(provider_tx_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_user_id ON public.task_completions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_completions_provider_tx_id_unique ON public.task_completions(provider_tx_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_external_opaque_id ON public.users(external_opaque_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - USERS CAN NEVER WRITE TO POINTS TABLES
-- =============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_treasury ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Public read on non-sensitive settings & active tasks
DROP POLICY IF EXISTS "Public System Settings Read" ON public.system_settings;
CREATE POLICY "Public System Settings Read" ON public.system_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Tasks Read" ON public.tasks;
CREATE POLICY "Public Tasks Read" ON public.tasks FOR SELECT USING (true);

-- Users can only read their own ledger and completions; zero INSERT/UPDATE/DELETE for non-admin
DROP POLICY IF EXISTS "Users Read Own Ledger" ON public.reward_ledger;
CREATE POLICY "Users Read Own Ledger" ON public.reward_ledger
  FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users Read Own Completions" ON public.task_completions;
CREATE POLICY "Users Read Own Completions" ON public.task_completions
  FOR SELECT USING (auth.uid()::text = user_id);

-- =============================================================================
-- ATOMIC POSTGRESQL RPC FUNCTIONS (TASK 1, TASK 3, TASK 4)
-- =============================================================================

-- 8A. Atomic CPX Postback Transaction RPC:
-- Saves survey completion + points_ledger (reward_ledger) entry + recalculates user total in ONE atomic transaction.
CREATE OR REPLACE FUNCTION public.process_cpx_postback(
  p_trans_id TEXT,
  p_ext_user_id TEXT,
  p_offer_id TEXT,
  p_amount_usd NUMERIC,
  p_status INTEGER,
  p_approved_by TEXT DEFAULT 'CPX S2S Verified Postback'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_conv_rate INTEGER;
  v_share_percent INTEGER;
  v_points BIGINT;
  v_gross_cents INTEGER;
  v_user_cents INTEGER;
  v_profit_cents INTEGER;
  v_completion_id TEXT;
  v_ledger_id TEXT;
  v_existing_credit RECORD;
  v_new_total_points BIGINT;
  v_new_total_earned BIGINT;
BEGIN
  -- 1. Resolve matching user by id or external_opaque_id
  SELECT id INTO v_user_id
  FROM public.users
  WHERE id = p_ext_user_id
     OR external_opaque_id = p_ext_user_id
     OR external_opaque_id = ('rr_cpx_' || p_ext_user_id)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'user_not_found', 'credited', false);
  END IF;

  -- 2. Read conversion rate from admin-editable system_settings table (not hardcoded)
  SELECT COALESCE(points_rate_per_usd, 5000), COALESCE(default_user_share_percent, 50)
  INTO v_conv_rate, v_share_percent
  FROM public.system_settings
  WHERE id = 'global'
  LIMIT 1;

  IF v_conv_rate IS NULL OR v_conv_rate <= 0 THEN
    v_conv_rate := 5000;
  END IF;
  IF v_share_percent IS NULL OR v_share_percent <= 0 THEN
    v_share_percent := 50;
  END IF;

  v_points := GREATEST(1, ROUND(COALESCE(p_amount_usd, 0) * v_conv_rate)::BIGINT);
  v_gross_cents := GREATEST(1, ROUND(COALESCE(p_amount_usd, 0) * 100)::INTEGER);
  v_user_cents := GREATEST(1, ROUND((v_points::NUMERIC / v_conv_rate) * (v_share_percent::NUMERIC / 100) * 100)::INTEGER);
  v_profit_cents := GREATEST(0, v_gross_cents - v_user_cents);

  -- 3. Handle Status = 1 (Completed Survey)
  IF p_status = 1 THEN
    -- Idempotency check: trans_id is UNIQUE
    IF EXISTS (SELECT 1 FROM public.reward_ledger WHERE provider_tx_id = p_trans_id) THEN
      RETURN jsonb_build_object('status', 'duplicate', 'credited', false, 'trans_id', p_trans_id);
    END IF;

    v_completion_id := 'tc_cpx_' || p_trans_id;
    v_ledger_id := 'le_cpx_' || p_trans_id;

    INSERT INTO public.task_completions (
      id, user_id, task_id, offer_id, provider_tx_id, points, payout_usd, status, reason, approved_by, created_at, verified_at
    ) VALUES (
      v_completion_id, v_user_id, 'task_cpx_survey', COALESCE(p_offer_id, p_trans_id), p_trans_id,
      v_points, COALESCE(p_amount_usd, 0), 'completed',
      'CPX Survey #' || COALESCE(p_offer_id, p_trans_id) || ' Completed',
      p_approved_by, NOW(), NOW()
    )
    ON CONFLICT (provider_tx_id) DO NOTHING;

    INSERT INTO public.reward_ledger (
      id, user_id, completion_id, task_id, cpx_offer_id, provider_tx_id,
      amount_cents, points, gross_cents, admin_profit_cents, applied_share_percent,
      entry_type, status, description, approved_by, created_at, processed_at
    ) VALUES (
      v_ledger_id, v_user_id, v_completion_id, 'task_cpx_survey', COALESCE(p_offer_id, p_trans_id), p_trans_id,
      v_user_cents, v_points, v_gross_cents, v_profit_cents, v_share_percent,
      'credit', 'confirmed',
      'CPX Research Survey #' || COALESCE(p_offer_id, p_trans_id) || ' Completed (+' || v_points || ' Pts)',
      p_approved_by, NOW(), NOW()
    );

  -- 4. Handle Status = 2 (Canceled / Reversed Survey)
  ELSIF p_status = 2 THEN
    -- Only deduct if the original transaction was credited before
    SELECT * INTO v_existing_credit
    FROM public.reward_ledger
    WHERE provider_tx_id = p_trans_id AND entry_type = 'credit' AND status = 'confirmed'
    LIMIT 1;

    IF v_existing_credit IS NULL THEN
      RETURN jsonb_build_object('status', 'ignored_not_credited', 'credited', false, 'trans_id', p_trans_id);
    END IF;

    -- Idempotency check for reversal
    IF EXISTS (SELECT 1 FROM public.reward_ledger WHERE provider_tx_id = (p_trans_id || '_rev')) THEN
      RETURN jsonb_build_object('status', 'duplicate_reversal', 'credited', false, 'trans_id', p_trans_id);
    END IF;

    v_points := COALESCE(v_existing_credit.points, v_points);
    v_user_cents := COALESCE(v_existing_credit.amount_cents, v_user_cents);
    v_gross_cents := COALESCE(v_existing_credit.gross_cents, v_gross_cents);
    v_profit_cents := COALESCE(v_existing_credit.admin_profit_cents, v_profit_cents);

    UPDATE public.task_completions
    SET status = 'reversed'
    WHERE provider_tx_id = p_trans_id;

    INSERT INTO public.reward_ledger (
      id, user_id, completion_id, task_id, cpx_offer_id, provider_tx_id, reversal_ref,
      amount_cents, points, gross_cents, admin_profit_cents, applied_share_percent,
      entry_type, status, description, approved_by, created_at, processed_at
    ) VALUES (
      'le_cpx_' || p_trans_id || '_rev', v_user_id, v_existing_credit.completion_id, 'task_cpx_survey',
      COALESCE(p_offer_id, v_existing_credit.cpx_offer_id, p_trans_id), p_trans_id || '_rev', p_trans_id,
      v_user_cents, v_points, v_gross_cents, v_profit_cents, v_share_percent,
      'reversal', 'confirmed',
      'CPX Survey #' || COALESCE(p_offer_id, p_trans_id) || ' Reversed (-' || v_points || ' Pts)',
      p_approved_by, NOW(), NOW()
    );
  ELSE
    RETURN jsonb_build_object('status', 'unsupported_status', 'credited', false);
  END IF;

  -- 5. Recompute user total points directly from ledger sum in the same atomic transaction
  SELECT
    GREATEST(0, COALESCE(SUM(
      CASE
        WHEN entry_type = 'credit' AND status = 'confirmed' THEN ABS(points)
        WHEN entry_type IN ('reversal', 'debit') AND status IN ('confirmed', 'reversed') THEN -ABS(points)
        ELSE 0
      END
    ), 0)),
    GREATEST(0, COALESCE(SUM(
      CASE
        WHEN entry_type = 'credit' AND status = 'confirmed' THEN ABS(points)
        WHEN entry_type = 'reversal' AND status IN ('confirmed', 'reversed') THEN -ABS(points)
        ELSE 0
      END
    ), 0))
  INTO v_new_total_points, v_new_total_earned
  FROM public.reward_ledger
  WHERE user_id = v_user_id;

  UPDATE public.users
  SET
    points = v_new_total_points,
    balance_cents = GREATEST(0, ROUND(v_new_total_points::NUMERIC / 100)::INTEGER),
    total_earned_points = v_new_total_earned,
    updated_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'credited', (p_status = 1),
    'reversed', (p_status = 2),
    'user_id', v_user_id,
    'points_delta', CASE WHEN p_status = 2 THEN -v_points ELSE v_points END,
    'new_total_points', v_new_total_points
  );
END;
$$;


