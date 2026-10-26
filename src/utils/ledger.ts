/**
 * Reward River - Ledger & Accounting State Utilities
 * Strict double-entry style ledger calculation and idempotency validation.
 */

export interface LedgerEntry {
  id: string;
  userId: string;
  providerTxId: string;
  amountCents: number; // integer minor units (USD cents credited to user)
  points?: number; // hybrid points credited to user (10,000 points = 1 USDT)
  grossCents?: number; // 100% gross CPX survey revenue in USD cents
  adminProfitCents?: number; // hidden admin net profit in USD cents (e.g. 60%)
  appliedSharePercent?: number; // user share % at time of completion (e.g. 40)
  entryType: 'credit' | 'debit' | 'reversal';
  status: 'pending' | 'confirmed' | 'reversed';
  createdAt: string;
  processedAt?: string;
  reversalRef?: string;
  description?: string;
  cpxOfferId?: string;
}

export interface WithdrawalRecord {
  id: string;
  userId: string;
  amountCents: number;
  status: 'requested' | 'under_review' | 'approved' | 'processing' | 'paid' | 'rejected' | 'failed' | 'cancelled';
  createdAt: string;
}

export interface UserBalanceSummary {
  availableCents: number;
  pendingCents: number;
  totalEarnedCents: number;
  totalWithdrawnCents: number;
  reservedWithdrawalCents: number;
  availablePoints: number;
  pendingPoints: number;
  totalEarnedPoints: number;
  totalWithdrawnPoints: number;
  totalAdminProfitCents: number;
  totalGrossRevenueCents: number;
}

/**
 * Calculates accurate account balances from immutable ledger entries and withdrawal states.
 * Guarantees zero floating-point discrepancies.
 * Real ("Asl") value of 10,000 Points is $1.00 (hidden from user).
 * At 40% user share, 10,000 Points = 40 user cents ($0.40 USDT).
 */
export function calculateUserBalances(
  userId: string,
  entries: LedgerEntry[],
  withdrawals: WithdrawalRecord[],
  pointsPerUsdt: number = 10000,
  userSharePercent: number = 40
): UserBalanceSummary {
  let totalConfirmedCredits = 0;
  let totalDebitsAndReversals = 0;
  let pendingCents = 0;
  let totalEarnedCents = 0;
  let totalAdminProfitCents = 0;
  let totalGrossRevenueCents = 0;

  const safePointsRate = pointsPerUsdt > 0 ? pointsPerUsdt : 10000;
  const safeShare = Math.min(100, Math.max(1, Math.round(userSharePercent || 40)));
  const centsToPts = (c: number) => Math.round((Math.max(0, c) / safeShare) * safePointsRate);


  for (const entry of entries) {
    if (entry.userId !== userId) continue;

    if (entry.status === 'confirmed') {
      if (entry.entryType === 'credit') {
        totalConfirmedCredits += entry.amountCents;
        totalEarnedCents += entry.amountCents;
        const gross = entry.grossCents ?? Math.round(entry.amountCents / 0.4);
        const profit = entry.adminProfitCents ?? Math.max(0, gross - entry.amountCents);
        totalGrossRevenueCents += gross;
        totalAdminProfitCents += profit;
      } else if (entry.entryType === 'reversal' || entry.entryType === 'debit') {
        const absAmount = Math.abs(entry.amountCents);
        totalDebitsAndReversals += absAmount;
        const grossRev = entry.grossCents ?? Math.round(absAmount / 0.4);
        const profitRev = entry.adminProfitCents ?? Math.max(0, grossRev - absAmount);
        totalGrossRevenueCents = Math.max(0, totalGrossRevenueCents - grossRev);
        totalAdminProfitCents = Math.max(0, totalAdminProfitCents - profitRev);
      }
    } else if (entry.status === 'pending' && entry.entryType === 'credit') {
      pendingCents += entry.amountCents;
    }
  }

  // Active reserved withdrawals (requested, under_review, approved, processing)
  let reservedWithdrawalCents = 0;
  let totalWithdrawnCents = 0;

  for (const w of withdrawals) {
    if (w.userId !== userId) continue;

    if (w.status === 'paid') {
      totalWithdrawnCents += w.amountCents;
      reservedWithdrawalCents += w.amountCents;
    } else if (['requested', 'under_review', 'approved', 'processing'].includes(w.status)) {
      reservedWithdrawalCents += w.amountCents;
    }
    // 'rejected', 'failed', 'cancelled' release the reservation
  }

  const netConfirmedEarnings = totalConfirmedCredits - totalDebitsAndReversals;
  const availableCents = Math.max(0, netConfirmedEarnings - reservedWithdrawalCents);

  return {
    availableCents,
    pendingCents,
    totalEarnedCents,
    totalWithdrawnCents,
    reservedWithdrawalCents,
    availablePoints: centsToPts(availableCents),
    pendingPoints: centsToPts(pendingCents),
    totalEarnedPoints: centsToPts(totalEarnedCents),
    totalWithdrawnPoints: centsToPts(totalWithdrawnCents),
    totalAdminProfitCents,
    totalGrossRevenueCents
  };
}

/**
 * Checks if a provider transaction ID has already been recorded in the ledger.
 */
export function isDuplicateTransaction(providerTxId: string, entries: LedgerEntry[]): boolean {
  if (!providerTxId) return false;
  return entries.some(e => e.providerTxId === providerTxId);
}

/**
 * Validates whether a withdrawal can be submitted given current balance and limits.
 */
export function canSubmitWithdrawal(params: {
  amountCents: number;
  availableCents: number;
  emailVerified: boolean;
  minCents: number;
  maxCents: number;
}): { allowed: boolean; reason?: string } {
  const { amountCents, availableCents, minCents, maxCents } = params;

  if (amountCents < minCents) {
    return { allowed: false, reason: `Minimum withdrawal is $${(minCents / 100).toFixed(2)} USD.` };
  }

  if (amountCents > maxCents) {
    return { allowed: false, reason: `Maximum single withdrawal is $${(maxCents / 100).toFixed(2)} USD.` };
  }

  if (amountCents > availableCents) {
    return { allowed: false, reason: `Insufficient withdrawable balance. Available: $${(availableCents / 100).toFixed(2)}.` };
  }

  return { allowed: true };
}
