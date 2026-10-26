import crypto from 'node:crypto';
import { calculateHybridSurveySplit } from './usdt';

export interface WhiteLabelTask {
  id: string;
  taskType: 'ptc' | 'shortlink';
  title: string;
  description: string;
  durationSeconds: number;
  rewardPoints: number;
  rewardPointsFormatted: string;
  rewardCents: number;
  rewardUsdtFormatted: string;
  availableClaims: number;
  dailyLimit: number;
  adType: 'Iframe' | 'Window';
  launchUrl: string;
  isFeatured: boolean;
}

/**
 * AoyTasks Strict Rule: The [USER_ID] parameter only accepts alphanumeric characters (a-z, A-Z, 0-9).
 * Other characters (like _ or -) are not allowed.
 */
export function sanitizeAoySubId(rawId: string): string {
  const cleaned = String(rawId || '').replace(/[^a-zA-Z0-9]/g, '');
  return cleaned || 'user001';
}

/**
 * Generates the AoyTasks postback signature:
 * signature = md5(subId + transId + reward + secret_key)
 */
export function generateAoyPostbackSignature(
  subId: string,
  transId: string,
  reward: string,
  secretKey: string
): string {
  const payload = `${subId}${transId}${reward}${secretKey}`;
  return crypto.createHash('md5').update(payload).digest('hex');
}

/**
 * Verifies the incoming AoyTasks S2S postback signature.
 */
export function verifyAoyPostbackSignature(
  subId: string,
  transId: string,
  reward: string,
  secretKey: string,
  incomingSignature: string
): boolean {
  if (!secretKey) return true;
  if (!incomingSignature) return false;
  const expected = generateAoyPostbackSignature(subId, transId, reward, secretKey);
  return expected.toLowerCase() === String(incomingSignature).trim().toLowerCase();
}

/**
 * Strips any upstream provider references ("AoyTasks", "aoyco.in", "AOY") so users only see Reward River branding.
 */
export function sanitizeWhiteLabelText(input: string, fallback: string): string {
  if (!input || typeof input !== 'string') return fallback;
  const cleaned = input
    .replace(/aoytasks/gi, 'Reward River')
    .replace(/aoyco\.in/gi, 'Reward River')
    .replace(/\baoy\b/gi, 'Reward River')
    .trim();
  return cleaned || fallback;
}

/**
 * Converts AoyTasks reward / payout into Gross USD cents.
 * If payout (USD) is provided, uses payout * 100.
 * Otherwise uses reward / exchangeRate * 100.
 */
export function aoyRewardToGrossCents(
  rawReward: string | number,
  exchangeRatePerUsd = 10000,
  rawPayoutUsd?: string | number
): number {
  const payoutNum = Number(rawPayoutUsd);
  if (!isNaN(payoutNum) && payoutNum > 0) {
    return Math.max(1, Math.round(payoutNum * 100));
  }
  const rewardNum = Number(rawReward);
  const safeRate = Math.max(1, Number(exchangeRatePerUsd) || 10000);
  if (!isNaN(rewardNum) && rewardNum > 0) {
    const usd = rewardNum / safeRate;
    return Math.max(1, Math.round(usd * 100));
  }
  return 10; // default $0.10 gross fallback
}

/**
 * Normalizes raw AoyTasks Direct API PTC items into white-label Reward River task cards.
 */
export function normalizeAoyPtcList(
  rawList: any[],
  options: {
    userSharePercent?: number;
    pointsPerUsdt?: number;
    exchangeRatePerUsd?: number;
  } = {}
): WhiteLabelTask[] {
  if (!Array.isArray(rawList)) return [];
  const userSharePercent = options.userSharePercent ?? 40;
  const pointsPerUsdt = options.pointsPerUsdt ?? 10000;
  const exchangeRatePerUsd = options.exchangeRatePerUsd ?? 10000;

  return rawList.map((item, idx) => {
    const grossCents = aoyRewardToGrossCents(item.reward, exchangeRatePerUsd, item.payout);
    const split = calculateHybridSurveySplit(grossCents, userSharePercent, pointsPerUsdt);
    const id = `ptc_${item.id ?? idx + 1}`;
    return {
      id,
      taskType: 'ptc' as const,
      title: sanitizeWhiteLabelText(item.title, `Sponsored Partner Visit #${item.id ?? idx + 1}`),
      description: sanitizeWhiteLabelText(
        item.description,
        'Visit our sponsored partner page for the timer duration to claim instant Points & USDT.'
      ),
      durationSeconds: Math.max(5, Number(item.duration) || 15),
      rewardPoints: split.userRewardPoints,
      rewardPointsFormatted: split.userRewardPointsFormatted,
      rewardCents: split.userRewardCents,
      rewardUsdtFormatted: (split.userRewardCents / 100).toFixed(2),
      availableClaims: 1,
      dailyLimit: 1,
      adType: item.ad_type === 'Window' ? 'Window' : 'Iframe',
      launchUrl: String(item.url || ''),
      isFeatured: split.userRewardPoints >= 1500
    };
  });
}

/**
 * Normalizes raw AoyTasks Direct API Shortlink items into white-label Reward River task cards.
 */
export function normalizeAoyShortlinkList(
  rawList: any[],
  options: {
    userSharePercent?: number;
    pointsPerUsdt?: number;
    exchangeRatePerUsd?: number;
  } = {}
): WhiteLabelTask[] {
  if (!Array.isArray(rawList)) return [];
  const userSharePercent = options.userSharePercent ?? 40;
  const pointsPerUsdt = options.pointsPerUsdt ?? 10000;
  const exchangeRatePerUsd = options.exchangeRatePerUsd ?? 10000;

  return rawList.map((item, idx) => {
    const grossCents = aoyRewardToGrossCents(item.reward, exchangeRatePerUsd, item.payout);
    const split = calculateHybridSurveySplit(grossCents, userSharePercent, pointsPerUsdt);
    const id = `sl_${item.id ?? idx + 1}`;
    const available = Math.max(1, Number(item.available) || 1);
    const limit = Math.max(available, Number(item.limit) || available);
    return {
      id,
      taskType: 'shortlink' as const,
      title: sanitizeWhiteLabelText(item.title, `Sponsored Express Link #${item.id ?? idx + 1}`),
      description: `Complete the quick partner verification step (${available}/${limit} daily claims available) for instant Points & USDT.`,
      durationSeconds: 20,
      rewardPoints: split.userRewardPoints,
      rewardPointsFormatted: split.userRewardPointsFormatted,
      rewardCents: split.userRewardCents,
      rewardUsdtFormatted: (split.userRewardCents / 100).toFixed(2),
      availableClaims: available,
      dailyLimit: limit,
      adType: 'Window',
      launchUrl: String(item.url || ''),
      isFeatured: split.userRewardPoints >= 2000
    };
  });
}
