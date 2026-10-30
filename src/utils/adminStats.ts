/**
 * Reward River - Server-Side Admin Statistics, Timezone Grouping (Asia/Karachi),
 * and Ledger Data Integrity Verification Engine.
 *
 * Every calculation in this module is 100% deterministic and derived strictly
 * from real database records (users, reward_ledger / points_ledger, task_completions,
 * and withdrawal_requests). Zero random, mock, or placeholder numbers.
 */

import { LedgerEntry, WithdrawalRecord, calculateUserBalances } from './ledger';

export const ADMIN_TIMEZONE = 'Asia/Karachi';
export const ASIA_KARACHI_TZ = 'Asia/Karachi';
const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5 (PKT has no DST)

export type DateRangePreset = 'today' | '7d' | '30d' | 'all' | 'custom';
export type ChartGroupBy = 'day' | 'week' | 'month';

export interface DateFilterOptions {
  range: DateRangePreset;
  startDate?: string; // YYYY-MM-DD in Asia/Karachi
  endDate?: string;   // YYYY-MM-DD in Asia/Karachi
  groupBy?: ChartGroupBy;
  nowIso?: string;
}

export interface TaskDefinitionRecord {
  id: string;
  taskType: 'survey' | 'ptc' | 'shortlink' | 'screenout_bonus' | 'Verification' | 'custom';
  title: string;
  description: string;
  rewardPoints: number;
  isActive: boolean;
  dailyLimit: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface TaskCompletionRecord {
  id: string;
  userId: string;
  taskId: string;
  providerTxId: string;
  title: string;
  pointsAwarded: number;
  status: 'completed' | 'pending' | 'rejected' | 'reversed';
  approvedBy: string;
  createdAt: string;
  processedAt?: string;
}

export interface TimeSeriesPoint {
  period: string;
  bucketKey: string;
  label: string;
  tasksCompleted: number;
  tasksPending: number;
  tasksRejected: number;
  pointsAwarded: number;
  pointsRedeemed: number;
  newUsers: number;
  grossRevenueCents: number;
  adminProfitCents: number;
}

export interface DataIntegrityMismatch {
  userId: string;
  email: string;
  issueType: 'points_mismatch' | 'missing_user_id' | 'duplicate_tx_id' | 'orphan_ledger_entry';
  ledgerPoints: number;
  storedPoints: number;
  difference: number;
  details: string;
}

export interface DataIntegrityReport {
  checkedAt: string;
  checkedAtKarachi: string;
  timezone: string;
  totalUsersChecked: number;
  totalLedgerEntriesChecked: number;
  isHealthy: boolean;
  mismatchCount: number;
  mismatchedUsersCount: number;
  duplicateTxIdsCount: number;
  sumOfLedgerAvailablePoints: number;
  sumOfStoredUserPoints: number;
  globalPointsDelta: number;
  mismatches: DataIntegrityMismatch[];
  summary: {
    sumOfAllUserLedgerPoints: number;
    sumOfAllStoredUserPoints: number;
    duplicateTxCount: number;
    orphanEntryCount: number;
    usersWithValidPermanentId: number;
  };
}

/**
 * Converts any ISO timestamp or Date to a Date shifted to Asia/Karachi (+05:00)
 * so UTC getters (.getUTCFullYear, .getUTCMonth, .getUTCDate) yield exact Asia/Karachi calendar fields.
 */
function toKarachiShiftedDate(isoOrDate?: string | Date): Date {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  const ms = isNaN(d.getTime()) ? Date.now() : d.getTime();
  return new Date(ms + KARACHI_OFFSET_MS);
}

/**
 * Returns YYYY-MM-DD in Asia/Karachi timezone.
 */
export function toKarachiDateKey(isoOrDate?: string | Date): string {
  const kd = toKarachiShiftedDate(isoOrDate);
  const y = kd.getUTCFullYear();
  const m = String(kd.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kd.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns YYYY-MM in Asia/Karachi timezone.
 */
export function toKarachiMonthKey(isoOrDate?: string | Date): string {
  return toKarachiDateKey(isoOrDate).slice(0, 7);
}

/**
 * Returns ISO week start key (YYYY-MM-DD of Monday in Asia/Karachi) for weekly chart grouping.
 */
export function toKarachiWeekKey(isoOrDate?: string | Date): string {
  const kd = toKarachiShiftedDate(isoOrDate);
  const dayOfWeek = kd.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(kd.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const d = String(monday.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats an ISO timestamp in Asia/Karachi timezone ("YYYY-MM-DD HH:mm PKT").
 */
export function formatKarachiDateTime(isoTimestamp?: string): string {
  if (!isoTimestamp) return '—';
  const d = new Date(isoTimestamp);
  if (isNaN(d.getTime())) return '—';
  const kd = toKarachiShiftedDate(d);
  const y = kd.getUTCFullYear();
  const m = String(kd.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kd.getUTCDate()).padStart(2, '0');
  const hh = String(kd.getUTCHours()).padStart(2, '0');
  const mm = String(kd.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm} PKT`;
}

/**
 * Computes the inclusive [startDateKey, endDateKey] in Asia/Karachi (YYYY-MM-DD) for a filter.
 */
export function resolveKarachiDateBounds(filter: DateFilterOptions): {
  startKey: string;
  endKey: string;
} {
  const nowKd = toKarachiShiftedDate(filter.nowIso);
  const todayKey = toKarachiDateKey(filter.nowIso);

  if (filter.range === 'today') {
    return { startKey: todayKey, endKey: todayKey };
  }
  if (filter.range === '7d') {
    const startKd = new Date(nowKd.getTime() - 6 * 24 * 60 * 60 * 1000);
    const y = startKd.getUTCFullYear();
    const m = String(startKd.getUTCMonth() + 1).padStart(2, '0');
    const d = String(startKd.getUTCDate()).padStart(2, '0');
    return { startKey: `${y}-${m}-${d}`, endKey: todayKey };
  }
  if (filter.range === '30d') {
    const startKd = new Date(nowKd.getTime() - 29 * 24 * 60 * 60 * 1000);
    const y = startKd.getUTCFullYear();
    const m = String(startKd.getUTCMonth() + 1).padStart(2, '0');
    const d = String(startKd.getUTCDate()).padStart(2, '0');
    return { startKey: `${y}-${m}-${d}`, endKey: todayKey };
  }
  if (filter.range === 'custom') {
    const s = (filter.startDate || '').trim() || '2020-01-01';
    const e = (filter.endDate || '').trim() || todayKey;
    return s <= e ? { startKey: s, endKey: e } : { startKey: e, endKey: s };
  }
  // 'all'
  return { startKey: '2020-01-01', endKey: todayKey };
}

/**
 * Checks whether an ISO timestamp falls within the resolved Asia/Karachi date range.
 */
export function isWithinKarachiDateRange(isoTimestamp: string | undefined, filter: DateFilterOptions): boolean {
  if (filter.range === 'all') return true;
  if (!isoTimestamp) return false;
  const key = toKarachiDateKey(isoTimestamp);
  const { startKey, endKey } = resolveKarachiDateBounds(filter);
  return key >= startKey && key <= endKey;
}

/**
 * Classifies whether a user is "new" (registered within the last 7 days in Asia/Karachi)
 * or "old" (registered earlier than 7 days ago).
 */
export function classifyUserCohort(createdAtIso: string | undefined, nowIso?: string): 'new' | 'old' {
  if (!createdAtIso) return 'old';
  const createdKey = toKarachiDateKey(createdAtIso);
  const { startKey } = resolveKarachiDateBounds({ range: '7d', nowIso });
  return createdKey >= startKey ? 'new' : 'old';
}

/**
 * Runs a full server-side Data Integrity Check comparing ledger totals vs stored user totals,
 * checking permanent user IDs, duplicate transaction IDs, and orphaned ledger entries.
 */
export function verifyDataIntegrity(params: {
  users: Array<{
    id: string;
    email: string;
    externalOpaqueId?: string;
    storedPoints?: number;
  }>;
  ledger: LedgerEntry[];
  withdrawals: WithdrawalRecord[];
  pointsPerUsdt?: number;
  userSharePercent?: number;
}): DataIntegrityReport {
  const {
    users,
    ledger,
    withdrawals,
    pointsPerUsdt = 5000,
    userSharePercent = 50
  } = params;

  const mismatches: DataIntegrityMismatch[] = [];
  const userIds = new Set<string>();
  const externalIdsToUserId = new Map<string, string>();
  let usersWithValidPermanentId = 0;
  let sumOfAllUserLedgerPoints = 0;
  let sumOfAllStoredUserPoints = 0;

  for (const u of users) {
    const cleanId = String(u.id || '').trim();
    userIds.add(cleanId);
    userIds.add(cleanId.replace(/^usr_/, ''));
    userIds.add(cleanId.startsWith('usr_') ? cleanId : `usr_${cleanId}`);
    if (u.externalOpaqueId) {
      externalIdsToUserId.set(u.externalOpaqueId, cleanId);
    }

    const hasValidId = cleanId.length >= 4 && !cleanId.includes('@') && !cleanId.includes(' ');
    if (hasValidId) {
      usersWithValidPermanentId += 1;
    } else {
      mismatches.push({
        userId: cleanId || 'MISSING_ID',
        email: u.email,
        issueType: 'missing_user_id',
        ledgerPoints: 0,
        storedPoints: u.storedPoints ?? 0,
        difference: 0,
        details: `User ${u.email} does not have a valid permanent ID.`
      });
    }

    // Normalize entries belonging to this user
    const rawCleanId = cleanId;
    const cleanNoUsr = rawCleanId.replace(/^usr_/, '');
    const cleanWithUsr = rawCleanId.startsWith('usr_') ? rawCleanId : `usr_${rawCleanId}`;
    const userEntries = ledger
      .filter(
        l =>
          l.userId === rawCleanId ||
          l.userId === cleanNoUsr ||
          l.userId === cleanWithUsr ||
          (u.externalOpaqueId && l.userId === u.externalOpaqueId)
      )
      .map(l => (l.userId === rawCleanId ? l : { ...l, userId: rawCleanId }));
    const userWithdrawals = withdrawals
      .filter(w => w.userId === rawCleanId || w.userId === cleanNoUsr || w.userId === cleanWithUsr)
      .map(w => (w.userId === rawCleanId ? w : { ...w, userId: rawCleanId }));

    const computed = calculateUserBalances(
      rawCleanId,
      userEntries,
      userWithdrawals,
      pointsPerUsdt,
      userSharePercent
    );

    const ledgerPts = computed.availablePoints;
    const storedPts = typeof u.storedPoints === 'number' ? Math.round(u.storedPoints) : ledgerPts;

    sumOfAllUserLedgerPoints += ledgerPts;
    sumOfAllStoredUserPoints += storedPts;

    if (ledgerPts !== storedPts) {
      mismatches.push({
        userId: rawCleanId,
        email: u.email,
        issueType: 'points_mismatch',
        ledgerPoints: ledgerPts,
        storedPoints: storedPts,
        difference: ledgerPts - storedPts,
        details: `Ledger sum is ${ledgerPts.toLocaleString('en-US')} Pts but stored user record has ${storedPts.toLocaleString('en-US')} Pts.`
      });
    }
  }

  // Check duplicate providerTxId and orphaned ledger entries
  const seenTxIds = new Set<string>();
  let duplicateTxCount = 0;
  let orphanEntryCount = 0;

  for (const entry of ledger) {
    const txId = String(entry.providerTxId || '').trim();
    if (txId) {
      if (seenTxIds.has(txId)) {
        duplicateTxCount += 1;
        mismatches.push({
          userId: entry.userId,
          email: 'unknown',
          issueType: 'duplicate_tx_id',
          ledgerPoints: entry.points || 0,
          storedPoints: 0,
          difference: entry.points || 0,
          details: `Duplicate provider_tx_id "${txId}" detected in ledger.`
        });
      } else {
        seenTxIds.add(txId);
      }
    }

    const uid = String(entry.userId || '').trim();
    if (!userIds.has(uid) && !externalIdsToUserId.has(uid)) {
      orphanEntryCount += 1;
      mismatches.push({
        userId: uid,
        email: 'unlinked',
        issueType: 'orphan_ledger_entry',
        ledgerPoints: entry.points || 0,
        storedPoints: 0,
        difference: entry.points || 0,
        details: `Ledger entry "${entry.id}" (tx: ${txId}) references userId "${uid}" which has no matching user profile.`
      });
    }
  }

  const checkedAtIso = new Date().toISOString();
  const mismatchedUsersCount = mismatches.filter(
    m => m.issueType === 'points_mismatch' || m.issueType === 'missing_user_id'
  ).length;

  return {
    checkedAt: checkedAtIso,
    checkedAtKarachi: formatKarachiDateTime(checkedAtIso),
    timezone: ADMIN_TIMEZONE,
    totalUsersChecked: users.length,
    totalLedgerEntriesChecked: ledger.length,
    isHealthy: mismatches.length === 0,
    mismatchCount: mismatches.length,
    mismatchedUsersCount,
    duplicateTxIdsCount: duplicateTxCount,
    sumOfLedgerAvailablePoints: sumOfAllUserLedgerPoints,
    sumOfStoredUserPoints: sumOfAllStoredUserPoints,
    globalPointsDelta: sumOfAllUserLedgerPoints - sumOfAllStoredUserPoints,
    mismatches,
    summary: {
      sumOfAllUserLedgerPoints,
      sumOfAllStoredUserPoints,
      duplicateTxCount,
      orphanEntryCount,
      usersWithValidPermanentId
    }
  };
}

/**
 * Computes all Admin Dashboard statistics from real database records with date filtering
 * and Asia/Karachi timezone grouping.
 */
export function computeAdminDashboardStats(params: {
  users: Array<{
    id: string;
    email: string;
    username?: string;
    displayName: string;
    externalOpaqueId?: string;
    phoneNumber?: string;
    whatsappNumber?: string;
    countryCode?: string;
    emailVerified: boolean;
    role: 'user' | 'admin';
    createdAt: string;
    updatedAt?: string;
  }>;
  ledger: LedgerEntry[];
  withdrawals: WithdrawalRecord[];
  taskCompletions?: TaskCompletionRecord[];
  filter?: DateFilterOptions;
  range?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  groupBy?: ChartGroupBy;
  nowIso?: string;
  pointsPerUsdt?: number;
  userSharePercent?: number;
}) {
  const {
    users,
    ledger,
    withdrawals,
    taskCompletions = [],
    pointsPerUsdt = 5000,
    userSharePercent = 50
  } = params;

  const filter: DateFilterOptions = params.filter || {
    range: params.range || 'all',
    startDate: params.startDate,
    endDate: params.endDate,
    groupBy: params.groupBy || 'day',
    nowIso: params.nowIso
  };

  const nowIso = filter.nowIso || params.nowIso || new Date().toISOString();
  const todayKey = toKarachiDateKey(nowIso);
  const bounds7d = resolveKarachiDateBounds({ range: '7d', nowIso });
  const bounds30d = resolveKarachiDateBounds({ range: '30d', nowIso });
  const activeBounds = resolveKarachiDateBounds({ ...filter, nowIso });
  const groupBy: ChartGroupBy = filter.groupBy || params.groupBy || 'day';

  // 1. User Cohort Calculations (Asia/Karachi timezone)
  const totalUsers = users.length;
  let newUsersToday = 0;
  let newUsers7d = 0;
  let newUsers30d = 0;
  let oldUsersCount = 0;
  let newUsersInFilter = 0;

  for (const u of users) {
    const joinedKey = toKarachiDateKey(u.createdAt);
    if (joinedKey === todayKey) newUsersToday += 1;
    if (joinedKey >= bounds7d.startKey && joinedKey <= bounds7d.endKey) {
      newUsers7d += 1;
    } else {
      oldUsersCount += 1;
    }
    if (joinedKey >= bounds30d.startKey && joinedKey <= bounds30d.endKey) {
      newUsers30d += 1;
    }
    if (isWithinKarachiDateRange(u.createdAt, { ...filter, nowIso })) {
      newUsersInFilter += 1;
    }
  }

  // 2. Per-User Ledger Balances (All-Time & Filtered)
  const userLookup = new Map<string, (typeof users)[number]>();
  for (const u of users) {
    userLookup.set(u.id, u);
    userLookup.set(u.id.replace(/^usr_/, ''), u);
    if (!u.id.startsWith('usr_')) userLookup.set(`usr_${u.id}`, u);
    if (u.externalOpaqueId) userLookup.set(u.externalOpaqueId, u);
  }

  const entryToPts = (l: LedgerEntry) =>
    typeof l.points === 'number' && !isNaN(l.points) && l.points !== 0
      ? Math.abs(Math.round(l.points))
      : Math.max(0, Math.round(Math.abs(l.amountCents) * 100));

  // Filter ledger & withdrawals by date range when a specific range is chosen
  const filteredLedger = ledger.filter(l => isWithinKarachiDateRange(l.createdAt, { ...filter, nowIso }));
  const filteredWithdrawals = withdrawals.filter(w => isWithinKarachiDateRange(w.createdAt, { ...filter, nowIso }));
  const filteredTaskCompletions = taskCompletions.filter(tc =>
    isWithinKarachiDateRange(tc.createdAt, { ...filter, nowIso })
  );

  // 3. Task counts (Completed, Pending, Rejected/Reversed) within active filter
  const tasksCompletedCount = filteredLedger.filter(
    l => l.status === 'confirmed' && l.entryType === 'credit'
  ).length;

  const pendingLedgerCount = filteredLedger.filter(l => l.status === 'pending').length;
  const pendingCompletionsOnly = filteredTaskCompletions.filter(
    tc => tc.status === 'pending' && !filteredLedger.some(l => l.providerTxId === tc.providerTxId)
  ).length;
  const tasksPendingCount = pendingLedgerCount + pendingCompletionsOnly;

  const rejectedLedgerCount = filteredLedger.filter(
    l => l.status === 'reversed' || l.status === 'rejected' || l.entryType === 'reversal'
  ).length;
  const rejectedCompletionsOnly = filteredTaskCompletions.filter(
    tc =>
      (tc.status === 'rejected' || tc.status === 'reversed') &&
      !filteredLedger.some(l => l.providerTxId === tc.providerTxId || l.reversalRef === tc.providerTxId)
  ).length;
  const tasksRejectedCount = rejectedLedgerCount + rejectedCompletionsOnly;

  const allTimeCompletedCount = ledger.filter(l => l.status === 'confirmed' && l.entryType === 'credit').length;
  const allTimePendingCount =
    ledger.filter(l => l.status === 'pending').length +
    taskCompletions.filter(tc => tc.status === 'pending' && !ledger.some(l => l.providerTxId === tc.providerTxId)).length;
  const allTimeRejectedCount =
    ledger.filter(l => l.status === 'reversed' || l.status === 'rejected' || l.entryType === 'reversal').length +
    taskCompletions.filter(
      tc =>
        (tc.status === 'rejected' || tc.status === 'reversed') &&
        !ledger.some(l => l.providerTxId === tc.providerTxId || l.reversalRef === tc.providerTxId)
    ).length;

  // 4. All-time and Filtered Points Totals
  let allTimePointsAwarded = 0;
  let allTimePointsReversed = 0;
  let allTimePointsDebited = 0;

  for (const l of ledger) {
    const pts = entryToPts(l);
    if (l.status === 'confirmed' && l.entryType === 'credit') {
      allTimePointsAwarded += pts;
    } else if ((l.status === 'confirmed' || l.status === 'reversed') && l.entryType === 'reversal') {
      allTimePointsReversed += pts;
    } else if (l.status === 'confirmed' && l.entryType === 'debit') {
      allTimePointsDebited += pts;
    }
  }

  const allTimeWithdrawnCents = withdrawals
    .filter(w => ['paid', 'approved', 'processing', 'under_review', 'requested'].includes(w.status))
    .reduce((sum, w) => sum + w.amountCents, 0);
  const allTimePaidWithdrawnCents = withdrawals
    .filter(w => w.status === 'paid')
    .reduce((sum, w) => sum + w.amountCents, 0);

  // 10,000 Points = $1.00 USD (100 cents) -> 1 cent = 100 Points
  const allTimeWithdrawnPoints = Math.round(allTimeWithdrawnCents * 100) + allTimePointsDebited;
  const allTimePaidWithdrawnPoints = Math.round(allTimePaidWithdrawnCents * 100) + allTimePointsDebited;
  const netAllTimeAwardedPoints = Math.max(0, allTimePointsAwarded - allTimePointsReversed);
  const outstandingPointsBalance = Math.max(0, netAllTimeAwardedPoints - allTimeWithdrawnPoints);

  // Filtered window points
  let filteredPointsAwarded = 0;
  let filteredPointsReversed = 0;
  let filteredPointsDebited = 0;
  for (const l of filteredLedger) {
    const pts = entryToPts(l);
    if (l.status === 'confirmed' && l.entryType === 'credit') {
      filteredPointsAwarded += pts;
    } else if ((l.status === 'confirmed' || l.status === 'reversed') && l.entryType === 'reversal') {
      filteredPointsReversed += pts;
    } else if (l.status === 'confirmed' && l.entryType === 'debit') {
      filteredPointsDebited += pts;
    }
  }
  const filteredWithdrawnCents = filteredWithdrawals
    .filter(w => ['paid', 'approved', 'processing', 'under_review', 'requested'].includes(w.status))
    .reduce((sum, w) => sum + w.amountCents, 0);
  const filteredPointsRedeemed = Math.round(filteredWithdrawnCents * 100) + filteredPointsDebited;
  const netFilteredPointsAwarded = Math.max(0, filteredPointsAwarded - filteredPointsReversed);

  // 5. Active Users & Top 10 Users by Points
  const userSummaries = users.map(u => {
    const rawCleanId = u.id;
    const cleanNoUsr = rawCleanId.replace(/^usr_/, '');
    const cleanWithUsr = rawCleanId.startsWith('usr_') ? rawCleanId : `usr_${rawCleanId}`;
    const uEntries = ledger
      .filter(
        l =>
          l.userId === rawCleanId ||
          l.userId === cleanNoUsr ||
          l.userId === cleanWithUsr ||
          (u.externalOpaqueId && l.userId === u.externalOpaqueId)
      )
      .map(l => (l.userId === rawCleanId ? l : { ...l, userId: rawCleanId }));
    const uWithdrawals = withdrawals
      .filter(w => w.userId === rawCleanId || w.userId === cleanNoUsr || w.userId === cleanWithUsr)
      .map(w => (w.userId === rawCleanId ? w : { ...w, userId: rawCleanId }));

    const balances = calculateUserBalances(
      rawCleanId,
      uEntries,
      uWithdrawals,
      pointsPerUsdt,
      userSharePercent
    );

    const latestEntryIso = uEntries.reduce(
      (latest, e) => (e.createdAt > latest ? e.createdAt : latest),
      u.updatedAt || u.createdAt
    );

    const pendingTasks = uEntries.filter(e => e.status === 'pending').length;
    const rejectedTasks = uEntries.filter(
      e => e.status === 'reversed' || e.status === 'rejected' || e.entryType === 'reversal'
    ).length;

    const activeInFilter = uEntries.some(e => isWithinKarachiDateRange(e.createdAt, { ...filter, nowIso })) ||
      uWithdrawals.some(w => isWithinKarachiDateRange(w.createdAt, { ...filter, nowIso }));

    return {
      id: u.id,
      externalOpaqueId: u.externalOpaqueId || '',
      displayName: u.displayName || u.username || u.email.split('@')[0],
      email: u.email,
      phoneNumber: u.phoneNumber || u.whatsappNumber || '',
      countryCode: u.countryCode || '',
      cohort: classifyUserCohort(u.createdAt, nowIso),
      createdAt: u.createdAt,
      joinedAt: u.createdAt,
      createdAtKarachi: formatKarachiDateTime(u.createdAt),
      lastActiveAt: latestEntryIso,
      lastActiveAtKarachi: formatKarachiDateTime(latestEntryIso),
      tasksCompleted: balances.completedSurveysCount,
      tasksPending: pendingTasks,
      tasksRejected: rejectedTasks,
      totalEarnedPoints: balances.totalEarnedPoints,
      availablePoints: balances.availablePoints,
      withdrawnPoints: balances.totalWithdrawnPoints,
      redeemedPoints: balances.totalWithdrawnPoints,
      availableUsd: (balances.availableCents / 100).toFixed(2),
      totalEarnedUsd: (balances.totalEarnedCents / 100).toFixed(2),
      activeInFilter
    };
  });

  const activeUsersCount = userSummaries.filter(
    u => u.tasksCompleted > 0 || u.availablePoints > 0 || u.totalEarnedPoints > 0
  ).length;
  const activeUsersInRange =
    filter.range === 'all'
      ? activeUsersCount
      : userSummaries.filter(u => u.activeInFilter).length;

  const topUsersByPoints = [...userSummaries]
    .sort((a, b) => b.totalEarnedPoints - a.totalEarnedPoints || b.availablePoints - a.availablePoints)
    .slice(0, 10)
    .map((u, idx) => ({
      rank: idx + 1,
      ...u
    }));

  // 6. Build Daily / Weekly / Monthly Time-Series Chart Data in Asia/Karachi
  const periodKeyFor = (iso: string): string => {
    if (groupBy === 'month') return toKarachiMonthKey(iso);
    if (groupBy === 'week') return toKarachiWeekKey(iso);
    return toKarachiDateKey(iso);
  };

  const buckets = new Map<string, TimeSeriesPoint>();
  const ensureBucket = (period: string): TimeSeriesPoint => {
    const existing = buckets.get(period);
    if (existing) return existing;
    const created: TimeSeriesPoint = {
      period,
      bucketKey: period,
      label: groupBy === 'week' ? `Wk of ${period}` : period,
      tasksCompleted: 0,
      tasksPending: 0,
      tasksRejected: 0,
      pointsAwarded: 0,
      pointsRedeemed: 0,
      newUsers: 0,
      grossRevenueCents: 0,
      adminProfitCents: 0
    };
    buckets.set(period, created);
    return created;
  };

  // Pre-seed daily buckets for 7d or today so the chart has continuous dates when grouped by day
  if (groupBy === 'day' && (filter.range === 'today' || filter.range === '7d' || filter.range === '30d')) {
    const daysCount = filter.range === 'today' ? 1 : filter.range === '7d' ? 7 : 30;
    const nowKd = toKarachiShiftedDate(nowIso);
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(nowKd.getTime() - i * 24 * 60 * 60 * 1000);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      ensureBucket(`${y}-${m}-${day}`);
    }
  }

  for (const u of users) {
    if (!isWithinKarachiDateRange(u.createdAt, { ...filter, nowIso })) continue;
    const b = ensureBucket(periodKeyFor(u.createdAt));
    b.newUsers += 1;
  }

  for (const l of filteredLedger) {
    const b = ensureBucket(periodKeyFor(l.createdAt));
    const pts = entryToPts(l);
    const gross = l.grossCents && l.grossCents >= l.amountCents ? l.grossCents : Math.round((pts / pointsPerUsdt) * 100);
    const profit = Math.max(0, gross - l.amountCents);

    if (l.status === 'confirmed' && l.entryType === 'credit') {
      b.tasksCompleted += 1;
      b.pointsAwarded += pts;
      b.grossRevenueCents += gross;
      b.adminProfitCents += profit;
    } else if (l.status === 'pending') {
      b.tasksPending += 1;
    } else if (l.status === 'reversed' || l.status === 'rejected' || l.entryType === 'reversal') {
      b.tasksRejected += 1;
      b.pointsAwarded = Math.max(0, b.pointsAwarded - pts);
    } else if (l.status === 'confirmed' && l.entryType === 'debit') {
      b.pointsRedeemed += pts;
    }
  }

  for (const w of filteredWithdrawals) {
    if (['paid', 'approved', 'processing', 'under_review', 'requested'].includes(w.status)) {
      const b = ensureBucket(periodKeyFor(w.createdAt));
      b.pointsRedeemed += Math.round(w.amountCents * 100);
    }
  }

  const timeSeries = Array.from(buckets.values()).sort((a, b) => a.period.localeCompare(b.period));

  const filterMeta = {
    range: filter.range,
    groupBy,
    startDate: activeBounds.startKey,
    endDate: activeBounds.endKey
  };

  return {
    timezone: ADMIN_TIMEZONE,
    filter: filterMeta,
    dateFilter: filterMeta,
    users: {
      totalUsers,
      newUsersToday,
      newUsers7d,
      newUsers30d,
      newUsersCount: newUsers7d, // New = registered in last 7 days
      oldUsersCount,             // Old = registered earlier than 7 days ago
      activeUsersCount,
      activeUsersInRange,
      activeUsersAllTime: activeUsersCount,
      inactiveUsersCount: Math.max(0, totalUsers - activeUsersCount),
      newUsersInFilter
    },
    tasks: {
      tasksCompletedCount,
      tasksPendingCount,
      tasksRejectedCount,
      completedCount: tasksCompletedCount,
      pendingCount: tasksPendingCount,
      rejectedCount: tasksRejectedCount,
      allTimeCompletedCount,
      completedAllTime: allTimeCompletedCount,
      pendingAllTime: allTimePendingCount,
      rejectedAllTime: allTimeRejectedCount
    },
    points: {
      totalPointsAwarded: netFilteredPointsAwarded,
      totalPointsRedeemed: filteredPointsRedeemed,
      outstandingPointsBalance,
      allTimePointsAwarded: netAllTimeAwardedPoints,
      totalPointsAwardedAllTime: netAllTimeAwardedPoints,
      allTimePointsRedeemed: allTimeWithdrawnPoints,
      allTimePaidWithdrawnPoints
    },
    topUsersByPoints,
    timeSeries
  };
}
