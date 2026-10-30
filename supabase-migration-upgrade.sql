-- ============================================================================
-- REWARD RIVER (rewardriver.online) - LIVE-SITE ADDITIVE MIGRATION SQL
-- Safe, non-destructive upgrade: Points Accuracy + Team System + RBAC + Impersonation
-- Timezone: Asia/Karachi (PKT, UTC+5)
-- Rules: 100% ADDITIVE (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS)
--        Never drops, renames, or truncates existing tables, columns, or user data.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. ADDITIVE UPGRADES TO EXISTING public.users TABLE & public.profiles TABLE
-- ============================================================================
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS total_points BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- Relax role check on public.users if an old constraint existed, to allow 'user' | 'manager' | 'admin'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_check' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_role_check;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE IF EXISTS public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'manager', 'admin'));

-- Create public.profiles table (synced with public.users for Supabase Auth & RLS compatibility)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'manager', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  total_points BIGINT NOT NULL DEFAULT 0,
  external_opaque_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill profiles from existing public.users without overwriting existing profile data
INSERT INTO public.profiles (
  id, email, full_name, phone, role, status, total_points, external_opaque_id, created_at, last_active_at
)
SELECT
  u.id,
  u.email,
  COALESCE(u.full_name, u.display_name, split_part(u.email, '@', 1)),
  COALESCE(u.whatsapp_number, u.phone_number),
  CASE WHEN u.role IN ('user', 'manager', 'admin') THEN u.role ELSE 'user' END,
  COALESCE(u.status, 'active'),
  COALESCE(u.points, 0),
  u.external_opaque_id,
  COALESCE(u.created_at, NOW()),
  COALESCE(u.last_active_at, u.updated_at, u.created_at, NOW())
FROM public.users u
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
  total_points = GREATEST(public.profiles.total_points, EXCLUDED.total_points),
  external_opaque_id = COALESCE(public.profiles.external_opaque_id, EXCLUDED.external_opaque_id);

-- ============================================================================
-- 2. SURVEY COMPLETIONS TABLE (Additive, preserves task_completions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.survey_completions (
  id TEXT PRIMARY KEY DEFAULT ('sc_' || gen_random_uuid()::text),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trans_id TEXT UNIQUE NOT NULL,
  offer_id TEXT,
  provider TEXT NOT NULL DEFAULT 'cpx',
  status TEXT NOT NULL CHECK (status IN ('completed', 'reversed', 'screenout', 'bonus')),
  amount_usd NUMERIC(12, 4) NOT NULL DEFAULT 0,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_at TIMESTAMPTZ
);

-- ============================================================================
-- 3. ADDITIVE UPGRADES TO public.reward_ledger & public.points_ledger
-- ============================================================================
ALTER TABLE IF EXISTS public.reward_ledger
  ADD COLUMN IF NOT EXISTS completion_id TEXT,
  ADD COLUMN IF NOT EXISTS points INTEGER,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Recreate view public.points_ledger to expose exact required columns
CREATE OR REPLACE VIEW public.points_ledger AS
SELECT
  id,
  user_id,
  COALESCE(completion_id, provider_tx_id) AS completion_id,
  provider_tx_id,
  COALESCE(task_id, 'task_cpx_survey') AS task_id,
  CASE
    WHEN entry_type IN ('debit', 'reversal') OR status = 'reversed'
      THEN -ABS(COALESCE(points, amount_cents * 100))
    ELSE ABS(COALESCE(points, amount_cents * 100))
  END AS points,
  amount_cents,
  gross_cents,
  admin_profit_cents,
  entry_type,
  status,
  COALESCE(
    reason,
    CASE
      WHEN entry_type = 'reversal' THEN 'cpx_reversal'
      WHEN task_id = 'team_bonus' THEN 'team_bonus'
      WHEN task_id = 'admin_manual_adjustment' THEN 'manual_adjustment'
      WHEN provider_tx_id LIKE 'backfill_%' THEN 'backfill'
      ELSE 'cpx_complete'
    END
  ) AS reason,
  description,
  COALESCE(approved_by, 'System S2S Verification') AS approved_by,
  created_at
FROM public.reward_ledger;

-- ============================================================================
-- 4. CALLBACK LOGS TABLE (Every incoming CPX / S2S callback attempt)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.callback_logs (
  id TEXT PRIMARY KEY DEFAULT ('cb_' || gen_random_uuid()::text),
  provider TEXT NOT NULL DEFAULT 'cpx',
  raw_query TEXT,
  ip TEXT,
  trans_id TEXT,
  ext_user_id TEXT,
  status_logged TEXT NOT NULL CHECK (status_logged IN ('credited', 'duplicate', 'bad_hash', 'unknown_user', 'reversed', 'error')),
  points_delta INTEGER NOT NULL DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. SETTINGS TABLE (Key-Value Feature Flags & Conversion Rates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- Seed required settings & feature flags (default OFF for new features per Live-Site Safety Rule 6)
INSERT INTO public.settings (key, value, updated_at, updated_by)
VALUES
  ('points_per_usd', '5000'::jsonb, NOW(), 'system_migration'),
  ('user_share_percent', '50'::jsonb, NOW(), 'system_migration'),
  ('new_user_days', '7'::jsonb, NOW(), 'system_migration'),
  ('timezone', '"Asia/Karachi"'::jsonb, NOW(), 'system_migration'),
  ('team_system_enabled', 'false'::jsonb, NOW(), 'system_migration'),
  ('managers_can_create_teams', 'false'::jsonb, NOW(), 'system_migration'),
  ('max_teams_per_manager', '5'::jsonb, NOW(), 'system_migration'),
  ('team_bonus_enabled', 'false'::jsonb, NOW(), 'system_migration'),
  ('team_bonus_percent', '0'::jsonb, NOW(), 'system_migration')
ON CONFLICT (key) DO NOTHING;

-- Also add additive columns to public.system_settings for backward compatibility
ALTER TABLE IF EXISTS public.system_settings
  ADD COLUMN IF NOT EXISTS new_user_days INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
  ADD COLUMN IF NOT EXISTS team_system_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS managers_can_create_teams BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_teams_per_manager INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS team_bonus_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS team_bonus_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

-- ============================================================================
-- 6. TEAMS & TEAM MEMBERS TABLES (One Manager -> Many Teams, One Team per User)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY DEFAULT ('team_' || gen_random_uuid()::text),
  name TEXT NOT NULL,
  team_code TEXT UNIQUE NOT NULL,
  manager_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  description TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id TEXT PRIMARY KEY DEFAULT ('tm_' || gen_random_uuid()::text),
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id TEXT UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_via_code TEXT NOT NULL,
  consent_accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. IMPERSONATION SESSIONS & UPGRADED AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id TEXT PRIMARY KEY DEFAULT ('imp_' || gen_random_uuid()::text),
  admin_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  ip TEXT,
  user_agent TEXT
);

ALTER TABLE IF EXISTS public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS target_type TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS before_state JSONB,
  ADD COLUMN IF NOT EXISTS after_state JSONB;

CREATE OR REPLACE VIEW public.audit_log AS
SELECT
  id,
  COALESCE(actor_id, admin_user_id) AS actor_id,
  admin_user_id,
  admin_email,
  action,
  COALESCE(target_type, target_entity) AS target_type,
  target_entity,
  target_id,
  before_state AS "before",
  after_state AS "after",
  COALESCE(reason, details) AS reason,
  details,
  ip_address AS ip,
  created_at
FROM public.admin_audit_logs;

-- ============================================================================
-- 8. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_completions_user_created ON public.survey_completions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_completions_trans_id ON public.survey_completions(trans_id);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_user_created ON public.reward_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_callback_logs_created_at ON public.callback_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_callback_logs_status ON public.callback_logs(status_logged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teams_manager_id ON public.teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_teams_team_code ON public.teams(team_code);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_admin_target ON public.impersonation_sessions(admin_id, target_user_id);

-- ============================================================================
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.callback_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS role & team checks
CREATE OR REPLACE FUNCTION public.is_admin_user(uid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = uid AND (role = 'admin' OR id = 'usr_admin_rewardriver' OR lower(email) = 'admin@reward-river')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of_user(manager_uid TEXT, member_uid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE t.manager_id = manager_uid
      AND tm.user_id = member_uid
  );
$$;

-- Profiles RLS: Own profile, or manager of member (read-only), or admin (all)
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT USING (
    auth.uid()::text = id
    OR public.is_manager_of_user(auth.uid()::text, id)
    OR public.is_admin_user(auth.uid()::text)
  );

DROP POLICY IF EXISTS profiles_service_all ON public.profiles;
CREATE POLICY profiles_service_all ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Survey completions RLS: Own rows, or manager of member (read-only), or admin
DROP POLICY IF EXISTS survey_completions_select_policy ON public.survey_completions;
CREATE POLICY survey_completions_select_policy ON public.survey_completions
  FOR SELECT USING (
    auth.uid()::text = user_id
    OR public.is_manager_of_user(auth.uid()::text, user_id)
    OR public.is_admin_user(auth.uid()::text)
  );

DROP POLICY IF EXISTS survey_completions_service_all ON public.survey_completions;
CREATE POLICY survey_completions_service_all ON public.survey_completions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Teams RLS: Manager sees own teams, members see their joined team, admin sees all
DROP POLICY IF EXISTS teams_select_policy ON public.teams;
CREATE POLICY teams_select_policy ON public.teams
  FOR SELECT USING (
    manager_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = id AND tm.user_id = auth.uid()::text)
    OR public.is_admin_user(auth.uid()::text)
  );

DROP POLICY IF EXISTS teams_service_all ON public.teams;
CREATE POLICY teams_service_all ON public.teams
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Team members RLS: Member sees own membership, manager sees members of own teams, admin sees all
DROP POLICY IF EXISTS team_members_select_policy ON public.team_members;
CREATE POLICY team_members_select_policy ON public.team_members
  FOR SELECT USING (
    user_id = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.manager_id = auth.uid()::text)
    OR public.is_admin_user(auth.uid()::text)
  );

DROP POLICY IF EXISTS team_members_service_all ON public.team_members;
CREATE POLICY team_members_service_all ON public.team_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Callback logs, settings, impersonation_sessions: Admin & service_role only
DROP POLICY IF EXISTS callback_logs_admin_select ON public.callback_logs;
CREATE POLICY callback_logs_admin_select ON public.callback_logs
  FOR SELECT USING (public.is_admin_user(auth.uid()::text));

DROP POLICY IF EXISTS callback_logs_service_all ON public.callback_logs;
CREATE POLICY callback_logs_service_all ON public.callback_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS settings_admin_select ON public.settings;
CREATE POLICY settings_admin_select ON public.settings
  FOR SELECT USING (public.is_admin_user(auth.uid()::text));

DROP POLICY IF EXISTS settings_service_all ON public.settings;
CREATE POLICY settings_service_all ON public.settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS impersonation_admin_select ON public.impersonation_sessions;
CREATE POLICY impersonation_admin_select ON public.impersonation_sessions
  FOR SELECT USING (public.is_admin_user(auth.uid()::text));

DROP POLICY IF EXISTS impersonation_service_all ON public.impersonation_sessions;
CREATE POLICY impersonation_service_all ON public.impersonation_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 10. ATOMIC CPX POSTBACK & TEAM BONUS RPC FUNCTION (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_cpx_postback(
  p_trans_id TEXT,
  p_ext_user_id TEXT,
  p_offer_id TEXT DEFAULT 'cpx_survey',
  p_amount_usd NUMERIC DEFAULT 0,
  p_status INTEGER DEFAULT 1,
  p_approved_by TEXT DEFAULT 'CPX S2S Postback',
  p_ip TEXT DEFAULT NULL,
  p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id TEXT;
  v_rate INTEGER := 5000;
  v_share INTEGER := 50;
  v_team_bonus_enabled BOOLEAN := FALSE;
  v_team_bonus_percent NUMERIC := 0;
  v_points INTEGER := 0;
  v_user_cents INTEGER := 0;
  v_gross_cents INTEGER := 0;
  v_profit_cents INTEGER := 0;
  v_existing_credit RECORD;
  v_new_available_points BIGINT := 0;
  v_new_total_earned BIGINT := 0;
  v_withdrawn_points BIGINT := 0;
  v_completion_id TEXT;
  v_manager_id TEXT;
  v_bonus_points INTEGER := 0;
BEGIN
  -- 1. Resolve matching user by id or external_opaque_id
  SELECT id INTO v_user_id
  FROM public.users
  WHERE id = p_ext_user_id OR external_opaque_id = p_ext_user_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO public.callback_logs (provider, raw_query, ip, trans_id, ext_user_id, status_logged, points_delta, details)
    VALUES ('cpx', p_raw_payload::text, p_ip, p_trans_id, p_ext_user_id, 'unknown_user', 0, p_raw_payload);
    RETURN jsonb_build_object('outcome', 'unknown_user', 'points_delta', 0);
  END IF;

  -- 2. Read conversion rate & team bonus settings
  SELECT COALESCE(points_rate_per_usd, 5000), COALESCE(default_user_share_percent, 50),
         COALESCE(team_bonus_enabled, FALSE), COALESCE(team_bonus_percent, 0)
  INTO v_rate, v_share, v_team_bonus_enabled, v_team_bonus_percent
  FROM public.system_settings
  WHERE id = 'global'
  LIMIT 1;

  -- Override from key-value settings table if present
  SELECT COALESCE((value::text)::integer, v_rate) INTO v_rate
  FROM public.settings WHERE key = 'points_per_usd';

  SELECT COALESCE((value::text)::boolean, v_team_bonus_enabled) INTO v_team_bonus_enabled
  FROM public.settings WHERE key = 'team_bonus_enabled';

  SELECT COALESCE((value::text)::numeric, v_team_bonus_percent) INTO v_team_bonus_percent
  FROM public.settings WHERE key = 'team_bonus_percent';

  v_points := GREATEST(1, ROUND(COALESCE(p_amount_usd, 0) * v_rate)::INTEGER);
  v_gross_cents := GREATEST(1, ROUND(COALESCE(p_amount_usd, 0) * 100)::INTEGER);
  v_user_cents := GREATEST(1, ROUND((v_points::NUMERIC / v_rate) * (v_share::NUMERIC / 100) * 100)::INTEGER);
  v_profit_cents := GREATEST(0, v_gross_cents - v_user_cents);

  -- 3. Handle Reversal / Canceled Status (status = 2)
  IF p_status = 2 THEN
    SELECT * INTO v_existing_credit
    FROM public.reward_ledger
    WHERE provider_tx_id = p_trans_id AND entry_type = 'credit' AND status = 'confirmed'
    LIMIT 1;

    IF v_existing_credit IS NULL THEN
      INSERT INTO public.callback_logs (provider, raw_query, ip, trans_id, ext_user_id, status_logged, points_delta, details)
      VALUES ('cpx', p_raw_payload::text, p_ip, p_trans_id, p_ext_user_id, 'reversed', 0, jsonb_build_object('note', 'reversal_ignored_not_credited'));
      RETURN jsonb_build_object('outcome', 'reversal_ignored_not_credited', 'points_delta', 0);
    END IF;

    IF EXISTS (SELECT 1 FROM public.reward_ledger WHERE provider_tx_id = (p_trans_id || '_rev')) THEN
      INSERT INTO public.callback_logs (provider, raw_query, ip, trans_id, ext_user_id, status_logged, points_delta, details)
      VALUES ('cpx', p_raw_payload::text, p_ip, p_trans_id, p_ext_user_id, 'duplicate', 0, jsonb_build_object('note', 'duplicate_reversal'));
      RETURN jsonb_build_object('outcome', 'duplicate', 'points_delta', 0);
    END IF;

    UPDATE public.survey_completions
    SET status = 'reversed', reversed_at = NOW()
    WHERE trans_id = p_trans_id;

    INSERT INTO public.reward_ledger (
      id, user_id, completion_id, provider_tx_id, task_id, cpx_offer_id, reversal_ref,
      amount_cents, points, gross_cents, admin_profit_cents, applied_share_percent,
      entry_type, status, reason, approved_by, description, created_at, processed_at
    ) VALUES (
      'le_cpx_' || p_trans_id || '_rev',
      v_user_id,
      v_existing_credit.completion_id,
      p_trans_id || '_rev',
      'task_cpx_survey',
      p_offer_id,
      p_trans_id,
      v_existing_credit.amount_cents,
      -ABS(v_existing_credit.points),
      v_existing_credit.gross_cents,
      v_existing_credit.admin_profit_cents,
      v_share,
      'reversal',
      'confirmed',
      'cpx_reversal',
      p_approved_by,
      'CPX Survey #' || p_offer_id || ' Reversed (-' || ABS(v_existing_credit.points) || ' Pts)',
      NOW(),
      NOW()
    );

    -- Also reverse any manager team_bonus entry linked to this transaction
    FOR v_existing_credit IN
      SELECT * FROM public.reward_ledger
      WHERE provider_tx_id = (p_trans_id || '_teambonus') AND entry_type = 'credit'
    LOOP
      INSERT INTO public.reward_ledger (
        id, user_id, completion_id, provider_tx_id, task_id, cpx_offer_id, reversal_ref,
        amount_cents, points, gross_cents, admin_profit_cents, applied_share_percent,
        entry_type, status, reason, approved_by, description, created_at, processed_at
      ) VALUES (
        'le_cpx_' || p_trans_id || '_teambonus_rev',
        v_existing_credit.user_id,
        v_existing_credit.completion_id,
        p_trans_id || '_teambonus_rev',
        'team_bonus',
        p_offer_id,
        p_trans_id || '_teambonus',
        v_existing_credit.amount_cents,
        -ABS(v_existing_credit.points),
        0,
        0,
        v_share,
        'reversal',
        'confirmed',
        'team_bonus',
        p_approved_by,
        'Team Bonus Reversed for Survey #' || p_offer_id,
        NOW(),
        NOW()
      ) ON CONFLICT (provider_tx_id) DO NOTHING;
    END LOOP;
  ELSE
    -- 4. Handle Completed Status (status = 1) - Idempotent on trans_id
    IF EXISTS (SELECT 1 FROM public.reward_ledger WHERE provider_tx_id = p_trans_id) THEN
      INSERT INTO public.callback_logs (provider, raw_query, ip, trans_id, ext_user_id, status_logged, points_delta, details)
      VALUES ('cpx', p_raw_payload::text, p_ip, p_trans_id, p_ext_user_id, 'duplicate', 0, p_raw_payload);
      RETURN jsonb_build_object('outcome', 'duplicate', 'points_delta', 0);
    END IF;

    v_completion_id := 'sc_' || p_trans_id;

    INSERT INTO public.survey_completions (
      id, user_id, trans_id, offer_id, provider, status, amount_usd, points_awarded, ip, raw_payload, created_at
    ) VALUES (
      v_completion_id, v_user_id, p_trans_id, p_offer_id, 'cpx', 'completed', COALESCE(p_amount_usd, 0), v_points, p_ip, p_raw_payload, NOW()
    ) ON CONFLICT (trans_id) DO NOTHING;

    INSERT INTO public.reward_ledger (
      id, user_id, completion_id, provider_tx_id, task_id, cpx_offer_id,
      amount_cents, points, gross_cents, admin_profit_cents, applied_share_percent,
      entry_type, status, reason, approved_by, description, created_at, processed_at
    ) VALUES (
      'le_cpx_' || p_trans_id,
      v_user_id,
      v_completion_id,
      p_trans_id,
      'task_cpx_survey',
      p_offer_id,
      v_user_cents,
      v_points,
      v_gross_cents,
      v_profit_cents,
      v_share,
      'credit',
      'confirmed',
      'cpx_complete',
      p_approved_by,
      'CPX Research Survey #' || p_offer_id || ' Completed (+' || v_points || ' Pts)',
      NOW(),
      NOW()
    );

    -- Optional Team Bonus for Manager (if team_bonus_enabled = true and team_bonus_percent > 0)
    IF v_team_bonus_enabled AND v_team_bonus_percent > 0 THEN
      SELECT t.manager_id INTO v_manager_id
      FROM public.team_members tm
      JOIN public.teams t ON t.id = tm.team_id
      WHERE tm.user_id = v_user_id AND t.is_active = TRUE
      LIMIT 1;

      IF v_manager_id IS NOT NULL AND v_manager_id <> v_user_id THEN
        v_bonus_points := GREATEST(1, FLOOR(v_points * (v_team_bonus_percent / 100.0))::INTEGER);
        INSERT INTO public.reward_ledger (
          id, user_id, completion_id, provider_tx_id, task_id, cpx_offer_id,
          amount_cents, points, gross_cents, admin_profit_cents, applied_share_percent,
          entry_type, status, reason, approved_by, description, created_at, processed_at
        ) VALUES (
          'le_cpx_' || p_trans_id || '_teambonus',
          v_manager_id,
          v_completion_id,
          p_trans_id || '_teambonus',
          'team_bonus',
          p_offer_id,
          GREATEST(1, ROUND(v_bonus_points / 100.0)::INTEGER),
          v_bonus_points,
          0,
          0,
          v_share,
          'credit',
          'confirmed',
          'team_bonus',
          'System Team Bonus Engine',
          'Team Bonus (+' || v_bonus_points || ' Pts • ' || v_team_bonus_percent || '% of member survey #' || p_offer_id || ')',
          NOW(),
          NOW()
        ) ON CONFLICT (provider_tx_id) DO NOTHING;

        -- Update manager total points from ledger
        UPDATE public.users u
        SET points = COALESCE((
          SELECT SUM(CASE WHEN entry_type IN ('debit', 'reversal') THEN -ABS(points) ELSE ABS(points) END)
          FROM public.reward_ledger WHERE user_id = v_manager_id AND status = 'confirmed'
        ), 0),
        total_points = COALESCE((
          SELECT SUM(CASE WHEN entry_type IN ('debit', 'reversal') THEN -ABS(points) ELSE ABS(points) END)
          FROM public.reward_ledger WHERE user_id = v_manager_id AND status = 'confirmed'
        ), 0)
        WHERE u.id = v_manager_id;

        UPDATE public.profiles p
        SET total_points = COALESCE((SELECT points FROM public.users WHERE id = v_manager_id), 0)
        WHERE p.id = v_manager_id;
      END IF;
    END IF;
  END IF;

  -- 5. Recompute user's authoritative total points from ledger + withdrawals in the same transaction
  SELECT
    COALESCE(SUM(CASE WHEN status = 'confirmed' AND entry_type = 'credit' THEN ABS(points) ELSE 0 END), 0),
    COALESCE(SUM(CASE
      WHEN status = 'confirmed' AND entry_type = 'credit' THEN ABS(points)
      WHEN (status = 'confirmed' OR status = 'reversed') AND entry_type IN ('reversal', 'debit') THEN -ABS(points)
      ELSE 0
    END), 0)
  INTO v_new_total_earned, v_new_available_points
  FROM public.reward_ledger
  WHERE user_id = v_user_id;

  SELECT COALESCE(SUM(amount_cents * 100), 0)
  INTO v_withdrawn_points
  FROM public.withdrawal_requests
  WHERE user_id = v_user_id AND status IN ('requested', 'under_review', 'approved', 'processing', 'paid');

  v_new_available_points := GREATEST(0, v_new_available_points - v_withdrawn_points);

  UPDATE public.users
  SET
    points = v_new_available_points,
    total_points = v_new_available_points,
    total_earned_points = v_new_total_earned,
    balance_cents = ROUND(v_new_available_points / 100.0)::BIGINT,
    last_active_at = NOW(),
    updated_at = NOW()
  WHERE id = v_user_id;

  UPDATE public.profiles
  SET
    total_points = v_new_available_points,
    last_active_at = NOW()
  WHERE id = v_user_id;

  INSERT INTO public.callback_logs (provider, raw_query, ip, trans_id, ext_user_id, status_logged, points_delta, details)
  VALUES (
    'cpx',
    p_raw_payload::text,
    p_ip,
    p_trans_id,
    p_ext_user_id,
    CASE WHEN p_status = 2 THEN 'reversed' ELSE 'credited' END,
    CASE WHEN p_status = 2 THEN -v_points ELSE v_points END,
    p_raw_payload
  );

  RETURN jsonb_build_object(
    'outcome', CASE WHEN p_status = 2 THEN 'reversed' ELSE 'credited' END,
    'user_id', v_user_id,
    'points_delta', CASE WHEN p_status = 2 THEN -v_points ELSE v_points END,
    'available_points', v_new_available_points
  );
END;
$$;

COMMIT;
