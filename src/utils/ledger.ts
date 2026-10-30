/**
 * Reward River - Ledger & Accounting State Utilities
 * Strict double-entry style ledger calculation and idempotency validation.
 */

export interface LedgerEntry {
  id: string;
  userId: string;
  providerTxId: string;
  taskId?: string; // task or survey ID
  amountCents: number; // integer minor units (USD cents credited to user)
  points?: number; // hybrid points credited to user (10,000 points = 1 USDT)
  grossCents?: number; // 100% gross CPX survey revenue in USD cents
  adminProfitCents?: number; // hidden admin net profit in USD cents (e.g. 50%)
  appliedSharePercent?: number; // user share % at time of completion (e.g. 50)
  entryType: 'credit' | 'debit' | 'reversal';
  status: 'pending' | 'confirmed' | 'reversed' | 'rejected';
  createdAt: string;
  processedAt?: string;
  reversalRef?: string;
  description?: string;
  cpxOfferId?: string;
  approvedBy?: string; // 'CPX Research S2S' | 'AoyTasks S2S' | Admin email
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
  completedSurveysCount: number;
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
  pointsPerUsdt: number = 5000,
  userSharePercent: number = 50
): UserBalanceSummary {
  let totalConfirmedCredits = 0;
  let totalDebitsAndReversals = 0;
  let pendingCents = 0;
  let totalEarnedCents = 0;
  let totalConfirmedPoints = 0;
  let totalDebitReversalPoints = 0;
  let pendingPointsAccum = 0;
  let totalAdminProfitCents = 0;
  let totalGrossRevenueCents = 0;
  let completedSurveysCount = 0;

  const safePointsRate = pointsPerUsdt > 0 ? pointsPerUsdt : 5000;
  const safeShare = Math.min(100, Math.max(1, Math.round(userSharePercent || 50)));
  const shareRatio = safeShare / 100;
  const centsToPts = (c: number) => Math.round((Math.max(0, c) / safeShare) * safePointsRate);
  const ptsToCents = (pts: number) =>
    Math.round((Math.max(0, pts) / safePointsRate) * shareRatio * 100);

  for (const entry of entries) {
    if (entry.userId !== userId) continue;

    const entryPts =
      typeof entry.points === 'number' && !isNaN(entry.points) && entry.points !== 0
        ? Math.abs(Math.round(entry.points))
        : centsToPts(Math.abs(entry.amountCents));

    if (entry.status === 'confirmed' && entry.entryType === 'credit') {
      totalConfirmedPoints += entryPts;
      completedSurveysCount += 1;
      const gross =
        typeof entry.grossCents === 'number' && entry.grossCents > 0
          ? entry.grossCents
          : Math.round((entryPts / safePointsRate) * 100);
      totalGrossRevenueCents += gross;
    } else if (
      (entry.status === 'confirmed' || entry.status === 'reversed') &&
      (entry.entryType === 'reversal' || entry.entryType === 'debit')
    ) {
      totalDebitReversalPoints += entryPts;
      if (entry.entryType === 'reversal') {
        completedSurveysCount = Math.max(0, completedSurveysCount - 1);
      }
      const grossRev =
        typeof entry.grossCents === 'number' && entry.grossCents > 0
          ? entry.grossCents
          : Math.round((entryPts / safePointsRate) * 100);
      totalGrossRevenueCents = Math.max(0, totalGrossRevenueCents - grossRev);
    } else if (entry.status === 'pending' && entry.entryType === 'credit') {
      pendingPointsAccum += entryPts;
    }
  }

  totalConfirmedCredits = ptsToCents(totalConfirmedPoints);
  totalDebitsAndReversals = ptsToCents(totalDebitReversalPoints);
  pendingCents = ptsToCents(pendingPointsAccum);
  totalEarnedCents = totalConfirmedCredits;
  const netConfirmedEarnings = Math.max(0, totalConfirmedCredits - totalDebitsAndReversals);
  totalAdminProfitCents = Math.max(0, totalGrossRevenueCents - netConfirmedEarnings);

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

  const availableCents = Math.max(0, netConfirmedEarnings - reservedWithdrawalCents);
  const reservedWithdrawalPoints = centsToPts(reservedWithdrawalCents);
  const netConfirmedPoints = Math.max(0, totalConfirmedPoints - totalDebitReversalPoints);
  const availablePoints = Math.max(0, netConfirmedPoints - reservedWithdrawalPoints);

  return {
    availableCents,
    pendingCents,
    totalEarnedCents,
    totalWithdrawnCents,
    reservedWithdrawalCents,
    availablePoints,
    pendingPoints: pendingPointsAccum,
    totalEarnedPoints: totalConfirmedPoints,
    totalWithdrawnPoints: centsToPts(totalWithdrawnCents),
    totalAdminProfitCents,
    totalGrossRevenueCents,
    completedSurveysCount
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
