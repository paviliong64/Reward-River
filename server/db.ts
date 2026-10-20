import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LedgerEntry, WithdrawalRecord, calculateUserBalances, isDuplicateTransaction } from '../src/utils/ledger';

export interface UserAccount {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  displayName: string;
  emailVerified: boolean;
  role: 'user' | 'admin';
  externalOpaqueId: string; // Opaque ID for CPX survey sessions
  createdAt: string;
  updatedAt: string;
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
  minWithdrawalCents: number;
  maxWithdrawalCents: number;
  feeCentsTrc20: number;
  feeCentsErc20: number;
  maintenanceMode: boolean;
  defaultNetwork: 'TRC20' | 'ERC20';
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
        minWithdrawalCents: 500, // $5.00 min
        maxWithdrawalCents: 50000, // $500.00 max
        feeCentsTrc20: 100, // $1.00 USDT fee for TRC-20
        feeCentsErc20: 250, // $2.50 USDT fee for ERC-20
        maintenanceMode: false,
        defaultNetwork: 'TRC20',
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
            ...(parsed.systemSettings || {})
          },
          adminAuditLogs: parsed.adminAuditLogs || []
        };
      } catch {
        // File doesn't exist yet, save default
        await this.persist();
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

  getUserByExternalId(extId: string): UserAccount | undefined {
    return this.data.users.find(u => u.externalOpaqueId === extId);
  }

  async createUser(user: UserAccount): Promise<UserAccount> {
    this.data.users.push(user);
    await this.persist();
    return user;
  }

  async updateUser(userId: string, updates: Partial<UserAccount>): Promise<UserAccount | null> {
    const idx = this.data.users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...updates, updatedAt: new Date().toISOString() };
    await this.persist();
    return this.data.users[idx];
  }

  getAllUsers(): Omit<UserAccount, 'passwordHash' | 'salt'>[] {
    return this.data.users.map(({ passwordHash, salt, ...rest }) => rest);
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
    return calculateUserBalances(userId, entries, withdrawals);
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
