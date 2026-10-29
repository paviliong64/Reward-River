/**
 * Reward River - CPX Research API Utility & Security Layer
 * Official documentation: https://www.cpx-research.com/main/en/doc.php
 */

import { createHash } from 'node:crypto';

export interface CpxRawSurvey {
  id: string | number;
  loi?: number; // length of interview in minutes
  payout?: number | string; // payout amount
  cpi?: number | string; // cost per interview
  conversion_rate?: number;
  statistics_rating_avg?: number;
  statistics_rating_count?: number;
  top?: number;
  href?: string;
  type?: string;
  [key: string]: unknown;
}

export interface NormalizedSurvey {
  id: string;
  loiMinutes: number;
  rewardCents: number; // in USD cents (integer minor units, 100% gross publisher USD)
  rewardUsdFormatted: string; // e.g. "$1.20"
  cpi: number;
  ratingAvg: number;
  ratingCount: number;
  isTop: boolean;
  directUrl: string;
  rawPoints?: number;
  category?: string;
  conversionRate?: number;
  isLiveCpx?: boolean;
}

export interface CpxPostbackPayload {
  status: string | number; // 1 = completion, 2 = screenout, 3 = chargeback/reversal
  trans_id: string;
  user_id?: string;
  ext_user_id?: string;
  amount_local?: string | number;
  amount_usd?: string | number;
  offer_id?: string;
  ip_click?: string;
  secure_hash?: string;
  hash?: string;
  sub_id?: string;
  sub_id_2?: string;
}

export interface CpxTimeStatisticItem {
  date?: string;
  hour?: string;
  clicks: number;
  active_users: number;
  completes: number;
  reversed_completes: number;
  outs: number;
  survey_ratings: number;
  revenue_completes: number;
  revenue_reversed_completes: number;
  revenue_outs: number;
  revenue_survey_ratings: number;
  revenue_total?: number;
}

export interface CpxTimeStatisticsResponse {
  success: boolean;
  publisher_id?: number;
  filters?: {
    start_time: string;
    end_time: string;
    app_id?: string | null;
    country_code?: string | null;
    group_by?: string;
  };
  totals?: CpxTimeStatisticItem;
  data?: CpxTimeStatisticItem[];
  results?: Record<string, CpxTimeStatisticItem> | CpxTimeStatisticItem[];
  error?: string;
}

export interface CpxCountrySale {
  lang_code: string;
  count_completes: string | number;
  sales: string | number;
  pay_to_user_local: string | number;
}

export interface CpxCompleteRecord {
  id: string;
  internal_user_id: string;
  external_user_id: string;
  country_code: string;
  app_id: string;
  app_name: string;
  verdienst_publisher: string;
  verdienst_user_local_money: string;
  datetime: string;
  datetime_klick?: string;
  loi_secounds: number;
  ip: string;
  subid_1?: string;
  subid_2?: string;
  status: string;
  paid_status?: string;
  trans_id: string;
}

export interface CpxScreenoutRecord {
  id: string;
  internal_user_id: string;
  external_user_id: string;
  country_code: string;
  app_id: string;
  app_name: string;
  verdienst_publisher: string;
  verdienst_user_local_money: string;
  datetime: string;
  datetime_klick?: string;
  loi_secounds: number;
  ip: string;
  notice?: string;
  trans_id: string;
}

export interface CpxTransactionCheckResult {
  type: string; // 'okay' | 'error'
  transaction?: {
    app_id: string;
    revenue_us: string;
    revenue_user: string;
    type: string;
    klick_id: string;
    external_user_id: string;
  };
  error?: string;
}

/**
 * Computes MD5 hash according to CPX documentation: md5(ext_user_id + '-' + hash_key)
 */
export function generateCpxSecureHash(extUserId: string, hashKey: string): string {
  if (!extUserId || !hashKey) return '';
  return createHash('md5').update(`${extUserId}-${hashKey}`).digest('hex');
}

/**
 * Computes transaction hash for postback verification: md5(transId + '-' + hashKey)
 */
export function generateCpxTransactionHash(transId: string, hashKey: string): string {
  if (!transId || !hashKey) return '';
  return createHash('md5').update(`${transId}-${hashKey}`).digest('hex');
}

/**
 * Verifies CPX postback signature against provided hash key.
 * Checks both transaction-based hash and user-based hash formats supported by CPX.
 */
export function verifyCpxPostbackSignature(
  transId: string,
  extUserId: string,
  receivedHash: string,
  hashKey: string
): boolean {
  if (!receivedHash || !hashKey) return false;
  
  const provided = receivedHash.trim().toLowerCase();
  const candidates = [
    generateCpxTransactionHash(transId, hashKey).toLowerCase(),
    generateCpxSecureHash(extUserId, hashKey).toLowerCase(),
    createHash('md5').update(`${transId}${hashKey}`).digest('hex').toLowerCase(),
    createHash('md5').update(`${extUserId}${hashKey}`).digest('hex').toLowerCase(),
    createHash('md5').update(`${transId}-${extUserId}-${hashKey}`).digest('hex').toLowerCase(),
    createHash('md5').update(`${hashKey}`).digest('hex').toLowerCase(),
    hashKey.toLowerCase()
  ];

  return candidates.includes(provided);
}

/**
 * Normalizes CPX postback amount_usd / amount_local into 100% gross USD cents.
 * Prevents 10,000x inflation when amount_local is in Points (e.g. 22800 points for $2.28).
 */
export function normalizeCpxPostbackGrossCents(
  amountUsd?: unknown,
  amountLocal?: unknown,
  pointsPerUsdt = 5000
): number {
  const cleanUsd = typeof amountUsd === 'string' ? Number(amountUsd.replace(/[^0-9.-]/g, '')) : Number(amountUsd);
  if (!isNaN(cleanUsd) && cleanUsd > 0) {
    // If someone passed points in amount_usd by mistake (> 50), normalize via pointsPerUsdt
    if (cleanUsd > 50) {
      return Math.max(1, Math.round((cleanUsd / Math.max(100, pointsPerUsdt)) * 100));
    }
    return Math.max(1, Math.round(cleanUsd * 100));
  }

  const cleanLocal = typeof amountLocal === 'string' ? Number(amountLocal.replace(/[^0-9.-]/g, '')) : Number(amountLocal);
  if (!isNaN(cleanLocal) && cleanLocal > 0) {
    if (cleanLocal > 50) {
      return Math.max(1, Math.round((cleanLocal / Math.max(100, pointsPerUsdt)) * 100));
    }
    return Math.max(1, Math.round(cleanLocal * 100));
  }

  return 100;
}

/**
 * Builds compliant CPX Survey URL.
 */
export function buildCpxSurveyUrl(params: {
  appId: string;
  extUserId: string;
  hashKey?: string;
  surveyId?: string;
  subId1?: string;
  subId2?: string;
  mainColor?: string;
}): string {
  const { appId, extUserId, hashKey, surveyId, subId1, subId2, mainColor = '0284c7' } = params;
  const baseUrl = 'https://oul.cpx-research.com/index.php';
  
  const query = new URLSearchParams();
  query.set('app_id', appId);
  query.set('ext_user_id', extUserId);
  query.set('main_color', mainColor); // River blue branding

  if (hashKey) {
    query.set('secure_hash', generateCpxSecureHash(extUserId, hashKey));
  }
  if (surveyId) {
    query.set('survey_id', surveyId);
  }
  if (subId1) {
    query.set('subid_1', subId1);
  }
  if (subId2) {
    query.set('subid_2', subId2);
  }

  return `${baseUrl}?${query.toString()}`;
}

/**
 * Normalizes CPX API response to standard application format.
 * Preserves real CPX payout_publisher_usd, statistics_rating_count, statistics_rating_avg, and category.
 */
export function normalizeCpxSurveyList(
  rawData: unknown,
  appId: string,
  extUserId: string,
  hashKey?: string,
  pointsPerUsdt = 5000
): NormalizedSurvey[] {
  if (!rawData || typeof rawData !== 'object') {
    return [];
  }

  const payload = rawData as { surveys?: unknown; status?: string };
  if (!Array.isArray(payload.surveys)) {
    return [];
  }

  const results: NormalizedSurvey[] = [];
  const safeFactor = pointsPerUsdt > 0 ? pointsPerUsdt : 5000;

  for (const item of payload.surveys) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as CpxRawSurvey;

    const id = String(raw.id || '').trim();
    if (!id) continue;

    const loiMinutes = Math.max(1, Math.min(60, Number(raw.loi) || 10));
    
    // Parse payout: CPX returns payout_publisher_usd (e.g. 0.49 USD) or payout in currency points at 5,000 Pts/$1 (e.g. "2450.00")
    let rewardCents = 10;
    const publisherUsd = raw.payout_publisher_usd !== undefined && raw.payout_publisher_usd !== null && raw.payout_publisher_usd !== ''
      ? Number(raw.payout_publisher_usd)
      : NaN;
    const rawCpi = raw.cpi !== undefined && raw.cpi !== null && raw.cpi !== ''
      ? Number(raw.cpi)
      : NaN;
    const rawPayoutNum = Number(raw.payout ?? raw.cpi) || 0;

    if (!isNaN(publisherUsd) && publisherUsd > 0) {
      // Direct Gross USD payout from CPX publisher feed (e.g. 0.49 -> 49 gross cents)
      rewardCents = Math.max(1, Math.round(publisherUsd * 100));
    } else if (!isNaN(rawCpi) && rawCpi > 0 && rawCpi <= 50) {
      rewardCents = Math.max(1, Math.round(rawCpi * 100));
    } else if (rawPayoutNum > 50) {
      // CPX returns points value configured at CPX Currency Factor (5,000 Pts = $1.00 Gross USD = 100 gross cents)
      rewardCents = Math.max(1, Math.round((rawPayoutNum / safeFactor) * 100));
    } else if (rawPayoutNum > 0) {
      rewardCents = Math.max(1, Math.round(rawPayoutNum * 100));
    }

    const rewardUsdFormatted = `$${(rewardCents / 100).toFixed(2)}`;
    const rawPoints = rawPayoutNum > 50 ? Math.round(rawPayoutNum) : Math.round((rewardCents / 100) * safeFactor);

    const cpi = !isNaN(publisherUsd) && publisherUsd > 0 ? Number(publisherUsd.toFixed(2)) : (Number(raw.cpi) || (rewardCents / 100));
    const ratingCount = Math.max(0, Math.floor(Number(raw.statistics_rating_count) || 0));
    const rawRatingAvg = Number(raw.statistics_rating_avg);
    const ratingAvg = !isNaN(rawRatingAvg) && rawRatingAvg > 0
      ? Math.max(1, Math.min(5, rawRatingAvg))
      : ratingCount > 0
      ? 4.5
      : 0;
    const isTop = Boolean(raw.top && Number(raw.top) > 0);
    const category = typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : 'General';
    const conversionRate = Number(raw.conversion_rate) || 0;

    // Direct survey URL or generated secure URL
    const directUrl = (raw.href && typeof raw.href === 'string' && raw.href.startsWith('https://'))
      ? raw.href
      : (raw.href_new && typeof raw.href_new === 'string' && raw.href_new.startsWith('https://'))
      ? raw.href_new
      : buildCpxSurveyUrl({ appId, extUserId, hashKey, surveyId: id });

    results.push({
      id,
      loiMinutes,
      rewardCents,
      rewardUsdFormatted,
      cpi,
      ratingAvg,
      ratingCount,
      isTop,
      directUrl,
      rawPoints,
      category,
      conversionRate,
      isLiveCpx: true
    });
  }

  return results;
}
