import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LedgerEntry, WithdrawalRecord, calculateUserBalances, isDuplicateTransaction } from '../src/utils/ledger';
export type { LedgerEntry };
import { usdCentsToPoints } from '../src/utils/usdt';
import { getActiveServerSupabase } from './supabase';

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
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.data = this.getDefaultData();
  }

  private getDefaultData(): DatabaseSchema {
    return {
      users: [],
      rewardLedger: [],
      withdrawalRequests: [],
      withdrawalEvents: [],
      systemSettings: {
        supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
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

        const isMockOrTestTx = (txId?: string | null, desc?: string | null) => {
          const clean = String(txId || '').trim().toLowerCase();
          const d = String(desc || '').trim().toLowerCase();
          if (!clean) return true;
          return (
            clean.startsWith('cpx_survey_') ||
            clean.startsWith('sim_') ||
            clean.startsWith('test_') ||
            clean.startsWith('cpx_test_') ||
            clean.startsWith('factor_test') ||
            clean.startsWith('cpx_verify_') ||
            clean.startsWith('aoy_sim_') ||
            clean.startsWith('diag_') ||
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
          const rawPoints = Math.max(0, Number(l.points) || 0);
          // CPX gross cents is preserved from grossCents or original amountCents when appliedSharePercent was 100
          const rawGross =
            l.appliedSharePercent === 100
              ? Number(l.grossCents || l.amountCents)
              : Number(l.grossCents || Math.round((rawPoints / 5000) * 100));
          const grossCents = Math.max(1, rawGross || Math.round((rawPoints / 5000) * 100));
          // Normalize points to the 5,000 Points = $1.00 CPX Currency Factor (50 Pts per 1 gross cent)
          const points =
            rawPoints === 0 || rawPoints > grossCents * 55
              ? Math.max(50, Math.round(grossCents * 50))
              : rawPoints;
          // User redemption rate: 10,000 Points = $1.00 USD (100 Points = 1 cent = 50% of CPX gross)
          const userAmountCents = Math.max(1, Math.round(points / 100));
          const adminProfitCents = Math.max(0, grossCents - userAmountCents);
          const cleanDesc = String(l.description || '').replace(
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
          rewardLedger: (parsed.rewardLedger || [])
            .filter((l: LedgerEntry) => !isMockOrTestTx(l?.providerTxId, l?.description))
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
    const s = this.data?.systemSettings;
    return getActiveServerSupabase(s?.supabaseUrl, s?.supabaseServiceKey || s?.supabaseAnonKey);
  }

  async syncFromSupabase(): Promise<void> {
    const sb = this.getSupabaseClient();
    if (!sb) return;

    const isMockOrTestTx = (txId?: string | null, desc?: string | null) => {
      const clean = String(txId || '').trim().toLowerCase();
      const d = String(desc || '').trim().toLowerCase();
      if (!clean) return true;
      return (
        clean.startsWith('cpx_survey_') ||
        clean.startsWith('sim_') ||
        clean.startsWith('test_') ||
        clean.startsWith('cpx_test_') ||
        clean.startsWith('factor_test') ||
        clean.startsWith('cpx_verify_') ||
        clean.startsWith('aoy_sim_') ||
        clean.startsWith('diag_') ||
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
      } else {
        const { data: leData } = await sb.from('ledger_entries').select('*');
        if (Array.isArray(leData)) {
          sbLedger = leData.map(r => ({
            id: r.id,
            user_id: r.user_id,
            provider_tx_id: r.reference_id || r.id,
            amount_cents: r.amount_cents,
            entry_type: r.type || 'credit',
            status: 'confirmed',
            description: r.description,
            created_at: r.created_at
          }));
        }
      }

      let changed = false;

      // Strip mock/test users from local store first
      const beforeUserCount = this.data.users.length;
      this.data.users = this.data.users.filter(u => !isMockOrTestUser(u.email, u.username));
      if (this.data.users.length !== beforeUserCount) {
        changed = true;
      }

      if (Array.isArray(sbUsers)) {
        for (const row of sbUsers) {
          if (!row || !row.id || !row.email) continue;
          const rawEmailLower = String(row.email).trim().toLowerCase();

          // Purge mock/test users from Supabase as well
          if (isMockOrTestUser(rawEmailLower, row.display_name || row.username)) {
            await sb.from('reward_ledger').delete().eq('user_id', row.id);
            await sb.from('users').delete().eq('id', row.id);
            changed = true;
            continue;
          }

          const isSoleAdmin =
            row.id === 'usr_admin_rewardriver' || rawEmailLower === 'admin@reward-river';
          const effectiveRole: 'user' | 'admin' = isSoleAdmin ? 'admin' : 'user';
          
          // Strictly force external_opaque_id to be a clean UUID-derived hex without email handles
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
              hasPromptedPhone: Boolean(row.has_prompted_phone)
            });
            changed = true;
          } else {
            const current = this.data.users[existingIdx];
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

        // Push any local users not yet in Supabase or whose normalized email changed up to Supabase
        for (const localUser of this.data.users) {
          if (isMockOrTestUser(localUser.email, localUser.username)) continue;
          const sbMatch = sbUsers.find((r: any) => r && r.id === localUser.id);
          if (!sbMatch || String(sbMatch.email || '').toLowerCase() !== localUser.email.toLowerCase()) {
            await this.upsertUserToSupabase(localUser);
          }
        }
      }

      const beforeLen = this.data.rewardLedger.length;
      this.data.rewardLedger = this.data.rewardLedger.filter(
        l => !isMockOrTestTx(l.providerTxId, l.description)
      );
      if (this.data.rewardLedger.length !== beforeLen) {
        changed = true;
      }

      if (Array.isArray(sbLedger)) {
        const ptsRate = this.data.systemSettings?.pointsPerUsdt || 5000;
        for (const row of sbLedger) {
          if (!row || !row.id || !row.user_id) continue;
          if (isMockOrTestTx(row.provider_tx_id, row.description)) {
            await sb.from('reward_ledger').delete().eq('id', row.id);
            changed = true;
            continue;
          }
          const exists = this.data.rewardLedger.some(
            l => l.id === row.id || (row.provider_tx_id && l.providerTxId === row.provider_tx_id)
          );
          if (!exists) {
            const rawAmountCents = Math.max(0, Number(row.amount_cents) || 0);
            const desc = String(row.description || '');
            // Parse exact points from description if present (e.g. "+1,600 Pts")
            const ptsMatch = desc.match(/\+?([\d,]+)\s*(?:Pts|Points)/i);
            const parsedPts = ptsMatch ? Number(ptsMatch[1].replace(/,/g, '')) : NaN;
            const rawPoints =
              !isNaN(parsedPts) && parsedPts > 0
                ? Math.round(parsedPts)
                : Math.round((rawAmountCents / 100) * ptsRate);

            const grossCents = Math.max(1, rawAmountCents || Math.round((rawPoints / 5000) * 100));
            const points =
              rawPoints === 0 || rawPoints > grossCents * 55
                ? Math.max(50, Math.round(grossCents * 50))
                : rawPoints;
            const userAmountCents = Math.max(1, Math.round(points / 100));
            const adminProfitCents = Math.max(0, grossCents - userAmountCents);
            const cleanDesc = desc.replace(
              /\+\d[\d,]*\s*Pts/i,
              `+${points.toLocaleString('en-US')} Pts`
            );

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
              description: cleanDesc || `CPX Research Survey #${row.provider_tx_id} (+${points.toLocaleString('en-US')} Pts)`,
              createdAt: row.created_at || new Date().toISOString(),
              processedAt: row.created_at || new Date().toISOString()
            });
            changed = true;
          }
        }

        for (const localEntry of this.data.rewardLedger) {
          if (isMockOrTestTx(localEntry.providerTxId, localEntry.description)) continue;
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

      // Sync withdrawal requests from Supabase if present
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
          } else if (this.data.withdrawalRequests[existingIdx].status !== mapped.status) {
            this.data.withdrawalRequests[existingIdx] = {
              ...this.data.withdrawalRequests[existingIdx],
              ...mapped
            };
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
    try {
      const { error } = await sb.from('users').upsert(
        {
          id: user.id,
          email: user.email.toLowerCase(),
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
          created_at: user.createdAt || new Date().toISOString(),
          updated_at: user.updatedAt || new Date().toISOString()
        },
        { onConflict: 'id' }
      );
      if (error) {
        // Fallback if using alternate schema with 'username' column
        const { error: fallbackErr } = await sb.from('users').upsert(
          {
            id: user.id,
            username: displayName,
            email: user.email.toLowerCase(),
            password_hash: user.passwordHash || '',
            salt: user.salt || '',
            role: user.role || 'user',
            has_prompted_phone: Boolean(user.hasPromptedPhone),
            phone_number: user.phoneNumber || user.whatsappNumber || null,
            created_at: user.createdAt || new Date().toISOString(),
            updated_at: user.updatedAt || new Date().toISOString()
          },
          { onConflict: 'id' }
        );
        if (fallbackErr) {
          console.warn('[Supabase Auto Sync] User upsert note:', error.message);
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
      const userLedger = this.data.rewardLedger
        .filter(l => l.userId === user.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const completedSurveysCount = userLedger.filter(l => l.entryType === 'credit' && l.status === 'confirmed').length;
      const userWithdrawals = this.data.withdrawalRequests.filter(w => w.userId === user.id);

      return {
        ...user,
        balances,
        completedSurveysCount,
        totalTransactionsCount: userLedger.length + userWithdrawals.length,
        recentEntries: userLedger.slice(0, 15),
        lastActiveAt: user.updatedAt || user.createdAt
      };
    });
  }

  // --- Ledger ---
  getLedgerForUser(userId: string): LedgerEntry[] {
    return this.data.rewardLedger
      .filter(l => l.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAllLedgerEntries(): LedgerEntry[] {
    return [...this.data.rewardLedger].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getUserBalances(userId: string) {
    const entries = this.data.rewardLedger.filter(l => l.userId === userId);
    const withdrawals = this.data.withdrawalRequests.filter(w => w.userId === userId);
    const pointsPerUsdt = this.data.systemSettings?.pointsPerUsdt || 5000;
    const userSharePercent = this.data.systemSettings?.userSharePercent || 50;
    return calculateUserBalances(userId, entries, withdrawals, pointsPerUsdt, userSharePercent);
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
        current.description !== entry.description
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
      adminEmail: this.getUserById(adminUserId)?.email || 'unknown',
      action: 'UPDATE_SYSTEM_SETTINGS',
      targetEntity: 'systemSettings',
      targetId: 'global',
      details: JSON.stringify(settings)
    });
    await this.persist();

    const sb = this.getSupabaseClient();
    if (sb) {
      sb.from('system_settings')
        .upsert({
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
        })
        .then(({ error }) => {
          if (error) console.warn('[Supabase Settings Sync Note]:', error.message);
        });
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
    return newLog;
  }

  getAuditLogs(): AdminAuditLog[] {
    return [...this.data.adminAuditLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

export const dbStore = new DatabaseStore();
