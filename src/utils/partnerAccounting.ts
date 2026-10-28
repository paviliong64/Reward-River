import { LedgerEntry } from './ledger';

export type PartnerId = 'cpx_research' | 'aoytasks';

export type PartnerSubCategory = 'cpx_survey' | 'aoy_ptc' | 'aoy_shortlink';

export interface PartnerAccountingMetrics {
  partnerId: PartnerId;
  partnerName: string;
  userFacingBrand: string;
  integrationType: string;
  isWhiteLabelHidden: boolean;
  completedCount: number;
  reversalCount: number;
  grossRevenueCents: number;
  userPayoutCents: number;
  userPayoutPoints: number;
  adminProfitCents: number;
  chargebackGrossCents: number;
  avgGrossCents: number;
  avgAdminProfitCents: number;
  effectiveAdminMarginPercent: number;
  shareOfTotalProfitPercent: number;
  grossRevenueUsdFormatted: string;
  userPayoutUsdFormatted: string;
  adminProfitUsdFormatted: string;
  ptcCompletedCount?: number;
  shortlinkCompletedCount?: number;
}

export interface PartnerUnitEconomicsRow {
  pointsMilestone: number;
  pointsFormatted: string;
  partnerPaysGrossCents: number;
  partnerPaysGrossUsd: string;
  userGetsCents: number;
  userGetsUsd: string;
  adminKeepsProfitCents: number;
  adminKeepsProfitUsd: string;
}

export interface EnrichedPartnerLedgerItem extends LedgerEntry {
  partnerId: PartnerId;
  partnerName: string;
  subCategory: PartnerSubCategory;
  subCategoryLabel: string;
  grossCents: number;
  adminProfitCents: number;
  appliedSharePercent: number;
  points: number;
  userEmail?: string;
  userDisplayName?: string;
}

export interface PlatformPartnerAccountingReport {
  userSharePercent: number;
  adminProfitPercent: number;
  pointsPerUsdt: number;
  totals: {
    completedCount: number;
    reversalCount: number;
    grossRevenueCents: number;
    userPayoutCents: number;
    userPayoutPoints: number;
    adminProfitCents: number;
    chargebackGrossCents: number;
    grossRevenueUsdFormatted: string;
    userPayoutUsdFormatted: string;
    adminProfitUsdFormatted: string;
  };
  partners: PartnerAccountingMetrics[];
  unitEconomics: PartnerUnitEconomicsRow[];
  ledgerWithPartners: EnrichedPartnerLedgerItem[];
}

/**
 * Classifies a ledger entry into its originating provider ('cpx_research' vs 'aoytasks')
 * and sub-category ('cpx_survey' | 'aoy_ptc' | 'aoy_shortlink').
 */
export function classifyLedgerPartner(entry: Partial<LedgerEntry>): {
  partnerId: PartnerId;
  partnerName: string;
  subCategory: PartnerSubCategory;
  subCategoryLabel: string;
} {
  const txId = String(entry.providerTxId || '').toLowerCase();
  const offerId = String(entry.cpxOfferId || '').toLowerCase();
  const desc = String(entry.description || '').toLowerCase();

  const isAoy =
    txId.startsWith('aoy_') ||
    txId.startsWith('rr_task_') ||
    offerId.startsWith('ptc_') ||
    offerId.startsWith('shortlink_') ||
    offerId.startsWith('sl_') ||
    offerId.startsWith('task_') ||
    desc.includes('instant task') ||
    desc.includes('task reversal') ||
    desc.includes('shortlink') ||
    desc.includes('ptc');

  if (isAoy) {
    const isShortlink =
      offerId.includes('shortlink') ||
      offerId.startsWith('sl_') ||
      desc.includes('shortlink') ||
      desc.includes('express link') ||
      desc.includes('multi-step');

    return {
      partnerId: 'aoytasks',
      partnerName: 'AoyTasks (aoyco.in)',
      subCategory: isShortlink ? 'aoy_shortlink' : 'aoy_ptc',
      subCategoryLabel: isShortlink ? 'AoyTasks Shortlink' : 'AoyTasks PTC Ad'
    };
  }

  return {
    partnerId: 'cpx_research',
    partnerName: 'CPX Research',
    subCategory: 'cpx_survey',
    subCategoryLabel: 'CPX Survey'
  };
}

/**
 * Computes unit economics milestones (e.g., 1,000 / 10,000 / 50,000 / 100,000 / 1,000,000 Points)
 * so the Admin can see at a glance:
 * - Partner Pays Us (100% Gross)
 * - User Gets (e.g., 40% Share)
 * - Our Net Profit (e.g., 60% Share)
 */
export function calculatePartnerUnitEconomics(
  userSharePercent = 40,
  pointsPerUsdt = 10000
): PartnerUnitEconomicsRow[] {
  const safeShare = Math.min(100, Math.max(1, Math.round(Number(userSharePercent) || 40)));
  const safePointsPerUsdt = Math.max(100, Math.round(Number(pointsPerUsdt) || 10000));
  const milestones = [1000, safePointsPerUsdt, safePointsPerUsdt * 5, safePointsPerUsdt * 10, safePointsPerUsdt * 100];

  // Deduplicate in case safePointsPerUsdt === 1000
  const uniqueMilestones = Array.from(new Set(milestones)).sort((a, b) => a - b);

  return uniqueMilestones.map((pts) => {
    const grossCents = Math.round((pts / safePointsPerUsdt) * 100);
    const userCents = Math.round(grossCents * (safeShare / 100));
    const adminCents = Math.max(0, grossCents - userCents);

    return {
      pointsMilestone: pts,
      pointsFormatted: `${pts.toLocaleString('en-US')} Pts`,
      partnerPaysGrossCents: grossCents,
      partnerPaysGrossUsd: `$${(grossCents / 100).toFixed(2)}`,
      userGetsCents: userCents,
      userGetsUsd: `$${(userCents / 100).toFixed(2)}`,
      adminKeepsProfitCents: adminCents,
      adminKeepsProfitUsd: `$${(adminCents / 100).toFixed(2)}`
    };
  });
}

/**
 * Aggregates the complete Partner Revenue, User Share, and Platform Net Margin
 * report across all integrated providers.
 */
export function buildPartnerAccountingReport(
  ledger: LedgerEntry[],
  userSharePercent = 40,
  pointsPerUsdt = 10000,
  userDirectoryMap?: Map<string, { email: string; displayName: string }>
): PlatformPartnerAccountingReport {
  const safeShare = Math.min(100, Math.max(1, Math.round(Number(userSharePercent) || 40)));
  const adminProfitPercent = Math.max(0, 100 - safeShare);
  const safePointsPerUsdt = Math.max(100, Math.round(Number(pointsPerUsdt) || 10000));

  const accumulators: Record<
    PartnerId,
    {
      completedCount: number;
      reversalCount: number;
      grossCents: number;
      userCents: number;
      userPoints: number;
      adminProfitCents: number;
      chargebackGrossCents: number;
      ptcCount: number;
      shortlinkCount: number;
    }
  > = {
    cpx_research: {
      completedCount: 0,
      reversalCount: 0,
      grossCents: 0,
      userCents: 0,
      userPoints: 0,
      adminProfitCents: 0,
      chargebackGrossCents: 0,
      ptcCount: 0,
      shortlinkCount: 0
    },
    aoytasks: {
      completedCount: 0,
      reversalCount: 0,
      grossCents: 0,
      userCents: 0,
      userPoints: 0,
      adminProfitCents: 0,
      chargebackGrossCents: 0,
      ptcCount: 0,
      shortlinkCount: 0
    }
  };

  const enrichedLedger: EnrichedPartnerLedgerItem[] = [];

  for (const entry of ledger) {
    if (entry.status !== 'confirmed') continue;
    const classification = classifyLedgerPartner(entry);
    const appliedShare = entry.appliedSharePercent || safeShare;
    const gross =
      typeof entry.grossCents === 'number' && entry.grossCents > 0
        ? entry.grossCents
        : Math.round(entry.amountCents / (appliedShare / 100));
    const profit =
      typeof entry.adminProfitCents === 'number'
        ? entry.adminProfitCents
        : Math.max(0, gross - entry.amountCents);
    const points =
      typeof entry.points === 'number' && !isNaN(entry.points) && entry.points > 0
        ? Math.round(entry.points)
        : Math.round((gross / 100) * safePointsPerUsdt);

    const bucket = accumulators[classification.partnerId];

    if (entry.entryType === 'credit') {
      bucket.completedCount += 1;
      bucket.grossCents += gross;
      bucket.userCents += entry.amountCents;
      bucket.userPoints += points;
      bucket.adminProfitCents += profit;
      if (classification.subCategory === 'aoy_ptc') bucket.ptcCount += 1;
      if (classification.subCategory === 'aoy_shortlink') bucket.shortlinkCount += 1;
    } else if (entry.entryType === 'reversal') {
      bucket.reversalCount += 1;
      bucket.grossCents = Math.max(0, bucket.grossCents - gross);
      bucket.userCents = Math.max(0, bucket.userCents - entry.amountCents);
      bucket.userPoints = Math.max(0, bucket.userPoints - points);
      bucket.adminProfitCents = Math.max(0, bucket.adminProfitCents - profit);
      bucket.chargebackGrossCents += gross;
    }

    const owner = userDirectoryMap?.get(entry.userId);
    enrichedLedger.push({
      ...entry,
      partnerId: classification.partnerId,
      partnerName: classification.partnerName,
      subCategory: classification.subCategory,
      subCategoryLabel: classification.subCategoryLabel,
      grossCents: gross,
      adminProfitCents: profit,
      appliedSharePercent: appliedShare,
      points,
      userEmail: owner?.email || 'Member',
      userDisplayName: owner?.displayName || 'Member'
    });
  }

  const totalGrossCents = accumulators.cpx_research.grossCents + accumulators.aoytasks.grossCents;
  const totalUserCents = accumulators.cpx_research.userCents + accumulators.aoytasks.userCents;
  const totalUserPoints = accumulators.cpx_research.userPoints + accumulators.aoytasks.userPoints;
  const totalAdminProfitCents = accumulators.cpx_research.adminProfitCents + accumulators.aoytasks.adminProfitCents;
  const totalCompletedCount = accumulators.cpx_research.completedCount + accumulators.aoytasks.completedCount;
  const totalReversalCount = accumulators.cpx_research.reversalCount + accumulators.aoytasks.reversalCount;
  const totalChargebackGrossCents =
    accumulators.cpx_research.chargebackGrossCents + accumulators.aoytasks.chargebackGrossCents;

  const buildPartnerItem = (
    partnerId: PartnerId,
    partnerName: string,
    userFacingBrand: string,
    integrationType: string,
    isWhiteLabelHidden: boolean
  ): PartnerAccountingMetrics => {
    const acc = accumulators[partnerId];
    const avgGrossCents = acc.completedCount > 0 ? Math.round(acc.grossCents / acc.completedCount) : 0;
    const avgAdminProfitCents = acc.completedCount > 0 ? Math.round(acc.adminProfitCents / acc.completedCount) : 0;
    const effectiveAdminMarginPercent =
      acc.grossCents > 0 ? Math.round((acc.adminProfitCents / acc.grossCents) * 100) : adminProfitPercent;
    const shareOfTotalProfitPercent =
      totalAdminProfitCents > 0 ? Math.round((acc.adminProfitCents / totalAdminProfitCents) * 100) : 0;

    return {
      partnerId,
      partnerName,
      userFacingBrand,
      integrationType,
      isWhiteLabelHidden,
      completedCount: acc.completedCount,
      reversalCount: acc.reversalCount,
      grossRevenueCents: acc.grossCents,
      userPayoutCents: acc.userCents,
      userPayoutPoints: acc.userPoints,
      adminProfitCents: acc.adminProfitCents,
      chargebackGrossCents: acc.chargebackGrossCents,
      avgGrossCents,
      avgAdminProfitCents,
      effectiveAdminMarginPercent,
      shareOfTotalProfitPercent,
      grossRevenueUsdFormatted: `$${(acc.grossCents / 100).toFixed(2)}`,
      userPayoutUsdFormatted: `$${(acc.userCents / 100).toFixed(2)}`,
      adminProfitUsdFormatted: `$${(acc.adminProfitCents / 100).toFixed(2)}`,
      ptcCompletedCount: partnerId === 'aoytasks' ? acc.ptcCount : undefined,
      shortlinkCompletedCount: partnerId === 'aoytasks' ? acc.shortlinkCount : undefined
    };
  };

  const partners: PartnerAccountingMetrics[] = [
    buildPartnerItem(
      'cpx_research',
      'CPX Research',
      'Reward River Research Surveys',
      'Live JSON Survey API + S2S Postback (/api/cpx/postback)',
      true
    ),
    buildPartnerItem(
      'aoytasks',
      'AoyTasks (aoyco.in)',
      'Reward River Instant Tasks & PTC',
      'Direct PTC/Shortlinks API + S2S Postback (/wh/aoytasks)',
      true
    )
  ];

  return {
    userSharePercent: safeShare,
    adminProfitPercent,
    pointsPerUsdt: safePointsPerUsdt,
    totals: {
      completedCount: totalCompletedCount,
      reversalCount: totalReversalCount,
      grossRevenueCents: totalGrossCents,
      userPayoutCents: totalUserCents,
      userPayoutPoints: totalUserPoints,
      adminProfitCents: totalAdminProfitCents,
      chargebackGrossCents: totalChargebackGrossCents,
      grossRevenueUsdFormatted: `$${(totalGrossCents / 100).toFixed(2)}`,
      userPayoutUsdFormatted: `$${(totalUserCents / 100).toFixed(2)}`,
      adminProfitUsdFormatted: `$${(totalAdminProfitCents / 100).toFixed(2)}`
    },
    partners,
    unitEconomics: calculatePartnerUnitEconomics(safeShare, safePointsPerUsdt),
    ledgerWithPartners: enrichedLedger
  };
}
