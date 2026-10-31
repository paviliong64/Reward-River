import crypto from 'node:crypto';

/**
 * Provider-agnostic interface so additional offerwalls (e.g. Lootably, Torox, RevU)
 * can be plugged into Reward River using the same contract.
 */
export interface OfferwallProvider {
  readonly providerId: string;
  readonly displayName: string;
  isConfigured(): boolean;
  buildOfferwallUrl(userId: string): string;
}

export type OfferwallTransactionStatus =
  | 'credited'
  | 'reversed'
  | 'needs_review'
  | 'rejected'
  | 'blocked';

export interface OfferwallTransactionRecord {
  id: string;
  provider: string; // 'timewall'
  providerTxid: string;
  userId: string | null;
  userEmail?: string;
  userDisplayName?: string;
  offerName: string;
  offerDetail: string;
  revenueRaw: string; // Exact string as received in query string (e.g. "0.002", "0.50")
  revenueUsd: string; // Decimal(12,6) string representation (e.g. "0.002000")
  coins: string; // Decimal string representation of coins/points
  coinsInt: number; // Integer points credited/debited in ledger
  type: string;
  withdrawid: string;
  reason: string;
  userIp: string;
  sourceIp: string;
  status: OfferwallTransactionStatus;
  fraudFlags: string[];
  rawQuery: Record<string, string>;
  createdAt: string;
  reversedAt?: string | null;
}

export interface TimewallConfig {
  oid: string;
  placementUrlTemplate: string;
  apiKey: string;
  secret: string;
  allowedIps: string[];
  coinsPerUsd: number;
  allowDecimals: boolean;
  creditTypes: string[];
  reversalTypes: string[];
  negativeBalanceMode: 'allow' | 'flag_account';
  maxSingleRevenueUsd: string;
  trustedProxies: string[];
}

export interface TimewallSurveyItem {
  id: string;
  loi: number;
  usd_rate: number;
  currency_amount: number;
  link: string;
}

export interface TimewallSurveyApiResponse {
  configured: boolean;
  success: boolean;
  prescreenerRequired: boolean;
  currency: string;
  surveys: TimewallSurveyItem[];
  statusCode: number;
  message?: string;
}

export const DEFAULT_TIMEWALL_ALLOWED_IPS = [
  '18.156.132.55',
  '51.81.120.73',
  '142.111.248.18'
];

const MICRO_SCALE = 1_000_000n; // 6 decimal places (Decimal 12,6)

/**
 * Extracts raw query parameters directly from the raw URL string (`req.originalUrl` or `req.url`)
 * without Express/framework type coercion, preserving exact string formatting (e.g. "0.50", "0.002").
 */
export function extractRawQueryParams(rawUrl: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!rawUrl) return result;
  const qIndex = rawUrl.indexOf('?');
  if (qIndex === -1) return result;

  const rawQuery = rawUrl.slice(qIndex + 1);
  const pairs = rawQuery.split('&');
  for (const pair of pairs) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) {
      const k = safeDecodeURIComponent(pair);
      if (k && !(k in result)) result[k] = '';
    } else {
      const k = safeDecodeURIComponent(pair.slice(0, eqIdx));
      const v = safeDecodeURIComponent(pair.slice(eqIdx + 1));
      if (k && !(k in result)) {
        result[k] = v;
      }
    }
  }
  return result;
}

function safeDecodeURIComponent(val: string): string {
  try {
    return decodeURIComponent(val.replace(/\+/g, ' '));
  } catch {
    return val;
  }
}

/**
 * Masks a secret or hash for safe logging (never logs full hash or secret).
 */
export function maskSecretOrHash(value?: string | null): string {
  const clean = String(value || '').trim();
  if (!clean) return '<empty>';
  if (clean.length <= 8) return '****';
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}

/**
 * Computes TimeWall SHA-256 signature:
 * hash = sha256(userid + revenue + SECRET_KEY), plain string concatenation, hex lowercase output.
 * IMPORTANT: `revenueRaw` is used EXACTLY as received in the query string.
 */
export function computeTimewallHash(
  userId: string,
  revenueRaw: string,
  secretKey: string
): string {
  const payload = `${userId}${revenueRaw}${secretKey}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex').toLowerCase();
}

/**
 * Verifies TimeWall SHA-256 signature using a constant-time comparison (`crypto.timingSafeEqual`).
 * Lowercases both sides before comparing.
 */
export function verifyTimewallHash(params: {
  userId: string;
  revenueRaw: string;
  secretKey: string;
  receivedHash: string;
}): boolean {
  const { userId, revenueRaw, secretKey, receivedHash } = params;
  if (!userId || !revenueRaw || !secretKey || !receivedHash) {
    return false;
  }

  const expectedHex = computeTimewallHash(userId, revenueRaw, secretKey);
  const actualHex = String(receivedHash).trim().toLowerCase();

  // SHA-256 hex digest is always 64 ASCII characters
  if (actualHex.length !== expectedHex.length) {
    return false;
  }

  const expectedBuf = Buffer.from(expectedHex, 'utf8');
  const actualBuf = Buffer.from(actualHex, 'utf8');
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Exact fixed-point decimal parser: parses a decimal string (e.g. "0.002", "0.50", "-1.25")
 * into micro-units (10^-6) as a BigInt without ever touching IEEE-754 floats.
 */
export function parseDecimalToMicros(raw: string): {
  valid: boolean;
  micros: bigint;
  isNegative: boolean;
  formatted6: string;
} {
  const clean = String(raw ?? '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(clean)) {
    return { valid: false, micros: 0n, isNegative: false, formatted6: '0.000000' };
  }

  const isNegative = clean.startsWith('-');
  const unsigned = isNegative ? clean.slice(1) : clean;
  const [intPartRaw, fracPartRaw = ''] = unsigned.split('.');

  // Pad or truncate fractional part to 6 digits (with half-up rounding on 7th digit if present)
  const paddedFrac = (fracPartRaw + '0000000').slice(0, 7);
  const sixDigits = paddedFrac.slice(0, 6);
  const seventhDigit = Number(paddedFrac[6] || '0');

  let absMicros = BigInt(intPartRaw || '0') * MICRO_SCALE + BigInt(sixDigits || '0');
  if (seventhDigit >= 5) {
    absMicros += 1n;
  }

  const micros = isNegative ? -absMicros : absMicros;
  const formatted6 = formatMicrosToDecimal(micros, 6);

  return {
    valid: true,
    micros,
    isNegative,
    formatted6
  };
}

/**
 * Formats micro-units (10^-6 BigInt) to a decimal string with `decimals` places.
 */
export function formatMicrosToDecimal(micros: bigint, decimals = 6): string {
  const isNeg = micros < 0n;
  const abs = isNeg ? -micros : micros;
  const intPart = abs / MICRO_SCALE;
  const fracPart = abs % MICRO_SCALE;
  const fracStr = fracPart.toString().padStart(6, '0');
  if (decimals <= 0) {
    return `${isNeg ? '-' : ''}${intPart.toString()}`;
  }
  const clipped = fracStr.slice(0, Math.min(6, decimals)).padEnd(decimals, '0');
  return `${isNeg ? '-' : ''}${intPart.toString()}.${clipped}`;
}

/**
 * Validates and computes the coin reward using pure BigInt decimal math (no floats).
 * Checks `currency` parameter against `abs(revenue_usd) * TIMEWALL_COINS_PER_USD`
 * within a small rounding tolerance.
 */
export function verifyAndComputeTimewallCoins(params: {
  revenueRaw: string;
  currencyRaw?: string;
  coinsPerUsd: number;
  allowDecimals: boolean;
}): {
  validNumbers: boolean;
  withinTolerance: boolean;
  expectedCoinsMicros: bigint;
  receivedCoinsMicros: bigint;
  finalCoinsFormatted: string;
  finalCoinsInt: number;
  revenueFormatted6: string;
  revenueIsNegative: boolean;
  mismatchReason?: string;
} {
  const revParsed = parseDecimalToMicros(params.revenueRaw);
  if (!revParsed.valid) {
    return {
      validNumbers: false,
      withinTolerance: false,
      expectedCoinsMicros: 0n,
      receivedCoinsMicros: 0n,
      finalCoinsFormatted: '0',
      finalCoinsInt: 0,
      revenueFormatted6: '0.000000',
      revenueIsNegative: false,
      mismatchReason: `Invalid revenue format: "${params.revenueRaw}"`
    };
  }

  const absRevenueMicros = revParsed.micros < 0n ? -revParsed.micros : revParsed.micros;
  if (absRevenueMicros === 0n) {
    return {
      validNumbers: false,
      withinTolerance: false,
      expectedCoinsMicros: 0n,
      receivedCoinsMicros: 0n,
      finalCoinsFormatted: '0',
      finalCoinsInt: 0,
      revenueFormatted6: revParsed.formatted6,
      revenueIsNegative: revParsed.isNegative,
      mismatchReason: 'Revenue must be non-zero'
    };
  }

  const rateInt = BigInt(Math.max(1, Math.round(params.coinsPerUsd || 10000)));
  const expectedCoinsMicros = absRevenueMicros * rateInt;

  // If `currency` is provided by TimeWall, parse and sanity-check it against expectedCoinsMicros
  const hasCurrencyParam =
    params.currencyRaw !== undefined && String(params.currencyRaw).trim() !== '';

  let receivedCoinsMicros = expectedCoinsMicros;
  if (hasCurrencyParam) {
    const curParsed = parseDecimalToMicros(String(params.currencyRaw));
    if (!curParsed.valid) {
      return {
        validNumbers: false,
        withinTolerance: false,
        expectedCoinsMicros,
        receivedCoinsMicros: 0n,
        finalCoinsFormatted: '0',
        finalCoinsInt: 0,
        revenueFormatted6: revParsed.formatted6,
        revenueIsNegative: revParsed.isNegative,
        mismatchReason: `Invalid currency format: "${params.currencyRaw}"`
      };
    }
    receivedCoinsMicros = curParsed.micros < 0n ? -curParsed.micros : curParsed.micros;
  }

  // Tolerance check: allow up to max(2.0 coins, 2% of expectedCoins) to account for placement rounding
  const diffMicros =
    receivedCoinsMicros >= expectedCoinsMicros
      ? receivedCoinsMicros - expectedCoinsMicros
      : expectedCoinsMicros - receivedCoinsMicros;
  const twoCoinsMicros = 2n * MICRO_SCALE;
  const twoPercentMicros = (expectedCoinsMicros * 2n) / 100n;
  const maxAllowedDiffMicros =
    twoCoinsMicros > twoPercentMicros ? twoCoinsMicros : twoPercentMicros;

  const withinTolerance = diffMicros <= maxAllowedDiffMicros;

  // Round to nearest integer coin if allowDecimals=false
  const halfUnit = MICRO_SCALE / 2n;
  const roundedCoinsBig = (receivedCoinsMicros + halfUnit) / MICRO_SCALE;
  const finalCoinsInt = Number(roundedCoinsBig);
  const finalCoinsFormatted = params.allowDecimals
    ? formatMicrosToDecimal(receivedCoinsMicros, 4)
    : roundedCoinsBig.toString();

  return {
    validNumbers: true,
    withinTolerance,
    expectedCoinsMicros,
    receivedCoinsMicros,
    finalCoinsFormatted,
    finalCoinsInt,
    revenueFormatted6: revParsed.formatted6,
    revenueIsNegative: revParsed.isNegative,
    mismatchReason: withinTolerance
      ? undefined
      : `Currency mismatch: received ${formatMicrosToDecimal(receivedCoinsMicros, 2)} coins, expected ${formatMicrosToDecimal(expectedCoinsMicros, 2)} coins (revenue=${params.revenueRaw}, rate=${rateInt.toString()})`
  };
}

/**
 * Normalizes an IPv4 or IPv4-mapped IPv6 address (e.g. "::ffff:18.156.132.55" -> "18.156.132.55").
 */
export function normalizeIpAddress(rawIp?: string | null): string {
  const clean = String(rawIp || '').trim();
  if (!clean) return '';
  if (clean.startsWith('::ffff:')) {
    return clean.slice(7);
  }
  return clean;
}

/**
 * Resolves the real source IP of the postback request.
 * Only trusts forwarded headers (CF-Connecting-IP, X-Forwarded-For, X-Real-IP)
 * when the immediate socket IP (or runtime platform) is in TRUSTED_PROXIES.
 */
export function resolveRealSourceIp(params: {
  socketIp?: string | null;
  headers: Record<string, string | string[] | undefined>;
  trustedProxies: string[];
}): string {
  const socketIp = normalizeIpAddress(params.socketIp);
  const trustedList = params.trustedProxies.map(p => p.trim().toLowerCase()).filter(Boolean);

  const isLocalLoopback =
    socketIp === '127.0.0.1' || socketIp === '::1' || socketIp.startsWith('10.') || socketIp.startsWith('172.') || socketIp.startsWith('192.168.');

  const socketIsTrusted =
    trustedList.includes('*') ||
    trustedList.includes(socketIp.toLowerCase()) ||
    (isLocalLoopback &&
      (trustedList.includes('127.0.0.1') ||
        trustedList.includes('::1') ||
        trustedList.includes('cloudflare') ||
        trustedList.includes('vercel')));

  if (!socketIsTrusted) {
    return socketIp || 'unknown';
  }

  const getHeader = (name: string): string => {
    const val = params.headers[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] || '';
    return typeof val === 'string' ? val : '';
  };

  // Prefer Cloudflare's authoritative header if 'cloudflare' is in trustedProxies
  if (trustedList.includes('cloudflare') || trustedList.includes('*')) {
    const cfIp = normalizeIpAddress(getHeader('cf-connecting-ip'));
    if (cfIp) return cfIp;
  }

  const xRealIp = normalizeIpAddress(getHeader('x-real-ip'));
  if (xRealIp) return xRealIp;

  const xff = getHeader('x-forwarded-for');
  if (xff) {
    const firstHop = normalizeIpAddress(xff.split(',')[0]);
    if (firstHop) return firstHop;
  }

  return socketIp || 'unknown';
}

/**
 * Checks whether `sourceIp` is in the configured `TIMEWALL_ALLOWED_IPS` whitelist.
 */
export function isAllowedTimewallIp(sourceIp: string, allowedIps: string[]): boolean {
  const cleanSource = normalizeIpAddress(sourceIp);
  if (!cleanSource) return false;
  for (const rawAllowed of allowedIps) {
    const allowed = normalizeIpAddress(rawAllowed);
    if (!allowed) continue;
    if (allowed === '*' || allowed === cleanSource) {
      return true;
    }
  }
  return false;
}

/**
 * Anti-fraud detector for TimeWall postbacks.
 * Flags:
 * 1. Abnormally high revenue per transaction (> maxSingleRevenueUsd)
 * 2. Bursts of credits for one user (>= 10 credits within 5 minutes)
 * 3. Multiple distinct user accounts sharing the same end-user IP (`user_ip`)
 * Extension points clearly marked for VPN/Proxy/Device-Fingerprint checks.
 */
export function evaluateTimewallFraudFlags(params: {
  userId: string;
  userIp: string;
  revenueRaw: string;
  maxSingleRevenueUsd: string;
  recentTransactions: OfferwallTransactionRecord[];
  nowMs?: number;
}): {
  flags: string[];
  holdForReview: boolean;
} {
  const flags: string[] = [];
  const now = params.nowMs ?? Date.now();

  // 1. Abnormally high single-transaction revenue
  const revParsed = parseDecimalToMicros(params.revenueRaw);
  const maxParsed = parseDecimalToMicros(params.maxSingleRevenueUsd || '50.00');
  const absRev = revParsed.micros < 0n ? -revParsed.micros : revParsed.micros;
  if (maxParsed.valid && maxParsed.micros > 0n && absRev > maxParsed.micros) {
    flags.push(
      `high_single_revenue:${revParsed.formatted6}_exceeds_${maxParsed.formatted6}`
    );
  }

  // 2. Burst of credits for a single user (>= 10 transactions in the last 5 minutes)
  const fiveMinAgo = now - 5 * 60 * 1000;
  const userRecentCount = params.recentTransactions.filter(tx => {
    if (tx.userId !== params.userId) return false;
    const tMs = new Date(tx.createdAt).getTime();
    return !isNaN(tMs) && tMs >= fiveMinAgo;
  }).length;
  if (userRecentCount >= 10) {
    flags.push(`user_credit_burst:${userRecentCount + 1}_tx_in_5m`);
  }

  // 3. Multiple accounts sharing the same end-user IP (`user_ip`)
  const cleanUserIp = normalizeIpAddress(params.userIp);
  if (cleanUserIp && cleanUserIp !== 'unknown') {
    const distinctUsersOnIp = new Set<string>();
    for (const tx of params.recentTransactions) {
      if (tx.userId && normalizeIpAddress(tx.userIp) === cleanUserIp) {
        distinctUsersOnIp.add(tx.userId);
      }
    }
    distinctUsersOnIp.add(params.userId);
    if (distinctUsersOnIp.size >= 3) {
      flags.push(`multi_account_shared_user_ip:${distinctUsersOnIp.size}_users_on_${cleanUserIp}`);
    }
  }

  // [EXTENSION POINT: VPN / Proxy / Datacenter ASN Check]
  // Plug in MaxMind GeoIP2 / IPQualityScore / Spur.us lookup on `cleanUserIp` here:
  // if (ipIntelligence.isVpnOrTor(cleanUserIp)) flags.push('vpn_or_proxy_ip');

  // [EXTENSION POINT: Browser / Device Fingerprint Correlation]
  // Correlate session device fingerprint hashes across accounts before auto-crediting.

  // Hold for manual admin review if abnormally high single revenue is triggered
  const holdForReview = flags.some(f => f.startsWith('high_single_revenue:'));

  return { flags, holdForReview };
}
