import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LedgerEntry, WithdrawalRecord, calculateUserBalances, isDuplicateTransaction } from '../src/utils/ledger';
export type { LedgerEntry };
import { usdCentsToPoints } from '../src/utils/usdt';
import {
  TaskDefinitionRecord,
  TaskCompletionRecord,
  classifyUserCohort,
  formatKarachiDateTime,
  verifyDataIntegrity,
  DataIntegrityReport
} from '../src/utils/adminStats';
export type { TaskDefinitionRecord, TaskCompletionRecord, DataIntegrityReport };
import {
  getActiveServerSupabase,
  defaultSupabaseUrl,
  defaultSupabaseAnonKey,
  defaultSupabaseServiceKey
} from './supabase';

const IS_UNIT_TEST_ENV =
  process.env.NODE_ENV === 'test' ||
  process.argv.some(arg => arg === '--test' || arg.endsWith('.test.ts'));


export interface UserAccount {
  id: string;
  username?: string;
  email: string;
  passwordHash: string;
  salt: string;
  displayName: string;
  emailVerified: boolean;
  role: 'user' | 'admin';
  externalOpaqueId: string; // Opaque ID for CPX survey sessions
  createdAt: string;
  updatedAt: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  photoURL?: string;
  countryCode?: string;
  hasPromptedPhone?: boolean;
  provider?: string;
  storedPoints?: number;
}

export interface WithdrawalRequestDoc {
  id: string;
  userId: string;
  userEmail: string;
  usdtAddress: string;
  network: 'TRC20' | 'ERC20';
  amountCents: number;
  feeCents: number;
  netCents: number;
  grossUsdt: string;
  feeUsdt: string;
  netUsdt: string;
  status: 'requested' | 'under_review' | 'approved' | 'processing' | 'paid' | 'rejected' | 'failed' | 'cancelled';
  txHash?: string;
  createdAt: string;
  updatedAt: string;
  reviewNotes?: string;
  reviewedBy?: string;
}

export interface WithdrawalEvent {
  id: string;
  withdrawalId: string;
  previousStatus: string;
  newStatus: string;
  actorUserId: string;
  reason?: string;
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: string;
  targetEntity: string;
  targetId: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

export interface SystemSettings {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceKey?: string;
  minWithdrawalCents: number;
  maxWithdrawalCents: number;
  feeCentsTrc20: number;
  feeCentsErc20: number;
  userSharePercent: number;
  pointsPerUsdt: number;
  surveyDisplayMode?: 'hybrid' | 'points_only';
  cpxAppId?: string;
  cpxHashKey?: string;
  cpxApiKey?: string;
  cpxIntegrationMode?: 'hybrid_api' | 'direct_wall' | 'paused';
  cpxMaxSurveys?: number;
  cpxThemeColor?: string;
  cpxEnableFallback?: boolean;
  cpxVerifySignature?: boolean;
  aoyApiKey?: string;
  aoySecretKey?: string;
  aoyBearerToken?: string;
  aoyExchangeRate?: number;
  aoyEnableFallback?: boolean;
  aoyVerifySignature?: boolean;
  maintenanceMode: boolean;
  defaultNetwork: 'TRC20' | 'ERC20';
  googleAnalyticsId?: string;
  googleAnalyticsEnabled?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogImageUrl?: string;
  googleSearchConsoleKey?: string;
  sitemapEnabled?: boolean;
  updatedAt: string;
}

export interface DatabaseSchema {
  users: UserAccount[];
  tasks: TaskDefinitionRecord[];
  taskCompletions: TaskCompletionRecord[];
  rewardLedger: LedgerEntry[];
  withdrawalRequests: WithdrawalRequestDoc[];
  withdrawalEvents: WithdrawalEvent[];
  systemSettings: SystemSettings;
  adminAuditLogs: AdminAuditLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'store.json');
const TMP_DB_FILE = '/tmp/reward-river-store.json';

class DatabaseStore {
  private data: DatabaseSchema;
  private initialized = false;
  private lastSupabaseSyncMs = 0;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.data = this.getDefaultData();
  }

  private getDefaultData(): DatabaseSchema {
    const nowIso = '2026-10-20T00:00:00.000Z';
    return {
      users: [],
      tasks: [
        {
          id: 'task_cpx_survey',
          title: 'CPX Research Verified Survey Completion',
          description: 'Full market research survey verified via cryptographic S2S postback (status=1). Point value scales dynamically at 5,000 Pts per $1.00 gross (50% user share).',
          taskType: 'survey',
          rewardPoints: 5000,
          isActive: true,
          dailyLimit: 50,
          createdAt: nowIso,
          updatedAt: nowIso
        },
        {
          id: 'task_cpx_screenout',
          title: 'CPX Research Survey Screenout Bonus',
          description: 'Qualification attempt / screenout participation bonus verified via S2S postback (status=2 & payout > 0).',
          taskType: 'survey',
          rewardPoints: 100,
          isActive: true,
          dailyLimit: 10,
          createdAt: nowIso,
          updatedAt: nowIso
        },
        {
          id: 'task_aoy_ptc',
          title: 'AdsOnYourPTC Sponsored Campaign Visit',
          description: 'Verified PTC campaign timer completion via AdsOnYourPTC wall.',
          taskType: 'ptc',
          rewardPoints: 150,
          isActive: true,
          dailyLimit: 25,
          createdAt: nowIso,
          updatedAt: nowIso
        },
        {
          id: 'task_aoy_shortlink',
          title: 'AdsOnYourPTC Verified Shortlink',
          description: 'Verified shortlink traversal and anti-bot check completion.',
          taskType: 'shortlink',
          rewardPoints: 250,
          isActive: true,
          dailyLimit: 20,
          createdAt: nowIso,
          updatedAt: nowIso
        },
        {
          id: 'task_daily_checkin',
          title: 'Daily Verified Earner Check-In',
          description: 'Daily active earner verification reward.',
          taskType: 'daily_checkin',
          rewardPoints: 100,
          isActive: true,
          dailyLimit: 1,
          createdAt: nowIso,
          updatedAt: nowIso
        },
        {
          id: 'task_profile_verify',
          title: 'Research Profile & Phone Verification',
          description: 'One-time bonus for completing full demographic and WhatsApp/Phone verification.',
          taskType: 'profile_verification',
          rewardPoints: 250,
          isActive: true,
          dailyLimit: 1,
          createdAt: nowIso,
          updatedAt: nowIso
        }
      ],
      taskCompletions: [],
      rewardLedger: [],
      withdrawalRequests: [],
      withdrawalEvents: [],
      systemSettings: {
        supabaseUrl: defaultSupabaseUrl,
        supabaseAnonKey: defaultSupabaseAnonKey,
        supabaseServiceKey: defaultSupabaseServiceKey,
        minWithdrawalCents: 2500, // $25.00 min (250,000 Points at 10,000 Pts = $1.00)
        maxWithdrawalCents: 50000, // $500.00 max (5,000,000 Points)
        feeCentsTrc20: 100, // $1.00 USDT fee for TRC-20
        feeCentsErc20: 250, // $2.50 USDT fee for ERC-20
        userSharePercent: 50, // 50% user payout (10,000 Pts = $1.00), 50% admin profit margin
        pointsPerUsdt: 5000, // CPX Currency Factor: 5,000 Points = $1.00 Gross
        surveyDisplayMode: 'points_only',
        cpxAppId: process.env.CPX_APP_ID || '37699',
        cpxHashKey: process.env.CPX_HASH_KEY || '1u8hIFGwUYYORM76NM76PDxenCC50bCZ',
        cpxApiKey: process.env.CPX_API_KEY || '2578500163e1998b3c8929e261a3e095',
        cpxIntegrationMode: 'hybrid_api',
        cpxMaxSurveys: 12,
        cpxThemeColor: '10b981',
        cpxEnableFallback: false,
        cpxVerifySignature: true,
        aoyApiKey: process.env.AOY_API_KEY || '223f26cc088f5bab7b79022b1d728e7d45106754ea0d38aa',
        aoySecretKey: process.env.AOY_SECRET_KEY || '8541bec43fd15ef8996554a07ef7c8942300227cecfdbe6408e26969c77b4e92',
        aoyBearerToken: process.env.AOY_BEARER_TOKEN || '',
        aoyExchangeRate: 10000,
        aoyEnableFallback: false,
        aoyVerifySignature: true,
        maintenanceMode: false,
        defaultNetwork: 'TRC20',
        googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID || 'G-REWARDRIVER1',
        googleAnalyticsEnabled: true,
        metaTitle: 'Reward River - Real Opinions. Real Value.',
        metaDescription: 'Discover available research surveys, share verified opinions, and earn Points.',
        metaKeywords: 'surveys, cpx research, paid surveys, market research, reward points',
        ogImageUrl: '/favicon.svg',
        googleSearchConsoleKey: '',
        sitemapEnabled: true,
        updatedAt: '2026-10-20T00:00:00.000Z'
      },
      adminAuditLogs: []
    };
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
      let fileContent: string | null = null;
      if (process.env.VERCEL) {
        try {
          fileContent = await fs.readFile(TMP_DB_FILE, 'utf-8');
        } catch {
          // fallback to bundled store.json
        }
      }
      if (!fileContent) {
        try {
          fileContent = await fs.readFile(DB_FILE, 'utf-8');
        } catch {
          fileContent = null;
        }
      }

      if (fileContent) {
        const parsed = JSON.parse(fileContent);
        const rawCpxHash = String(parsed.systemSettings?.cpxHashKey || '').trim();
        const validCpxHash =
          rawCpxHash && !rawCpxHash.startsWith('eyJ')
            ? rawCpxHash
            : '1u8hIFGwUYYORM76NM76PDxenCC50bCZ';

        const isMockOrTestTx = (txId?: string | null, desc?: string | null, id?: string | null) => {
          const clean = String(txId || '').trim().toLowerCase();
          const d = String(desc || '').trim().toLowerCase();
          const eid = String(id || '').trim().toLowerCase();
          if (!clean) return true;
          return (
            clean.startsWith('cpx_survey_') ||
            clean.startsWith('sim_cpx_') ||
            clean.startsWith('factor_test') ||
            clean.startsWith('cpx_verify_') ||
            clean.startsWith('diag_') ||
            clean.startsWith('sync_bal_') ||
            eid.startsWith('le_sync_') ||
            d.includes('verified survey rewards balance') ||
            d.includes('offer #cpx') ||
            d.includes('#cpx_test_') ||
            d.includes('#factor_test') ||
            d.includes('#19129457')
          );
        };

        const isMockOrTestUser = (email?: string | null, username?: string | null) => {
          const e = String(email || '').trim().toLowerCase();
          const u = String(username || '').trim().toLowerCase();
          return (
            e === 'gojolag383@ofags.com' ||
            e === 'erterrtwe@gmail.com' ||
            e === 'fdsgsdfg@gmail.com' ||
            e === 'admin@rewardriver.com' ||
            e === 'admin@rewardriver' ||
            e === 'survey_tester@example.com' ||
            e === 'points_user@example.com' ||
            e === 'river_earner@gmail.com' ||
            e === 'testmath1@gmail.com' ||
            e === 'testmath2@gmail.com' ||
            e === 'freshuser999@gmail.com' ||
            u === 'gojolag383' ||
            u === 'erterrtwe' ||
            u === 'fsegsegs'
          );
        };

        const normalizeUserRecord = (u: UserAccount): UserAccount => {
          let email = String(u.email || '').trim().toLowerCase();
          let display = String(u.displayName || u.username || email.split('@')[0]).trim();

          const rawExt = String(u.externalOpaqueId || '');
          const isEmailText = rawExt.includes('@') || rawExt.includes('gmail.com') || rawExt.length < 6;
          const cleanUuid = String(u.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
          const cleanExtId = (!isEmailText && (rawExt.startsWith('rr_cpx_') || rawExt.length >= 10))
            ? rawExt
            : `rr_cpx_${cleanUuid || crypto.randomBytes(12).toString('hex')}`;

          return {
            ...u,
            email,
            username: display,
            displayName: display,
            externalOpaqueId: cleanExtId
          };
        };

        const normalizeLedgerRecord = (l: LedgerEntry): LedgerEntry => {
          const desc = String(l.description || '');
          const ptsMatch = desc.match(/\+?([\d,]+)\s*(?:Pts|Points)/i);
          const parsedPts = ptsMatch ? Number(ptsMatch[1].replace(/,/g, '')) : NaN;
          const rawPoints = Math.max(
            0,
            Number(l.points) || (!isNaN(parsedPts) && parsedPts > 0 ? Math.round(parsedPts) : 0)
          );
          const rawAmountCents = Math.max(0, Number(l.amountCents) || 0);
          const points = rawPoints > 0 ? rawPoints : Math.max(50, rawAmountCents * 100);
          // User redemption rate: 10,000 Points = $1.00 USD (100 Points = 1 cent)
          const userAmountCents = Math.max(1, Math.round(points / 100));
          // CPX gross cents: 5,000 Points = $1.00 Gross (50 Points = 1 gross cent)
          const grossCents = Math.max(
            userAmountCents,
            Math.round((points / 5000) * 100)
          );
          const adminProfitCents = Math.max(0, grossCents - userAmountCents);
          const cleanDesc = desc.replace(
            /\+\d[\d,]*\s*Pts/i,
            `+${points.toLocaleString('en-US')} Pts`
          );
          return {
            ...l,
            points,
            amountCents: userAmountCents,
            grossCents,
            adminProfitCents,
            appliedSharePercent: 50,
            description: cleanDesc
          };
        };

        this.data = {
          ...this.getDefaultData(),
          ...parsed,
          users: ((parsed.users || this.getDefaultData().users) as UserAccount[])
            .filter(u => !isMockOrTestUser(u?.email, u?.username))
            .map(normalizeUserRecord),
          tasks: Array.isArray(parsed.tasks) && parsed.tasks.length > 0
            ? parsed.tasks
            : this.getDefaultData().tasks,
          taskCompletions: Array.isArray(parsed.taskCompletions)
            ? parsed.taskCompletions
            : [],
          rewardLedger: (parsed.rewardLedger || [])
            .filter((l: LedgerEntry) => !isMockOrTestTx(l?.providerTxId, l?.description, l?.id))
            .map(normalizeLedgerRecord),
          withdrawalRequests: parsed.withdrawalRequests || [],
          withdrawalEvents: parsed.withdrawalEvents || [],
          systemSettings: {
            ...this.getDefaultData().systemSettings,
            ...(parsed.systemSettings || {}),
            cpxAppId: parsed.systemSettings?.cpxAppId || '37699',
            cpxHashKey: validCpxHash,
            pointsPerUsdt: 5000,
            userSharePercent: 50,
            aoyApiKey: parsed.systemSettings?.aoyApiKey || process.env.AOY_API_KEY || '223f26cc088f5bab7b79022b1d728e7d45106754ea0d38aa',
            aoySecretKey: parsed.systemSettings?.aoySecretKey || process.env.AOY_SECRET_KEY || '8541bec43fd15ef8996554a07ef7c8942300227cecfdbe6408e26969c77b4e92',
            minWithdrawalCents: 2500
          },
          adminAuditLogs: parsed.adminAuditLogs || []
        };
        await this.persist();
      } else {
        await this.persist();
      }

      await this.syncFromSupabase();
      this.initialized = true;
    } catch (e) {
      console.error('Failed to initialize database:', e);
      this.initialized = true;
    }
  }

  getSupabaseClient() {
    if (IS_UNIT_TEST_ENV) return null;
    const s = this.data?.systemSettings;
    return getActiveServerSupabase(s?.supabaseUrl, s?.supabaseServiceKey);
  }

  async syncFromSupabase(force = false): Promise<void> {
    if (IS_UNIT_TEST_ENV) return;
    const now = Date.now();
    if (!force && this.lastSupabaseSyncMs > 0 && now - this.lastSupabaseSyncMs < 2500) {
      return;
    }
    this.lastSupabaseSyncMs = now;

    const sb = this.getSupabaseClient();
    if (!sb) return;

    const isMockOrTestTx = (txId?: string | null, desc?: string | null, id?: string | null) => {
      const clean = String(txId || '').trim().toLowerCase();
      const d = String(desc || '').trim().toLowerCase();
      const eid = String(id || '').trim().toLowerCase();
      if (!clean) return true;
      return (
        clean.startsWith('cpx_survey_') ||
        clean.startsWith('sim_cpx_') ||
        clean.startsWith('factor_test') ||
        clean.startsWith('cpx_verify_') ||
        clean.startsWith('diag_') ||
        clean.startsWith('sync_bal_') ||
        eid.startsWith('le_sync_') ||
        d.includes('verified survey rewards balance') ||
        d.includes('offer #cpx') ||
        d.includes('#cpx_test_') ||
        d.includes('#factor_test') ||
        d.includes('#19129457')
      );
    };

    const isMockOrTestUser = (email?: string | null, username?: string | null) => {
      const e = String(email || '').trim().toLowerCase();
      const u = String(username || '').trim().toLowerCase();
      return (
        e === 'gojolag383@ofags.com' ||
        e === 'erterrtwe@gmail.com' ||
        e === 'fdsgsdfg@gmail.com' ||
        e === 'admin@rewardriver.com' ||
        e === 'admin@rewardriver' ||
        e === 'survey_tester@example.com' ||
        e === 'points_user@example.com' ||
        e === 'river_earner@gmail.com' ||
        e === 'testmath1@gmail.com' ||
        e === 'testmath2@gmail.com' ||
        e === 'freshuser999@gmail.com' ||
        u === 'gojolag383' ||
        u === 'erterrtwe' ||
        u === 'fsegsegs'
      );
    };

    const normalizeIdentity = (_extId: string, rawEmail: string, rawDisplay: string) => {
      let email = String(rawEmail || '').trim().toLowerCase();
      let display = String(rawDisplay || email.split('@')[0]).replace(/\s*\(Super Admin\)/i, '').trim();
      return { email, display };
    };

    try {
      const { data: sbUsers } = await sb.from('users').select('*');

      let sbLedger: any[] | null = null;
      const { data: rlData, error: rlError } = await sb.from('reward_ledger').select('*');
      if (!rlError && Array.isArray(rlData)) {
        sbLedger = rlData;
      }

      let changed = false;

      // 1. Sync System Settings from Supabase (Global Platform Configuration)
      const { data: sbSettings, error: settingsError } = await sb.from('system_settings').select('*').eq('id', 'global').single();
      if (!settingsError && sbSettings) {
        const current = this.data.systemSettings;
        const sbMinW = Number(sbSettings.min_withdrawal_cents);
        const sbPtsRate = Number(sbSettings.points_rate_per_usd);
        const sbShare = Number(sbSettings.default_user_share_percent);

        const newSettings: SystemSettings = {
          ...current,
          supabaseUrl: current.supabaseUrl || defaultSupabaseUrl,
          supabaseAnonKey: current.supabaseAnonKey || defaultSupabaseAnonKey,
          supabaseServiceKey: current.supabaseServiceKey || defaultSupabaseServiceKey,
          minWithdrawalCents: sbMinW >= 2500 ? sbMinW : 2500,
          maxWithdrawalCents: Number(sbSettings.max_withdrawal_cents) || current.maxWithdrawalCents || 50000,
          feeCentsTrc20: Number(sbSettings.fee_cents_trc20) ?? current.feeCentsTrc20,
          feeCentsErc20: Number(sbSettings.fee_cents_erc20) ?? current.feeCentsErc20,
          pointsPerUsdt: sbPtsRate === 5000 ? 5000 : (current.pointsPerUsdt || 5000),
          userSharePercent: sbShare === 50 ? 50 : (current.userSharePercent || 50),
          maintenanceMode: Boolean(sbSettings.maintenance_mode),
          cpxAppId: sbSettings.cpx_app_id || current.cpxAppId,
          cpxHashKey: sbSettings.cpx_hash_key || current.cpxHashKey,
          cpxApiKey: sbSettings.cpx_api_key || current.cpxApiKey,
          cpxIntegrationMode: (sbSettings.cpx_integration_mode as any) || current.cpxIntegrationMode,
          cpxMaxSurveys: Number(sbSettings.cpx_max_surveys) || current.cpxMaxSurveys,
          cpxThemeColor: sbSettings.cpx_theme_color || current.cpxThemeColor,
          cpxEnableFallback: sbSettings.cpx_enable_fallback ?? current.cpxEnableFallback,
          cpxVerifySignature: sbSettings.cpx_verify_signature ?? current.cpxVerifySignature,
          aoyApiKey: sbSettings.aoy_api_key || current.aoyApiKey,
          aoySecretKey: sbSettings.aoy_secret_key || current.aoySecretKey,
          aoyBearerToken: sbSettings.aoy_bearer_token || current.aoyBearerToken,
          aoyExchangeRate: Number(sbSettings.aoy_exchange_rate) || current.aoyExchangeRate,
          metaTitle: sbSettings.meta_title || current.metaTitle,
          metaDescription: sbSettings.meta_description || current.metaDescription,
          updatedAt: sbSettings.updated_at || new Date().toISOString()
        };

        if (JSON.stringify(newSettings) !== JSON.stringify(current)) {
          this.data.systemSettings = newSettings;
          changed = true;
        }
      }

      // 2. Purge Mock/Test Users and Sync Real Users (unifying canonical Supabase ID)
      const beforeUserCount = this.data.users.length;
      this.data.users = this.data.users.filter(u => !isMockOrTestUser(u.email, u.username));
      if (this.data.users.length !== beforeUserCount) {
        changed = true;
      }

      if (Array.isArray(sbUsers)) {
        for (const row of sbUsers) {
          if (!row || !row.id || !row.email) continue;
          const rawEmailLower = String(row.email).trim().toLowerCase();

          if (isMockOrTestUser(rawEmailLower, row.display_name || row.username)) {
            await sb.from('reward_ledger').delete().eq('user_id', row.id);
            await sb.from('users').delete().eq('id', row.id);
            changed = true;
            continue;
          }

          const isSoleAdmin =
            row.id === 'usr_admin_rewardriver' || rawEmailLower === 'admin@reward-river';
          const effectiveRole: 'user' | 'admin' = isSoleAdmin ? 'admin' : 'user';

          const cleanUuid = String(row.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
          const rawExt = String(row.external_opaque_id || '');
          const isEmailText = rawExt.includes('@') || rawExt.includes('gmail.com') || rawExt.length < 6;
          const cleanExtId = (!isEmailText && (rawExt.startsWith('rr_cpx_') || rawExt.length >= 10))
            ? rawExt
            : `rr_cpx_${cleanUuid || crypto.randomBytes(12).toString('hex')}`;

          const { email: emailLower, display } = normalizeIdentity(
            cleanExtId,
            rawEmailLower,
            String(row.display_name || rawEmailLower.split('@')[0])
          );

          const existingIdx = this.data.users.findIndex(
            u => u.id === row.id || u.email.toLowerCase() === emailLower || u.externalOpaqueId === cleanExtId
          );

          const sbRowPoints = typeof row.points === 'number' || (row.points !== null && row.points !== undefined)
            ? Math.max(0, Number(row.points) || 0)
            : undefined;

          if (existingIdx === -1) {
            this.data.users.push({
              id: String(row.id),
              username: display,
              email: emailLower,
              passwordHash: String(row.password_hash || ''),
              salt: String(row.salt || ''),
              displayName: display,
              emailVerified: row.email_verified !== false,
              role: effectiveRole,
              externalOpaqueId: cleanExtId,
              createdAt: row.created_at || new Date().toISOString(),
              updatedAt: row.updated_at || new Date().toISOString(),
              phoneNumber: row.phone_number || undefined,
              whatsappNumber: row.whatsapp_number || row.phone_number || undefined,
              countryCode: row.country_code || undefined,
              provider: row.provider || 'password',
              hasPromptedPhone: Boolean(row.has_prompted_phone),
              storedPoints: sbRowPoints
            });
            changed = true;
          } else {
            const current = this.data.users[existingIdx];
            const canonicalId = String(row.id);
            if (current.id !== canonicalId) {
              const oldId = current.id;
              this.data.users[existingIdx].id = canonicalId;
              for (const l of this.data.rewardLedger) {
                if (l.userId === oldId) l.userId = canonicalId;
              }
              for (const w of this.data.withdrawalRequests) {
                if (w.userId === oldId) w.userId = canonicalId;
              }
              changed = true;
            }
            if (current.externalOpaqueId !== cleanExtId && rawExt.startsWith('rr_cpx_')) {
              this.data.users[existingIdx].externalOpaqueId = cleanExtId;
              changed = true;
            }
            if (sbRowPoints !== undefined && current.storedPoints !== sbRowPoints) {
              this.data.users[existingIdx].storedPoints = sbRowPoints;
              changed = true;
            }
            if (current.email !== emailLower || current.displayName !== display) {
              this.data.users[existingIdx].email = emailLower;
              this.data.users[existingIdx].displayName = display;
              this.data.users[existingIdx].username = display;
              changed = true;
            }
            if (current.role !== effectiveRole) {
              this.data.users[existingIdx].role = effectiveRole;
              changed = true;
            }
            if (row.password_hash && row.salt && (!current.passwordHash || !current.salt)) {
              this.data.users[existingIdx].passwordHash = String(row.password_hash);
              this.data.users[existingIdx].salt = String(row.salt);
              changed = true;
            }
            if (!current.countryCode && row.country_code) {
              this.data.users[existingIdx].countryCode = row.country_code;
              changed = true;
            }
          }
        }

        const sbEmailSet = new Set(sbUsers.map((r: any) => String(r.email || '').trim().toLowerCase()));
        for (const localUser of this.data.users) {
          if (isMockOrTestUser(localUser.email, localUser.username)) continue;
          const emailLower = localUser.email.toLowerCase();
          if (!sbEmailSet.has(emailLower)) {
            await this.upsertUserToSupabase(localUser);
            sbEmailSet.add(emailLower);
          }
        }
      }

      // 3. Sync Reward Ledger from Supabase without halving points or keeping synthetic sync_bal_ entries!
      const beforeLen = this.data.rewardLedger.length;
      this.data.rewardLedger = this.data.rewardLedger.filter(
        l => !isMockOrTestTx(l.providerTxId, l.description, l.id)
      );
      if (this.data.rewardLedger.length !== beforeLen) {
        changed = true;
      }

      if (Array.isArray(sbLedger)) {
        for (const row of sbLedger) {
          if (!row || !row.id || !row.user_id) continue;
          if (isMockOrTestTx(row.provider_tx_id, row.description, row.id)) {
            await sb.from('reward_ledger').delete().eq('id', row.id);
            changed = true;
            continue;
          }

          const rawAmountCents = Math.max(0, Number(row.amount_cents) || 0);
          const desc = String(row.description || '');
          const ptsMatch = desc.match(/[+-]?([\d,]+)\s*(?:Pts|Points)/i);
          const parsedPts = ptsMatch ? Number(ptsMatch[1].replace(/,/g, '')) : NaN;
          // In reward_ledger, amount_cents is userAmountCents (where 100 Pts = 1 cent)
          const points =
            !isNaN(parsedPts) && parsedPts > 0
              ? Math.round(parsedPts)
              : Math.max(50, rawAmountCents * 100);
          const userAmountCents = Math.max(1, Math.round(points / 100));
          const grossCents = Math.max(userAmountCents, Math.round((points / 5000) * 100));
          const adminProfitCents = Math.max(0, grossCents - userAmountCents);
          const cleanDesc = desc
            ? desc.replace(/\+\d[\d,]*\s*Pts/i, `+${points.toLocaleString('en-US')} Pts`)
            : `CPX Research Survey #${row.provider_tx_id || row.id} (+${points.toLocaleString('en-US')} Pts)`;

          const existingIdx = this.data.rewardLedger.findIndex(
            l => l.id === row.id || (row.provider_tx_id && l.providerTxId === row.provider_tx_id)
          );

          if (existingIdx === -1) {
            this.data.rewardLedger.push({
              id: String(row.id),
              userId: String(row.user_id),
              providerTxId: String(row.provider_tx_id || row.id),
              amountCents: userAmountCents,
              points,
              grossCents,
              adminProfitCents,
              appliedSharePercent: 50,
              entryType: row.entry_type === 'reversal' ? 'reversal' : row.entry_type === 'debit' ? 'debit' : 'credit',
              status: row.status === 'pending' ? 'pending' : row.status === 'reversed' ? 'reversed' : 'confirmed',
              description: cleanDesc,
              createdAt: row.created_at || new Date().toISOString(),
              processedAt: row.created_at || new Date().toISOString()
            });
            changed = true;
          } else {
            const cur = this.data.rewardLedger[existingIdx];
            if (
              cur.points !== points ||
              cur.amountCents !== userAmountCents ||
              cur.grossCents !== grossCents ||
              cur.userId !== String(row.user_id)
            ) {
              this.data.rewardLedger[existingIdx] = {
                ...cur,
                userId: String(row.user_id),
                points,
                amountCents: userAmountCents,
                grossCents,
                adminProfitCents,
                appliedSharePercent: 50,
                description: cleanDesc
              };
              changed = true;
            }
          }
        }

        // Push any local ledger entries not yet in Supabase up to Supabase
        for (const localEntry of this.data.rewardLedger) {
          if (isMockOrTestTx(localEntry.providerTxId, localEntry.description, localEntry.id)) continue;
          const inSb = sbLedger.some(
            r => r.id === localEntry.id || (r.provider_tx_id && r.provider_tx_id === localEntry.providerTxId)
          );
          if (!inSb) {
            await sb.from('reward_ledger').upsert({
              id: localEntry.id,
              user_id: localEntry.userId,
              provider_tx_id: localEntry.providerTxId,
              amount_cents: localEntry.amountCents,
              entry_type: localEntry.entryType,
              status: localEntry.status,
              description:
                localEntry.description ||
                `CPX Research Survey #${localEntry.providerTxId} (+${(localEntry.points || 0).toLocaleString('en-US')} Pts)`,
              created_at: localEntry.createdAt
            });
          }
        }
      }

      // 4. Reconcile storedPoints on all users to match exact sum of their ledger entries
      for (const u of this.data.users) {
        const balances = this.getUserBalances(u.id);
        if (u.storedPoints !== balances.availablePoints) {
          u.storedPoints = balances.availablePoints;
          changed = true;
          if (sb) {
            try {
              await sb.from('users').update({
                points: balances.availablePoints,
                balance_cents: balances.availableCents,
                total_earned_points: balances.totalEarnedPoints,
                updated_at: new Date().toISOString()
              }).eq('id', u.id);
            } catch {
              // ignore
            }
          }
        }
      }

      // 5. Sync withdrawal requests from & to Supabase
      const { data: sbWithdrawals, error: sbWError } = await sb.from('withdrawal_requests').select('*');
      if (!sbWError && Array.isArray(sbWithdrawals)) {
        for (const row of sbWithdrawals) {
          if (!row || !row.id || !row.user_id) continue;
          const existingIdx = this.data.withdrawalRequests.findIndex(w => w.id === row.id);
          const userObj = this.getUserById(String(row.user_id));
          const amountCents = Number(row.amount_cents) || 2500;
          const feeCents = Number(row.fee_cents) || 100;
          const netCents = Math.max(0, Number(row.net_cents) || amountCents - feeCents);
          const mapped: WithdrawalRequestDoc = {
            id: String(row.id),
            userId: String(row.user_id),
            userEmail: String(row.user_email || userObj?.email || 'member@rewardriver.com'),
            usdtAddress: String(row.usdt_address || row.wallet_address || ''),
            network: row.network === 'ERC20' ? 'ERC20' : 'TRC20',
            amountCents,
            feeCents,
            netCents,
            grossUsdt: String(row.gross_usdt || (amountCents / 100).toFixed(2)),
            feeUsdt: String(row.fee_usdt || (feeCents / 100).toFixed(2)),
            netUsdt: String(row.net_usdt || (netCents / 100).toFixed(2)),
            status: (row.status as WithdrawalRequestDoc['status']) || 'requested',
            txHash: row.tx_hash || undefined,
            reviewNotes: row.review_notes || undefined,
            reviewedBy: row.reviewed_by || undefined,
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || row.created_at || new Date().toISOString()
          };
          if (existingIdx === -1) {
            this.data.withdrawalRequests.push(mapped);
            changed = true;
          } else {
            const cur = this.data.withdrawalRequests[existingIdx];
            if (
              cur.status !== mapped.status ||
              cur.txHash !== mapped.txHash ||
              cur.reviewNotes !== mapped.reviewNotes
            ) {
              this.data.withdrawalRequests[existingIdx] = {
                ...cur,
                ...mapped
              };
              changed = true;
            }
          }
        }

        // Push any local withdrawal requests not yet in Supabase
        for (const localW of this.data.withdrawalRequests) {
          const inSb = sbWithdrawals.some(r => r && r.id === localW.id);
          if (!inSb) {
            await sb.from('withdrawal_requests').upsert({
              id: localW.id,
              user_id: localW.userId,
              user_email: localW.userEmail,
              usdt_address: localW.usdtAddress,
              network: localW.network,
              amount_cents: localW.amountCents,
              fee_cents: localW.feeCents,
              net_cents: localW.netCents,
              gross_usdt: localW.grossUsdt,
              fee_usdt: localW.feeUsdt,
              net_usdt: localW.netUsdt,
              status: localW.status,
              tx_hash: localW.txHash || null,
              review_notes: localW.reviewNotes || null,
              reviewed_by: localW.reviewedBy || null,
              created_at: localW.createdAt,
              updated_at: localW.updatedAt
            });
          }
        }
      }

      // 6. Sync Admin Audit Logs from Supabase
      const { data: sbLogs, error: sbLogsErr } = await sb
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!sbLogsErr && Array.isArray(sbLogs)) {
        for (const row of sbLogs) {
          if (!row || !row.id) continue;
          const exists = this.data.adminAuditLogs.some(l => l.id === row.id);
          if (!exists) {
            this.data.adminAuditLogs.push({
              id: String(row.id),
              adminUserId: String(row.admin_user_id || 'usr_admin_rewardriver'),
              adminEmail: String(row.admin_email || 'admin@reward-river'),
              action: String(row.action || 'ADMIN_ACTION'),
              targetEntity: String(row.target_entity || 'system'),
              targetId: String(row.target_id || 'global'),
              details: typeof row.details === 'string' ? row.details : JSON.stringify(row.details || {}),
              ipAddress: row.ip_address || undefined,
              createdAt: row.created_at || new Date().toISOString()
            });
            changed = true;
          }
        }
      }

      if (changed) {
        await this.persist();
      }
    } catch (err) {
      console.warn('[Supabase Sync Note]:', err instanceof Error ? err.message : String(err));
    }
  }

  private persist(): Promise<void> {
    if (IS_UNIT_TEST_ENV) return Promise.resolve();
    this.writeQueue = this.writeQueue.then(async () => {
      const serialized = JSON.stringify(this.data, null, 2);
      try {
        const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
        await fs.writeFile(tmpFile, serialized, 'utf-8');
        await fs.rename(tmpFile, DB_FILE);
      } catch {
        try {
          await fs.writeFile(TMP_DB_FILE, serialized, 'utf-8');
        } catch {
          // Ignore write error on read-only serverless container
        }
      }
    });
    return this.writeQueue;
  }

  // --- Users ---
  getUserById(id: string): UserAccount | undefined {
    return this.data.users.find(u => u.id === id);
  }

  getUserByEmail(email: string): UserAccount | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserByUsernameOrEmail(identifier: string): UserAccount | undefined {
    const clean = identifier.trim().toLowerCase();
    if (!clean) return undefined;
    return this.data.users.find(
      u =>
        u.email.toLowerCase() === clean ||
        u.email.split('@')[0].toLowerCase() === clean ||
        (u.username && u.username.toLowerCase() === clean) ||
        u.displayName.toLowerCase() === clean
    );
  }

  getUserByExternalId(extId: string): UserAccount | undefined {
    const raw = String(extId || '').trim();
    if (!raw) return undefined;

    // 1. Exact externalOpaqueId or id match
    const exact = this.data.users.find(
      u => u.externalOpaqueId === raw || u.id === raw
    );
    if (exact) return exact;

    // 2. Strip rr_cpx_ or rr_ prefixes and check id / username / email
    const stripped = raw.replace(/^rr_(cpx_)?/i, '');
    const byStripped = this.data.users.find(
      u =>
        u.id === stripped ||
        u.externalOpaqueId === `rr_cpx_${stripped}` ||
        u.id.replace(/[^a-zA-Z0-9]/g, '') === stripped.replace(/[^a-zA-Z0-9]/g, '') ||
        (u.username && u.username.toLowerCase() === raw.toLowerCase()) ||
        (u.username && u.username.toLowerCase() === stripped.toLowerCase()) ||
        u.email.toLowerCase() === raw.toLowerCase()
    );
    if (byStripped) return byStripped;

    // 3. Substring matching for user ID, clean UUID hex, email or username inside raw
    const cleanTarget = raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanStripped = stripped.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    for (const u of this.data.users) {
      const cleanId = u.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const cleanExt = (u.externalOpaqueId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const cleanEmail = u.email.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const cleanName = (u.username || u.displayName || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      if (
        cleanId === cleanTarget ||
        cleanExt === cleanTarget ||
        cleanId === cleanStripped ||
        cleanExt === cleanStripped ||
        (cleanId.length > 6 && (cleanTarget.includes(cleanId) || cleanStripped.includes(cleanId))) ||
        (cleanExt.length > 6 && (cleanTarget.includes(cleanExt) || cleanStripped.includes(cleanExt))) ||
        (cleanEmail.length > 5 && (cleanTarget.includes(cleanEmail) || cleanStripped.includes(cleanEmail))) ||
        (cleanName.length > 3 && (cleanTarget.includes(cleanName) || cleanStripped.includes(cleanName)))
      ) {
        return u;
      }
    }

    // 4. Fallback if CPX sent generic guest/member placeholder: credit the most recently active non-admin user
    if (raw === 'member' || raw === 'rr_member_1' || raw.startsWith('rr_guest') || raw === 'rr_cpx_public_feed') {
      const nonAdminUsers = this.data.users.filter(u => u.role !== 'admin');
      if (nonAdminUsers.length > 0) {
        return nonAdminUsers[nonAdminUsers.length - 1];
      }
      return this.data.users[0];
    }

    return undefined;
  }

  getUserByAoySubId(subId: string): UserAccount | undefined {
    const cleanTarget = String(subId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (!cleanTarget) return undefined;
    return this.data.users.find(u => {
      const cleanId = u.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const cleanExt = (u.externalOpaqueId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return cleanId === cleanTarget || cleanExt === cleanTarget || u.id === subId;
    });
  }

  private async upsertUserToSupabase(user: UserAccount): Promise<void> {
    const sb = this.getSupabaseClient();
    if (!sb) return;
    const displayName = user.username || user.displayName || user.email.split('@')[0];
    const emailLower = user.email.toLowerCase();
    const pointsToSync =
      typeof user.storedPoints === 'number'
        ? Math.max(0, Math.round(user.storedPoints))
        : this.getUserBalances(user.id).availablePoints;

    try {
      const fullPayload = {
        id: user.id,
        email: emailLower,
        password_hash: user.passwordHash || '',
        salt: user.salt || '',
        display_name: displayName,
        email_verified: user.emailVerified !== false,
        role: user.role || 'user',
        external_opaque_id:
          user.externalOpaqueId ||
          `rr_cpx_${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`,
        phone_number: user.phoneNumber || user.whatsappNumber || null,
        whatsapp_number: user.whatsappNumber || user.phoneNumber || null,
        country_code: user.countryCode || 'US',
        provider: user.provider || 'password',
        has_prompted_phone: Boolean(user.hasPromptedPhone),
        points: pointsToSync,
        created_at: user.createdAt || new Date().toISOString(),
        updated_at: user.updatedAt || new Date().toISOString()
      };

      const { error } = await sb.from('users').upsert(fullPayload, { onConflict: 'id' });
      if (error) {
        const compactPayload = {
          id: user.id,
          username: displayName,
          email: emailLower,
          password_hash: user.passwordHash || '',
          salt: user.salt || '',
          role: user.role || 'user',
          points: pointsToSync,
          has_prompted_phone: Boolean(user.hasPromptedPhone),
          phone_number: user.phoneNumber || user.whatsappNumber || null,
          created_at: user.createdAt || new Date().toISOString(),
          updated_at: user.updatedAt || new Date().toISOString()
        };

        const { error: fallbackErr } = await sb.from('users').upsert(compactPayload, { onConflict: 'id' });
        if (fallbackErr) {
          // If email already exists under a different primary key ID in Supabase, update by email
          if (
            fallbackErr.message?.includes('users_email_key') ||
            error.message?.includes('users_email_key')
          ) {
            const { id: _ignoreId, created_at: _ignoreCreated, ...updateByEmail } = compactPayload;
            await sb.from('users').update(updateByEmail).eq('email', emailLower);
          } else {
            console.warn('[Supabase Auto Sync] User upsert note:', fallbackErr.message || error.message);
          }
        }
      }
    } catch (err) {
      console.warn('[Supabase Auto Sync] User upsert error:', err);
    }
  }

  async createUser(user: UserAccount): Promise<UserAccount> {
    const existingIdx = this.data.users.findIndex(
      u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()
    );
    if (existingIdx !== -1) {
      this.data.users[existingIdx] = { ...this.data.users[existingIdx], ...user };
    } else {
      this.data.users.push(user);
    }
    await this.persist();
    await this.upsertUserToSupabase(user);
    return user;
  }

  async updateUser(userId: string, updates: Partial<UserAccount>): Promise<UserAccount | null> {
    const idx = this.data.users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates, updatedAt: new Date().toISOString() };
    await this.persist();
    const updated = this.data.users[idx];
    await this.upsertUserToSupabase(updated);
    return updated;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter(u => u.id !== userId);
    if (this.data.users.length === initialLen) return false;
    // Clean up related ledger entries and withdrawal requests
    this.data.rewardLedger = this.data.rewardLedger.filter(l => l.userId !== userId);
    this.data.withdrawalRequests = this.data.withdrawalRequests.filter(w => w.userId !== userId);
    await this.persist();
    const sb = this.getSupabaseClient();
    if (sb) {
      try {
        await sb.from('reward_ledger').delete().eq('user_id', userId);
        await sb.from('withdrawal_requests').delete().eq('user_id', userId);
        await sb.from('users').delete().eq('id', userId);
      } catch (err) {
        console.warn('[Supabase Auto Sync] Delete user error:', err);
      }
    }
    return true;
  }

  getAllUsers(): Omit<UserAccount, 'passwordHash' | 'salt'>[] {
    return this.data.users.map(({ passwordHash, salt, ...rest }) => rest);
  }

  getAllUsersWithDetails() {
    return this.data.users.map(({ passwordHash, salt, ...user }) => {
      const balances = this.getUserBalances(user.id);
      const userLedger = this.getLedgerForUser(user.id);
      const completedSurveysCount = userLedger.filter(
        l => l.entryType === 'credit' && l.status === 'confirmed'
      ).length;
      const tasksPendingCount = userLedger.filter(
        l => l.entryType === 'credit' && l.status === 'pending'
      ).length;
      const tasksRejectedCount = userLedger.filter(
        l =>
          l.entryType === 'reversal' ||
          l.status === 'reversed' ||
          l.status === 'rejected'
      ).length;
      const userWithdrawals = this.getWithdrawalsForUser(user.id);

      // Compute true lastActiveAt across ledger, withdrawals, and user profile timestamps
      const candidateTimestamps = [
        user.updatedAt,
        user.createdAt,
        userLedger[0]?.createdAt,
        userWithdrawals[0]?.createdAt
      ].filter(Boolean) as string[];
      let latestMs = new Date(user.createdAt || Date.now()).getTime();
      let lastActiveAt = user.updatedAt || user.createdAt;
      for (const ts of candidateTimestamps) {
        const ms = new Date(ts).getTime();
        if (!isNaN(ms) && ms >= latestMs) {
          latestMs = ms;
          lastActiveAt = ts;
        }
      }

      const cohort = classifyUserCohort(user.createdAt);

      return {
        ...user,
        cohort,
        createdAtKarachi: formatKarachiDateTime(user.createdAt),
        lastActiveAt,
        lastActiveAtKarachi: formatKarachiDateTime(lastActiveAt),
        balances,
        storedPoints: user.storedPoints ?? balances.availablePoints,
        completedSurveysCount,
        tasksPendingCount,
        tasksRejectedCount,
        totalTransactionsCount: userLedger.length + userWithdrawals.length,
        recentEntries: userLedger.slice(0, 15),
        fullLedger: userLedger,
        withdrawals: userWithdrawals
      };
    });
  }

  // --- Admin-Editable Tasks Catalog & Completions ---
  getTasks(): TaskDefinitionRecord[] {
    if (!Array.isArray(this.data.tasks) || this.data.tasks.length === 0) {
      this.data.tasks = this.getDefaultData().tasks;
    }
    return [...this.data.tasks];
  }

  getTaskById(taskId: string): TaskDefinitionRecord | undefined {
    const clean = String(taskId || '').trim();
    if (!clean) return undefined;
    const tasks = this.getTasks();
    return (
      tasks.find(t => t.id === clean) ||
      tasks.find(t => clean.startsWith(t.id) || clean.includes(t.taskType))
    );
  }

  async upsertTask(
    input: Partial<TaskDefinitionRecord> & { id?: string; title: string; rewardPoints: number },
    adminUserId: string,
    adminEmail: string
  ): Promise<TaskDefinitionRecord> {
    const nowIso = new Date().toISOString();
    const id = String(input.id || `task_${crypto.randomUUID().slice(0, 8)}`).trim();
    const rewardPoints = Math.max(1, Math.round(Number(input.rewardPoints) || 100));
    const existingIdx = this.data.tasks.findIndex(t => t.id === id);

    const record: TaskDefinitionRecord = {
      id,
      title: String(input.title || 'Verified Task').trim(),
      description: String(input.description || 'Verified platform task completion').trim(),
      taskType: input.taskType || 'custom',
      rewardPoints,
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
      dailyLimit: Math.max(1, Math.round(Number(input.dailyLimit) || 10)),
      createdAt: existingIdx !== -1 ? this.data.tasks[existingIdx].createdAt : nowIso,
      updatedAt: nowIso
    };

    if (existingIdx !== -1) {
      this.data.tasks[existingIdx] = record;
    } else {
      this.data.tasks.push(record);
    }

    await this.addAuditLog({
      adminUserId,
      adminEmail,
      action: existingIdx !== -1 ? 'UPDATE_TASK_DEFINITION' : 'CREATE_TASK_DEFINITION',
      targetEntity: 'tasks',
      targetId: record.id,
      details: JSON.stringify(record)
    });

    await this.persist();
    const sb = this.getSupabaseClient();
    if (sb) {
      try {
        await sb.from('tasks').upsert({
          id: record.id,
          title: record.title,
          description: record.description,
          task_type: record.taskType,
          reward_points: record.rewardPoints,
          is_active: record.isActive,
          daily_limit: record.dailyLimit,
          created_at: record.createdAt,
          updated_at: record.updatedAt
        });
      } catch {
        // Optional tasks table in Supabase
      }
    }
    return record;
  }

  async deleteTask(taskId: string, adminUserId: string, adminEmail: string): Promise<boolean> {
    const before = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
    if (this.data.tasks.length === before) return false;
    await this.addAuditLog({
      adminUserId,
      adminEmail,
      action: 'DELETE_TASK_DEFINITION',
      targetEntity: 'tasks',
      targetId: taskId,
      details: `Deleted task definition ${taskId}`
    });
    await this.persist();
    const sb = this.getSupabaseClient();
    if (sb) {
      try {
        await sb.from('tasks').delete().eq('id', taskId);
      } catch {
        // Optional tasks table in Supabase
      }
    }
    return true;
  }

  getTaskCompletions(): TaskCompletionRecord[] {
    return [...(this.data.taskCompletions || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async addTaskCompletion(record: TaskCompletionRecord): Promise<TaskCompletionRecord> {
    if (!Array.isArray(this.data.taskCompletions)) {
      this.data.taskCompletions = [];
    }
    this.data.taskCompletions.push(record);
    await this.persist();
    return record;
  }

  async adjustUserPoints(params: {
    userId: string;
    pointsDelta: number;
    reason: string;
    taskId?: string;
    adminUserId: string;
    adminEmail: string;
  }): Promise<{ entry: LedgerEntry; balances: ReturnType<DatabaseStore['getUserBalances']> }> {
    const user = this.getUserById(params.userId);
    if (!user) {
      throw new Error(`User not found: ${params.userId}`);
    }
    const delta = Math.round(Number(params.pointsDelta) || 0);
    if (delta === 0) {
      throw new Error('Points adjustment delta must be non-zero (+ for credit, - for debit).');
    }
    const cleanReason = String(params.reason || '').trim();
    if (cleanReason.length < 3) {
      throw new Error('A clear audit reason (minimum 3 characters) is required for manual point adjustments.');
    }

    const absPoints = Math.abs(delta);
    const amountCents = Math.max(1, Math.round(absPoints / 100));
    const grossCents = Math.max(amountCents, Math.round((absPoints / 5000) * 100));
    const adminProfitCents = Math.max(0, grossCents - amountCents);
    const nowIso = new Date().toISOString();
    const txId = `adm_adj_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const entryType: LedgerEntry['entryType'] = delta > 0 ? 'credit' : 'debit';
    const signStr = delta > 0 ? `+${absPoints.toLocaleString('en-US')}` : `-${absPoints.toLocaleString('en-US')}`;

    const entry: LedgerEntry = {
      id: `le_${crypto.randomUUID()}`,
      userId: user.id,
      providerTxId: txId,
      taskId: params.taskId || 'admin_manual_adjustment',
      cpxOfferId: params.taskId || 'admin_adjustment',
      amountCents,
      points: absPoints,
      grossCents: delta > 0 ? grossCents : 0,
      adminProfitCents: delta > 0 ? adminProfitCents : 0,
      appliedSharePercent: 50,
      entryType,
      status: 'confirmed',
      approvedBy: params.adminEmail || 'admin@reward-river',
      description: `Admin Adjustment: ${cleanReason} (${signStr} Pts) [Approved by ${params.adminEmail}]`,
      createdAt: nowIso,
      processedAt: nowIso
    };

    await this.addLedgerEntry(entry);
    const updatedBalances = this.getUserBalances(user.id);
    const uIdx = this.data.users.findIndex(u => u.id === user.id);
    if (uIdx !== -1) {
      this.data.users[uIdx].storedPoints = updatedBalances.availablePoints;
      this.data.users[uIdx].updatedAt = nowIso;
    }

    await this.addAuditLog({
      adminUserId: params.adminUserId,
      adminEmail: params.adminEmail,
      action: 'ADMIN_MANUAL_POINTS_ADJUSTMENT',
      targetEntity: 'users',
      targetId: user.id,
      details: JSON.stringify({
        userId: user.id,
        email: user.email,
        pointsDelta: delta,
        taskId: params.taskId || 'admin_manual_adjustment',
        reason: cleanReason,
        newAvailablePoints: updatedBalances.availablePoints,
        ledgerEntryId: entry.id
      })
    });

    await this.persist();
    return { entry, balances: updatedBalances };
  }

  async runDataIntegrityCheck(autoFix = false): Promise<DataIntegrityReport & { autoFixedCount: number }> {
    await this.syncFromSupabase(true);
    const sb = this.getSupabaseClient();

    // Refresh storedPoints from Supabase users table so comparison is 100% live
    if (sb) {
      try {
        const { data: sbUsers } = await sb.from('users').select('id, points');
        if (Array.isArray(sbUsers)) {
          const ptsMap = new Map<string, number>();
          for (const r of sbUsers) {
            if (r && r.id !== undefined) {
              ptsMap.set(String(r.id), Math.max(0, Number(r.points) || 0));
            }
          }
          for (const u of this.data.users) {
            if (ptsMap.has(u.id)) {
              u.storedPoints = ptsMap.get(u.id);
            }
          }
        }
      } catch {
        // Proceed with local storedPoints
      }
    }

    const initialReport = verifyDataIntegrity({
      users: this.data.users.map(u => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        externalOpaqueId: u.externalOpaqueId,
        emailVerified: u.emailVerified,
        storedPoints: u.storedPoints ?? this.getUserBalances(u.id).availablePoints
      })),
      ledger: this.data.rewardLedger,
      withdrawals: this.data.withdrawalRequests
    });

    let autoFixedCount = 0;
    if (autoFix) {
      // 1. Ensure permanent IDs & externalOpaqueId on all users
      for (const u of this.data.users) {
        let modified = false;
        if (!u.id || u.id.trim().length < 4) {
          u.id = `usr_${crypto.randomUUID()}`;
          modified = true;
        }
        if (!u.externalOpaqueId || u.externalOpaqueId.trim().length < 6 || u.externalOpaqueId.includes('@')) {
          const cleanUuid = u.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
          u.externalOpaqueId = `rr_cpx_${cleanUuid || crypto.randomBytes(8).toString('hex')}`;
          modified = true;
        }
        const balances = this.getUserBalances(u.id);
        if (u.storedPoints !== balances.availablePoints) {
          u.storedPoints = balances.availablePoints;
          modified = true;
        }
        if (modified) {
          autoFixedCount++;
          await this.upsertUserToSupabase(u);
          if (sb) {
            try {
              await sb.from('users').update({
                points: balances.availablePoints,
                balance_cents: balances.availableCents,
                total_earned_points: balances.totalEarnedPoints,
                external_opaque_id: u.externalOpaqueId,
                updated_at: new Date().toISOString()
              }).eq('id', u.id);
            } catch {
              // ignore
            }
          }
        }
      }

      // 2. Deduplicate duplicate providerTxId if any
      const seenTx = new Set<string>();
      const dedupedLedger: LedgerEntry[] = [];
      for (const l of this.data.rewardLedger) {
        const tx = String(l.providerTxId || '').trim();
        if (tx && seenTx.has(tx)) {
          autoFixedCount++;
          continue;
        }
        if (tx) seenTx.add(tx);
        dedupedLedger.push(l);
      }
      this.data.rewardLedger = dedupedLedger;
      await this.persist();

      const postFixReport = verifyDataIntegrity({
        users: this.data.users.map(u => ({
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          username: u.username,
          role: u.role,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          externalOpaqueId: u.externalOpaqueId,
          emailVerified: u.emailVerified,
          storedPoints: u.storedPoints ?? this.getUserBalances(u.id).availablePoints
        })),
        ledger: this.data.rewardLedger,
        withdrawals: this.data.withdrawalRequests
      });

      return {
        ...postFixReport,
        autoFixedCount
      };
    }

    return {
      ...initialReport,
      autoFixedCount
    };
  }

  // --- Ledger ---
  getLedgerForUser(userId: string): LedgerEntry[] {
    const rawCleanId = String(userId || '').trim();
    const cleanNoUsr = rawCleanId.replace(/^usr_/, '');
    const cleanWithUsr = rawCleanId.startsWith('usr_') ? rawCleanId : `usr_${rawCleanId}`;
    const user = this.data.users.find(
      u => u.id === rawCleanId || u.id === cleanNoUsr || u.id === cleanWithUsr
    );
    const userExtId = user?.externalOpaqueId;

    return this.data.rewardLedger
      .filter(
        l =>
          l.userId === rawCleanId ||
          l.userId === cleanNoUsr ||
          l.userId === cleanWithUsr ||
          (userExtId && l.userId === userExtId)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAllLedgerEntries(): LedgerEntry[] {
    return [...this.data.rewardLedger].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getUserBalances(userId: string) {
    const rawCleanId = String(userId || '').trim();
    const cleanNoUsr = rawCleanId.replace(/^usr_/, '');
    const cleanWithUsr = rawCleanId.startsWith('usr_') ? rawCleanId : `usr_${rawCleanId}`;

    const user = this.data.users.find(
      u => u.id === rawCleanId || u.id === cleanNoUsr || u.id === cleanWithUsr
    );
    const userExtId = user?.externalOpaqueId;

    const entries = this.data.rewardLedger
      .filter(
        l =>
          l.userId === rawCleanId ||
          l.userId === cleanNoUsr ||
          l.userId === cleanWithUsr ||
          (userExtId && l.userId === userExtId)
      )
      .map(l => (l.userId === rawCleanId ? l : { ...l, userId: rawCleanId }));
    const withdrawals = this.data.withdrawalRequests
      .filter(w => w.userId === rawCleanId || w.userId === cleanNoUsr || w.userId === cleanWithUsr)
      .map(w => (w.userId === rawCleanId ? w : { ...w, userId: rawCleanId }));
    const pointsPerUsdt = this.data.systemSettings?.pointsPerUsdt || 5000;
    const userSharePercent = this.data.systemSettings?.userSharePercent || 50;
    const balances = calculateUserBalances(rawCleanId, entries, withdrawals, pointsPerUsdt, userSharePercent);

    return balances;
  }

  async addLedgerEntry(entry: LedgerEntry): Promise<{ success: boolean; error?: string; entry?: LedgerEntry }> {
    if (entry.providerTxId && isDuplicateTransaction(entry.providerTxId, this.data.rewardLedger)) {
      return { success: false, error: 'Transaction has already been processed.' };
    }

    this.data.rewardLedger.push(entry);
    await this.persist();

    const sb = this.getSupabaseClient();
    if (sb) {
      try {
        const { error } = await sb.from('reward_ledger').upsert({
          id: entry.id,
          user_id: entry.userId,
          provider_tx_id: entry.providerTxId,
          amount_cents: entry.amountCents,
          entry_type: entry.entryType,
          status: entry.status,
          description: entry.description || `Survey Completion (+${(entry.points || 0).toLocaleString('en-US')} Pts)`,
          created_at: entry.createdAt
        });
        if (error) {
          await sb.from('ledger_entries').upsert({
            id: entry.id,
            user_id: entry.userId,
            amount_cents: entry.amountCents,
            points_change: entry.points || 0,
            type: entry.entryType || 'credit',
            description: entry.description || `Survey Completion (+${(entry.points || 0).toLocaleString('en-US')} Pts)`,
            reference_id: entry.providerTxId || entry.id,
            created_at: entry.createdAt
          });
        }

        // Keep Supabase users table points and balance in real-time sync
        const updatedBalances = this.getUserBalances(entry.userId);
        await sb.from('users').update({
          points: updatedBalances.availablePoints,
          balance_cents: updatedBalances.availableCents,
          total_earned_points: updatedBalances.totalEarnedPoints,
          updated_at: new Date().toISOString()
        }).eq('id', entry.userId);
      } catch (e) {
        console.warn('[Supabase Auto Sync] Ledger upsert note:', e);
      }
    }

    return { success: true, entry };
  }

  async upsertLedgerEntry(entry: LedgerEntry): Promise<{ isNew: boolean; updated: boolean; entry: LedgerEntry }> {
    const existingIdx = this.data.rewardLedger.findIndex(
      l => l.id === entry.id || (entry.providerTxId && l.providerTxId === entry.providerTxId)
    );
    let isNew = false;
    let updated = false;

    if (existingIdx === -1) {
      this.data.rewardLedger.push(entry);
      isNew = true;
    } else {
      const current = this.data.rewardLedger[existingIdx];
      if (
        current.points !== entry.points ||
        current.amountCents !== entry.amountCents ||
        current.grossCents !== entry.grossCents ||
        current.adminProfitCents !== entry.adminProfitCents ||
        current.userId !== entry.userId ||
        current.description !== entry.description ||
        current.createdAt !== entry.createdAt
      ) {
        this.data.rewardLedger[existingIdx] = { ...current, ...entry };
        updated = true;
      }
    }

    if (isNew || updated) {
      await this.persist();
      const sb = this.getSupabaseClient();
      if (sb) {
        try {
          await sb.from('reward_ledger').upsert({
            id: entry.id,
            user_id: entry.userId,
            provider_tx_id: entry.providerTxId,
            amount_cents: entry.amountCents,
            entry_type: entry.entryType,
            status: entry.status,
            description: entry.description,
            created_at: entry.createdAt
          });
          const updatedBalances = this.getUserBalances(entry.userId);
          await sb.from('users').update({
            points: updatedBalances.availablePoints,
            balance_cents: updatedBalances.availableCents,
            total_earned_points: updatedBalances.totalEarnedPoints,
            updated_at: new Date().toISOString()
          }).eq('id', entry.userId);
        } catch (e) {
          console.warn('[Supabase Auto Sync] Ledger upsert note:', e);
        }
      }
    }

    return { isNew, updated, entry };
  }

  // --- Withdrawals ---
  getWithdrawalsForUser(userId: string): WithdrawalRequestDoc[] {
    return this.data.withdrawalRequests
      .filter(w => w.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAllWithdrawals(): WithdrawalRequestDoc[] {
    return [...this.data.withdrawalRequests].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getWithdrawalById(id: string): WithdrawalRequestDoc | undefined {
    return this.data.withdrawalRequests.find(w => w.id === id);
  }

  async createWithdrawalRequest(req: WithdrawalRequestDoc): Promise<WithdrawalRequestDoc> {
    this.data.withdrawalRequests.push(req);
    this.data.withdrawalEvents.push({
      id: `we_${crypto.randomUUID()}`,
      withdrawalId: req.id,
      previousStatus: 'none',
      newStatus: req.status,
      actorUserId: req.userId,
      reason: 'User submitted USDT withdrawal request',
      createdAt: new Date().toISOString()
    });
    await this.persist();

    const sb = this.getSupabaseClient();
    if (sb) {
      try {
        await sb.from('withdrawal_requests').upsert({
          id: req.id,
          user_id: req.userId,
          user_email: req.userEmail,
          usdt_address: req.usdtAddress,
          network: req.network,
          amount_cents: req.amountCents,
          fee_cents: req.feeCents,
          net_cents: req.netCents,
          gross_usdt: req.grossUsdt,
          fee_usdt: req.feeUsdt,
          net_usdt: req.netUsdt,
          status: req.status,
          created_at: req.createdAt,
          updated_at: req.updatedAt
        });
        const updatedBalances = this.getUserBalances(req.userId);
        await sb.from('users').update({
          points: updatedBalances.availablePoints,
          balance_cents: updatedBalances.availableCents,
          total_earned_points: updatedBalances.totalEarnedPoints,
          updated_at: new Date().toISOString()
        }).eq('id', req.userId);
      } catch (e) {
        console.warn('[Supabase Auto Sync] Withdrawal create note:', e);
      }
    }
    return req;
  }

  async updateWithdrawalStatus(
    id: string,
    newStatus: WithdrawalRequestDoc['status'],
    actorUserId: string,
    notes?: string,
    txHash?: string
  ): Promise<WithdrawalRequestDoc | null> {
    const idx = this.data.withdrawalRequests.findIndex(w => w.id === id);
    if (idx === -1) return null;

    const current = this.data.withdrawalRequests[idx];
    const previousStatus = current.status;

    if (['paid', 'cancelled'].includes(previousStatus)) {
      throw new Error(`Cannot change status of a ${previousStatus} withdrawal request.`);
    }

    this.data.withdrawalRequests[idx] = {
      ...current,
      status: newStatus,
      reviewNotes: notes !== undefined ? notes : current.reviewNotes,
      txHash: txHash !== undefined ? txHash : current.txHash,
      reviewedBy: actorUserId,
      updatedAt: new Date().toISOString()
    };

    this.data.withdrawalEvents.push({
      id: `we_${crypto.randomUUID()}`,
      withdrawalId: id,
      previousStatus,
      newStatus,
      actorUserId,
      reason: notes,
      createdAt: new Date().toISOString()
    });

    await this.persist();

    const updated = this.data.withdrawalRequests[idx];
    const sb = this.getSupabaseClient();
    if (sb) {
      try {
        await sb.from('withdrawal_requests').upsert({
          id: updated.id,
          user_id: updated.userId,
          user_email: updated.userEmail,
          usdt_address: updated.usdtAddress,
          network: updated.network,
          amount_cents: updated.amountCents,
          fee_cents: updated.feeCents,
          net_cents: updated.netCents,
          gross_usdt: updated.grossUsdt,
          fee_usdt: updated.feeUsdt,
          net_usdt: updated.netUsdt,
          status: updated.status,
          tx_hash: updated.txHash || null,
          review_notes: updated.reviewNotes || null,
          reviewed_by: updated.reviewedBy || null,
          created_at: updated.createdAt,
          updated_at: updated.updatedAt
        });
        const updatedBalances = this.getUserBalances(updated.userId);
        await sb.from('users').update({
          points: updatedBalances.availablePoints,
          balance_cents: updatedBalances.availableCents,
          total_earned_points: updatedBalances.totalEarnedPoints,
          updated_at: new Date().toISOString()
        }).eq('id', updated.userId);
      } catch (e) {
        console.warn('[Supabase Auto Sync] Withdrawal update note:', e);
      }
    }

    return updated;
  }

  // --- Settings ---
  getSettings(): SystemSettings {
    return { ...this.data.systemSettings };
  }

  async updateSettings(settings: Partial<SystemSettings>, adminUserId: string): Promise<SystemSettings> {
    this.data.systemSettings = {
      ...this.data.systemSettings,
      ...settings,
      updatedAt: new Date().toISOString()
    };
    await this.addAuditLog({
      adminUserId,
      adminEmail: this.getUserById(adminUserId)?.email || 'admin@reward-river',
      action: 'UPDATE_SYSTEM_SETTINGS',
      targetEntity: 'systemSettings',
      targetId: 'global',
      details: JSON.stringify(settings)
    });
    await this.persist();

    const sb = this.getSupabaseClient();
    if (sb) {
      try {
        const { error } = await sb.from('system_settings').upsert({
          id: 'global',
          min_withdrawal_cents: this.data.systemSettings.minWithdrawalCents,
          max_withdrawal_cents: this.data.systemSettings.maxWithdrawalCents,
          fee_cents_trc20: this.data.systemSettings.feeCentsTrc20,
          fee_cents_erc20: this.data.systemSettings.feeCentsErc20,
          points_rate_per_usd: this.data.systemSettings.pointsPerUsdt,
          default_user_share_percent: this.data.systemSettings.userSharePercent,
          default_platform_share_percent: Math.max(0, 100 - (this.data.systemSettings.userSharePercent || 50)),
          maintenance_mode: this.data.systemSettings.maintenanceMode,
          default_network: this.data.systemSettings.defaultNetwork,
          updated_at: this.data.systemSettings.updatedAt
        });
        if (error) console.warn('[Supabase Settings Sync Note]:', error.message);
      } catch (e) {
        console.warn('[Supabase Settings Sync Error]:', e);
      }
    }

    return this.data.systemSettings;
  }

  // --- Audit Logs ---
  async addAuditLog(log: Omit<AdminAuditLog, 'id' | 'createdAt'>): Promise<AdminAuditLog> {
    const newLog: AdminAuditLog = {
      ...log,
      id: `log_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString()
    };
    this.data.adminAuditLogs.push(newLog);
    await this.persist();

    const sb = this.getSupabaseClient();
    if (sb) {
      try {
        await sb.from('admin_audit_logs').upsert({
          id: newLog.id,
          admin_user_id: newLog.adminUserId,
          admin_email: newLog.adminEmail,
          action: newLog.action,
          target_entity: newLog.targetEntity,
          target_id: newLog.targetId,
          details: newLog.details,
          ip_address: newLog.ipAddress || null,
          created_at: newLog.createdAt
        });
      } catch (e) {
        console.warn('[Supabase Audit Log Sync Note]:', e);
      }
    }
    return newLog;
  }

  getAuditLogs(): AdminAuditLog[] {
    return [...this.data.adminAuditLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

export const dbStore = new DatabaseStore();
