import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LedgerEntry, WithdrawalRecord, calculateUserBalances, isDuplicateTransaction } from '../src/utils/ledger';
import { serverSupabase } from './supabase';

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
        surveyDisplayMode: 'hybrid',
        cpxAppId: process.env.CPX_APP_ID || '37699',
        cpxHashKey: process.env.CPX_HASH_KEY || '1u8hIFGwUYYORM76NM76PDxenCC50bCZ',
        cpxIntegrationMode: 'hybrid_api',
        cpxMaxSurveys: 12,
        cpxThemeColor: '10b981',
        cpxEnableFallback: true,
        cpxVerifySignature: true,
        aoyApiKey: process.env.AOY_API_KEY || '',
        aoySecretKey: process.env.AOY_SECRET_KEY || '',
        aoyBearerToken: process.env.AOY_BEARER_TOKEN || '',
        aoyExchangeRate: 10000,
        aoyEnableFallback: true,
        aoyVerifySignature: true,
        maintenanceMode: false,
        defaultNetwork: 'TRC20',
        googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID || 'G-REWARDRIVER1',
        googleAnalyticsEnabled: true,
        metaTitle: 'Reward River - Real Opinions. Real Value.',
        metaDescription: 'Discover available research surveys, share verified opinions, and earn rewards paid directly to your TRC-20 or ERC-20 USDT crypto wallet.',
        metaKeywords: 'surveys, earn usdt, crypto rewards, cpx research, paid surveys, tether rewards',
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
      await fs.mkdir(DATA_DIR, { recursive: true });
      try {
        const fileContent = await fs.readFile(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        this.data = {
          ...this.getDefaultData(),
          ...parsed,
          users: parsed.users || this.getDefaultData().users,
          rewardLedger: parsed.rewardLedger || [],
          withdrawalRequests: parsed.withdrawalRequests || [],
          withdrawalEvents: parsed.withdrawalEvents || [],
          systemSettings: {
            ...this.getDefaultData().systemSettings,
            ...(parsed.systemSettings || {}),
            minWithdrawalCents:
              parsed.systemSettings?.minWithdrawalCents === 500
                ? 2500
                : (parsed.systemSettings?.minWithdrawalCents ?? 2500)
          },
          adminAuditLogs: parsed.adminAuditLogs || []
        };
      } catch {
        // File doesn't exist yet, save default
        await this.persist();
      }

      if (serverSupabase) {
        try {
          const { data: suSettings } = await serverSupabase
            .from('system_settings')
            .select('*')
            .eq('id', 1)
            .single();

          if (suSettings) {
            this.data.systemSettings = {
              ...this.data.systemSettings,
              minWithdrawalCents: suSettings.min_withdrawal_cents ?? this.data.systemSettings.minWithdrawalCents,
              maxWithdrawalCents: suSettings.max_withdrawal_cents ?? this.data.systemSettings.maxWithdrawalCents,
              feeCentsTrc20: suSettings.fee_cents_trc20 ?? this.data.systemSettings.feeCentsTrc20,
              feeCentsErc20: suSettings.fee_cents_erc20 ?? this.data.systemSettings.feeCentsErc20,
              userSharePercent: suSettings.user_share_percent ?? this.data.systemSettings.userSharePercent,
              pointsPerUsdt: suSettings.points_per_usdt ?? this.data.systemSettings.pointsPerUsdt,
              surveyDisplayMode: suSettings.survey_display_mode ?? this.data.systemSettings.surveyDisplayMode,
              cpxAppId: suSettings.cpx_app_id || this.data.systemSettings.cpxAppId,
              cpxHashKey: suSettings.cpx_hash_key || this.data.systemSettings.cpxHashKey,
              aoyApiKey: suSettings.aoy_api_key || this.data.systemSettings.aoyApiKey,
              aoySecretKey: suSettings.aoy_secret_key || this.data.systemSettings.aoySecretKey,
              aoyBearerToken: suSettings.aoy_bearer_token || this.data.systemSettings.aoyBearerToken,
              metaTitle: suSettings.meta_title || this.data.systemSettings.metaTitle,
              metaDescription: suSettings.meta_description || this.data.systemSettings.metaDescription
            };
          }
        } catch {
          // Supabase table optional / not ready yet
        }
      }

      this.initialized = true;
    } catch (e) {
      console.error('Failed to initialize database:', e);
      this.initialized = true;
    }
  }

  private persist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
        await fs.writeFile(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
        await fs.rename(tmpFile, DB_FILE);
      } catch (e) {
        console.error('Failed to persist database file:', e);
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
    return this.data.users.find(u => u.externalOpaqueId === extId);
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
    if (serverSupabase) {
      serverSupabase
        .from('users')
        .upsert({
          id: user.id,
          username: user.username || user.email.split('@')[0],
          email: user.email,
          password_hash: user.passwordHash,
          salt: user.salt,
          role: user.role || 'user',
          has_prompted_phone: user.hasPromptedPhone || false,
          phone_number: user.phoneNumber || user.whatsappNumber || null,
          created_at: user.createdAt,
          updated_at: user.updatedAt
        })
        .then(({ error }) => {
          if (error) console.warn('[Supabase Auto Sync] User upsert note:', error.message);
        });
    }
    return user;
  }

  async updateUser(userId: string, updates: Partial<UserAccount>): Promise<UserAccount | null> {
    const idx = this.data.users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates, updatedAt: new Date().toISOString() };
    await this.persist();
    return this.data.users[idx];
  }

  async deleteUser(userId: string): Promise<boolean> {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter(u => u.id !== userId);
    if (this.data.users.length === initialLen) return false;
    // Clean up related ledger entries and withdrawal requests
    this.data.rewardLedger = this.data.rewardLedger.filter(l => l.userId !== userId);
    this.data.withdrawalRequests = this.data.withdrawalRequests.filter(w => w.userId !== userId);
    await this.persist();
    return true;
  }

  getAllUsers(): Omit<UserAccount, 'passwordHash' | 'salt'>[] {
    return this.data.users.map(({ passwordHash, salt, ...rest }) => rest);
  }

  getAllUsersWithDetails() {
    return this.data.users.map(({ passwordHash, salt, ...user }) => {
      const balances = this.getUserBalances(user.id);
      const userLedger = this.data.rewardLedger.filter(l => l.userId === user.id);
      const completedSurveysCount = userLedger.filter(l => l.entryType === 'credit' && l.status === 'confirmed').length;
      const userWithdrawals = this.data.withdrawalRequests.filter(w => w.userId === user.id);
      
      return {
        ...user,
        balances,
        completedSurveysCount,
        totalTransactionsCount: userLedger.length + userWithdrawals.length,
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

    if (serverSupabase) {
      serverSupabase
        .from('system_settings')
        .upsert({
          id: 1,
          min_withdrawal_cents: this.data.systemSettings.minWithdrawalCents,
          max_withdrawal_cents: this.data.systemSettings.maxWithdrawalCents,
          fee_cents_trc20: this.data.systemSettings.feeCentsTrc20,
          fee_cents_erc20: this.data.systemSettings.feeCentsErc20,
          user_share_percent: this.data.systemSettings.userSharePercent,
          points_per_usdt: this.data.systemSettings.pointsPerUsdt,
          survey_display_mode: this.data.systemSettings.surveyDisplayMode || 'hybrid',
          cpx_app_id: this.data.systemSettings.cpxAppId,
          cpx_hash_key: this.data.systemSettings.cpxHashKey,
          aoy_api_key: this.data.systemSettings.aoyApiKey,
          aoy_secret_key: this.data.systemSettings.aoySecretKey,
          aoy_bearer_token: this.data.systemSettings.aoyBearerToken,
          meta_title: this.data.systemSettings.metaTitle,
          meta_description: this.data.systemSettings.metaDescription,
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
