-- ============================================================================
-- REWARD RIVER (rewardriver.online) - SAFE ROLLBACK SQL
-- Reverts only the newly added tables, views, and functions from the upgrade
-- without deleting any original users, reward_ledger, or withdrawal_requests!
-- ============================================================================

BEGIN;

-- 1. Disable new feature flags first so application routes revert to baseline behavior
UPDATE public.settings
SET value = 'false'::jsonb, updated_at = NOW()
WHERE key IN ('team_system_enabled', 'managers_can_create_teams', 'team_bonus_enabled');

UPDATE public.system_settings
SET
  team_system_enabled = FALSE,
  managers_can_create_teams = FALSE,
  team_bonus_enabled = FALSE,
  updated_at = NOW()
WHERE id = 'global';

-- 2. Drop helper RLS functions and newly added tables (in dependency order)
DROP TABLE IF EXISTS public.impersonation_sessions CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.callback_logs CASCADE;
DROP TABLE IF EXISTS public.survey_completions CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP FUNCTION IF EXISTS public.is_manager_of_user(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_user(TEXT) CASCADE;

-- 3. Restore baseline views for points_ledger and audit_log
CREATE OR REPLACE VIEW public.points_ledger AS
SELECT
  id,
  user_id,
  provider_tx_id AS completion_id,
  provider_tx_id,
  COALESCE(task_id, 'task_cpx_survey') AS task_id,
  CASE
    WHEN entry_type IN ('debit', 'reversal') OR status = 'reversed' THEN -ABS(points)
    ELSE ABS(points)
  END AS points,
  amount_cents,
  gross_cents,
  admin_profit_cents,
  entry_type,
  status,
  description AS reason,
  COALESCE(approved_by, 'System S2S Verification') AS approved_by,
  created_at
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

COMMIT;
