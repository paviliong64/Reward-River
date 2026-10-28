import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LedgerEntry, WithdrawalRecord, calculateUserBalances, isDuplicateTransaction } from '../src/utils/ledger';
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
        minWithdrawalCents: 2500, // $25.00 min (250,000 Points)
        maxWithdrawalCents: 50000, // $500.00 max (5,000,000 Points)
        feeCentsTrc20: 100, // $1.00 USDT fee for TRC-20
        feeCentsErc20: 250, // $2.50 USDT fee for ERC-20
        userSharePercent: 40, // Default 40% user share (60% hidden admin profit)
        pointsPerUsdt: 10000, // 10,000 Points = 1.00 USDT
        surveyDisplayMode: 'points_only',
        cpxAppId: process.env.CPX_APP_ID || '37699',
        cpxHashKey: process.env.CPX_HASH_KEY || '1u8hIFGwUYYORM76NM76PDxenCC50bCZ',
        cpxIntegrationMode: 'hybrid_api',
        cpxMaxSurveys: 12,
        cpxThemeColor: '10b981',
        cpxEnableFallback: false,
        cpxVerifySignature: true,
        aoyApiKey: process.env.AOY_API_KEY || '',
        aoySecretKey: process.env.AOY_SECRET_KEY || '',
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

        const isUnverifiedSelfClaim = (txId?: string | null) => {
          const clean = String(txId || '').trim().toLowerCase();
          return clean.startsWith('cpx_survey_') || clean.startsWith('sim_cpx_');
        };

        this.data = {
          ...this.getDefaultData(),
          ...parsed,
          users: parsed.users || this.getDefaultData().users,
          rewardLedger: (parsed.rewardLedger || []).filter(
            (l: LedgerEntry) => !isUnverifiedSelfClaim(l?.providerTxId)
          ),
          withdrawalRequests: parsed.withdrawalRequests || [],
          withdrawalEvents: parsed.withdrawalEvents || [],
          systemSettings: {
            ...this.getDefaultData().systemSettings,
            ...(parsed.systemSettings || {}),
            cpxAppId: parsed.systemSettings?.cpxAppId || '37699',
            cpxHashKey: validCpxHash,
            minWithdrawalCents:
              parsed.systemSettings?.minWithdrawalCents === 500
                ? 2500
                : (parsed.systemSettings?.minWithdrawalCents ?? 2500)
          },
          adminAuditLogs: parsed.adminAuditLogs || []
        };
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

  private getSupabaseClient() {
    const s = this.data?.systemSettings;
    return getActiveServerSupabase(s?.supabaseUrl, s?.supabaseServiceKey || s?.supabaseAnonKey);
  }

  async syncFromSupabase(): Promise<void> {
    const sb = this.getSupabaseClient();
    if (!sb) return;

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

      if (Array.isArray(sbUsers)) {
        for (const row of sbUsers) {
          if (!row || !row.id || !row.email) continue;
          const emailLower = String(row.email).trim().toLowerCase();
          // Skip legacy admin aliases
          if (emailLower === 'admin@rewardriver.com' || emailLower === 'admin@rewardriver') continue;

          const isSoleAdmin =
            row.id === 'usr_admin_rewardriver' || emailLower === 'admin@reward-river';
          const effectiveRole: 'user' | 'admin' = isSoleAdmin ? 'admin' : 'user';
          const display = String(row.display_name || emailLower.split('@')[0]).replace(/\s*\(Super Admin\)/i, '').trim();
          const cleanExtId =
            row.external_opaque_id && !String(row.external_opaque_id).includes('superadmin')
              ? String(row.external_opaque_id)
              : `rr_cpx_${String(row.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;

          const existingIdx = this.data.users.findIndex(
            u => u.id === row.id || u.email.toLowerCase() === emailLower
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
            if (current.role !== effectiveRole) {
              this.data.users[existingIdx].role = effectiveRole;
              changed = true;
            }
            if (!current.countryCode && row.country_code) {
              this.data.users[existingIdx].countryCode = row.country_code;
              changed = true;
            }
          }
        }
      }

      const isUnverifiedSelfClaim = (txId?: string | null) => {
        const clean = String(txId || '').trim().toLowerCase();
        return clean.startsWith('cpx_survey_') || clean.startsWith('sim_cpx_');
      };

      const beforeLen = this.data.rewardLedger.length;
      this.data.rewardLedger = this.data.rewardLedger.filter(
        l => !isUnverifiedSelfClaim(l.providerTxId)
      );
      if (this.data.rewardLedger.length !== beforeLen) {
        changed = true;
      }

      if (Array.isArray(sbLedger)) {
        const share = this.data.systemSettings?.userSharePercent || 40;
        const ptsRate = this.data.systemSettings?.pointsPerUsdt || 10000;
        for (const row of sbLedger) {
          if (!row || !row.id || !row.user_id) continue;
          if (isUnverifiedSelfClaim(row.provider_tx_id)) {
            await sb.from('reward_ledger').delete().eq('id', row.id);
            changed = true;
            continue;
          }
          const exists = this.data.rewardLedger.some(
            l => l.id === row.id || (row.provider_tx_id && l.providerTxId === row.provider_tx_id)
          );
          if (!exists) {
            const amountCents = Math.max(0, Number(row.amount_cents) || 0);
            const desc = String(row.description || '');
            // Parse exact points from description if present (e.g. "+3,200 Pts" or "(8,000 Points)")
            const ptsMatch = desc.match(/\+?([\d,]+)\s*(?:Pts|Points)/i);
            const parsedPts = ptsMatch ? Number(ptsMatch[1].replace(/,/g, '')) : NaN;
            const points =
              !isNaN(parsedPts) && parsedPts > 0
                ? Math.round(parsedPts)
                : usdCentsToPoints(amountCents, ptsRate, share);
            const grossCents =
              points > 0
                ? Math.max(amountCents, Math.round((points / ptsRate) * 100))
                : Math.round(amountCents / (share / 100));
            const adminProfitCents = Math.max(0, grossCents - amountCents);

            this.data.rewardLedger.push({
              id: String(row.id),
              userId: String(row.user_id),
              providerTxId: String(row.provider_tx_id || row.id),
              amountCents,
              points,
              grossCents,
              adminProfitCents,
              appliedSharePercent: share,
              entryType: row.entry_type === 'reversal' ? 'reversal' : row.entry_type === 'debit' ? 'debit' : 'credit',
              status: row.status === 'pending' ? 'pending' : row.status === 'reversed' ? 'reversed' : 'confirmed',
              description: desc || `Survey Completion (+${points.toLocaleString('en-US')} Pts)`,
              createdAt: row.created_at || new Date().toISOString(),
              processedAt: row.created_at || new Date().toISOString()
            });
            changed = true;
          }
        }

        for (const localEntry of this.data.rewardLedger) {
          if (isUnverifiedSelfClaim(localEntry.providerTxId)) continue;
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
                `Survey Completion (+${(localEntry.points || 0).toLocaleString('en-US')} Pts)`,
              created_at: localEntry.createdAt
            });
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
    return this.data.users.find(
      u =>
        u.email.toLowerCase() === clean ||
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
        (u.username && u.username.toLowerCase() === raw.toLowerCase()) ||
        (u.username && u.username.toLowerCase() === stripped.toLowerCase()) ||
        u.email.toLowerCase() === raw.toLowerCase()
    );
    if (byStripped) return byStripped;

    // 3. Alphanumeric normalized comparison
    const cleanTarget = raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanStripped = stripped.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const byClean = this.data.users.find(u => {
      const cleanId = u.id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const cleanExt = (u.externalOpaqueId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return (
        (cleanTarget && (cleanId === cleanTarget || cleanExt === cleanTarget)) ||
        (cleanStripped && (cleanId === cleanStripped || cleanExt === cleanStripped))
      );
    });
    if (byClean) return byClean;

    // 4. Fallback if CPX sent generic guest/member placeholder: credit the most recently active non-admin user
    if (raw === 'member' || raw === 'rr_member_1' || raw.startsWith('rr_guest')) {
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

  async createUser(user: UserAccount): Promise<UserAccount> {
    this.data.users.push(user);
    await this.persist();
    const sb = this.getSupabaseClient();
    if (sb) {
      try {
        const { error } = await sb.from('users').upsert({
          id: user.id,
          username: user.username || user.displayName || user.email.split('@')[0],
          email: user.email,
          password_hash: user.passwordHash,
          salt: user.salt,
          role: user.role || 'user',
          has_prompted_phone: user.hasPromptedPhone || false,
          phone_number: user.phoneNumber || user.whatsappNumber || null,
          created_at: user.createdAt,
          updated_at: user.updatedAt
        });
        if (error) console.warn('[Supabase Auto Sync] User upsert note:', error.message);
      } catch (err) {
        console.warn('[Supabase Auto Sync] User upsert error:', err);
      }
    }
    return user;
  }

  async updateUser(userId: string, updates: Partial<UserAccount>): Promise<UserAccount | null> {
    const idx = this.data.users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates, updatedAt: new Date().toISOString() };
    await this.persist();
    const updated = this.data.users[idx];
    const sb = this.getSupabaseClient();
    if (sb) {
      try {
        const { error } = await sb.from('users').upsert({
          id: updated.id,
          username: updated.username || updated.displayName || updated.email.split('@')[0],
          email: updated.email,
          password_hash: updated.passwordHash,
          salt: updated.salt,
          role: updated.role || 'user',
          has_prompted_phone: updated.hasPromptedPhone || false,
          phone_number: updated.phoneNumber || updated.whatsappNumber || null,
          created_at: updated.createdAt,
          updated_at: updated.updatedAt
        });
        if (error) console.warn('[Supabase Auto Sync] User update note:', error.message);
      } catch (err) {
        console.warn('[Supabase Auto Sync] User update error:', err);
      }
    }
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
    const pointsPerUsdt = this.data.systemSettings?.pointsPerUsdt || 10000;
    const userSharePercent = this.data.systemSettings?.userSharePercent || 40;
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
      } catch (e) {
        console.warn('[Supabase Auto Sync] Ledger upsert note:', e);
      }
    }

    return { success: true, entry };
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
    return this.data.withdrawalRequests[idx];
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
          default_platform_share_percent: Math.max(0, 100 - (this.data.systemSettings.userSharePercent || 40)),
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
