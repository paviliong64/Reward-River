/**
 * Reward River - USDT (Tether) Calculation & Address Validation Utilities
 * Supports TRON (TRC-20) and EVM / Ethereum / Polygon (ERC-20) formats.
 */

export type UsdtNetwork = 'TRC20' | 'ERC20';

export interface UsdtAddressValidationResult {
  isValid: boolean;
  network: UsdtNetwork | 'unknown';
  error?: string;
}

// TRON TRC-20: starts with 'T', 34 characters, Base58 (excluding 0, O, I, l)
const TRON_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

// Ethereum ERC-20 / EVM: starts with '0x', 42 hex characters
const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

/**
 * Validates a USDT payout address and detects or verifies network format.
 */
export function validateUsdtAddress(address: string, expectedNetwork?: UsdtNetwork): UsdtAddressValidationResult {
  if (!address || typeof address !== 'string') {
    return { isValid: false, network: 'unknown', error: 'USDT destination address cannot be empty.' };
  }

  const trimmed = address.trim();

  // 1. TRON (TRC-20)
  if (trimmed.startsWith('T')) {
    if (trimmed.length !== 34 || !TRON_ADDRESS_REGEX.test(trimmed)) {
      return { isValid: false, network: 'TRC20', error: 'Invalid TRON (TRC-20) address format. Must start with T and be exactly 34 Base58 characters.' };
    }
    if (expectedNetwork && expectedNetwork !== 'TRC20') {
      return { isValid: false, network: 'TRC20', error: 'Provided address is a TRC-20 (TRON) address, but ERC-20 network was selected.' };
    }
    return { isValid: true, network: 'TRC20' };
  }

  // 2. Ethereum / EVM (ERC-20)
  if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
    if (trimmed.length !== 42 || !ETH_ADDRESS_REGEX.test(trimmed)) {
      return { isValid: false, network: 'ERC20', error: 'Invalid ERC-20 address format. Must start with 0x and be 42 hexadecimal characters.' };
    }
    if (expectedNetwork && expectedNetwork !== 'ERC20') {
      return { isValid: false, network: 'ERC20', error: 'Provided address is an ERC-20 address, but TRC-20 network was selected.' };
    }
    return { isValid: true, network: 'ERC20' };
  }

  return {
    isValid: false,
    network: 'unknown',
    error: 'Unrecognized USDT address format. Please enter a valid TRC-20 (starts with T) or ERC-20 (starts with 0x) address.'
  };
}

/**
 * Converts USD cents to formatted USDT string.
 * Since 1 USD = 1.00 USDT (peg):
 * cents / 100 = USDT value
 */
export function usdCentsToUsdt(amountCents: number): number {
  if (!amountCents || amountCents <= 0) return 0;
  return Math.floor(amountCents) / 100;
}

/**
 * Formats USDT amount to standard 2 decimal places.
 */
export function formatUsdtString(amountCents: number): string {
  const usdt = usdCentsToUsdt(amountCents);
  return usdt.toFixed(2);
}

/**
 * Calculates net USDT payout after subtracting network transfer fee.
 * Standard low fees:
 * TRC20 fee: e.g. 100 cents ($1.00 USDT)
 * ERC20 fee: e.g. 250 cents ($2.50 USDT)
 */
export function calculateUsdtPayout(
  amountCents: number,
  network: UsdtNetwork = 'TRC20',
  feeCents: number = 100
): { grossUsdt: string; feeUsdt: string; netCents: number; netUsdt: string; isViable: boolean; error?: string } {
  const safeAmount = Math.max(0, Math.floor(amountCents));
  const safeFee = Math.max(0, Math.floor(feeCents));

  if (safeAmount <= safeFee) {
    return {
      grossUsdt: (safeAmount / 100).toFixed(2),
      feeUsdt: (safeFee / 100).toFixed(2),
      netCents: 0,
      netUsdt: '0.00',
      isViable: false,
      error: `Withdrawal amount must exceed the ${network} network fee of $${(safeFee / 100).toFixed(2)} USDT.`
    };
  }

  const netCents = safeAmount - safeFee;
  return {
    grossUsdt: (safeAmount / 100).toFixed(2),
    feeUsdt: (safeFee / 100).toFixed(2),
    netCents,
    netUsdt: (netCents / 100).toFixed(2),
    isViable: true
  };
}

export const DEFAULT_POINTS_PER_USDT = 10000; // Real ("Asl") Gross Base: 10,000 Points = $1.00 Gross USD from CPX (Hidden from User)
export const DEFAULT_USER_SHARE_PERCENT = 40; // User gets & sees 40% ($0.40 USDT per 10,000 Points); 60% ($0.60 USDT) is Hidden Admin Profit

/**
 * Converts User's Net USD cents into Points based on the user's share percentage.
 * Real ("Asl") value of 10,000 Points = 100 gross cents ($1.00), hidden from user.
 * At 40% user share, 10,000 Points = 40 user cents ($0.40 USDT).
 */
export function usdCentsToPoints(
  userAmountCents: number,
  pointsPerGrossUsdt: number = DEFAULT_POINTS_PER_USDT,
  userSharePercent: number = DEFAULT_USER_SHARE_PERCENT
): number {
  if (!userAmountCents || userAmountCents <= 0) return 0;
  const safeRate = pointsPerGrossUsdt > 0 ? pointsPerGrossUsdt : DEFAULT_POINTS_PER_USDT;
  const safeShare = Math.min(100, Math.max(1, Math.round(userSharePercent || DEFAULT_USER_SHARE_PERCENT)));
  // Since `safeRate` points (10,000) gives the user `safeShare` cents (40 cents = $0.40 USDT):
  return Math.round((Math.floor(userAmountCents) / safeShare) * safeRate);
}

/**
 * Converts Gross CPX USD cents (100 cents = $1.00 gross) into Points (10,000 Points).
 */
export function grossCentsToPoints(
  grossCents: number,
  pointsPerGrossUsdt: number = DEFAULT_POINTS_PER_USDT
): number {
  if (!grossCents || grossCents <= 0) return 0;
  const safeRate = pointsPerGrossUsdt > 0 ? pointsPerGrossUsdt : DEFAULT_POINTS_PER_USDT;
  return Math.round((Math.floor(grossCents) / 100) * safeRate);
}

/**
 * Converts Points into User's Net USD cents (at 40% share: 10,000 Points = 40 cents = $0.40 USDT).
 */
export function pointsToUsdCents(
  points: number,
  pointsPerGrossUsdt: number = DEFAULT_POINTS_PER_USDT,
  userSharePercent: number = DEFAULT_USER_SHARE_PERCENT
): number {
  if (!points || points <= 0) return 0;
  const safeRate = pointsPerGrossUsdt > 0 ? pointsPerGrossUsdt : DEFAULT_POINTS_PER_USDT;
  const safeShare = Math.min(100, Math.max(1, Math.round(userSharePercent || DEFAULT_USER_SHARE_PERCENT)));
  return Math.round((points / safeRate) * safeShare);
}

/**
 * Converts Points directly to User's decimal USDT value (at 40% share: 10,000 Points = 0.40 USDT).
 */
export function pointsToUsdt(
  points: number,
  pointsPerGrossUsdt: number = DEFAULT_POINTS_PER_USDT,
  userSharePercent: number = DEFAULT_USER_SHARE_PERCENT
): number {
  if (!points || points <= 0) return 0;
  const safeRate = pointsPerGrossUsdt > 0 ? pointsPerGrossUsdt : DEFAULT_POINTS_PER_USDT;
  const safeShare = Math.min(100, Math.max(1, Math.round(userSharePercent || DEFAULT_USER_SHARE_PERCENT)));
  return (points / safeRate) * (safeShare / 100);
}

/**
 * Formats integer points with thousands separators (e.g., 10000 -> "10,000").
 */
export function formatPointsString(points: number): string {
  const safePoints = Math.max(0, Math.round(points || 0));
  return safePoints.toLocaleString('en-US');
}

export interface HybridSurveySplit {
  grossCents: number;
  userRewardCents: number;
  adminProfitCents: number;
  userRewardPoints: number;
  userSharePercent: number;
  adminSharePercent: number;
  adminProfitPercent: number;
  userUsdtPer10kPoints: string;
  adminProfitPer10kPoints: string;
  userUsdtFormatted: string;
  userPointsFormatted: string;
  userRewardPointsFormatted: string;
  userRewardUsdFormatted: string;
  userRewardUsdtFormatted: string;
  adminProfitUsdFormatted: string;
}

/**
 * Splits a gross CPX survey payout (in USD cents, where 100 gross cents = $1.00 real value = 10,000 Points)
 * so that:
 * - On 10,000 Points ($1.00 gross), the User ONLY receives and sees 40% ($0.40 USDT = 40 cents).
 * - The remaining 60% ($0.60 USDT = 60 cents) is Hidden Admin Profit.
 * - The real ("asl") $1.00 value of 10,000 Points is never exposed to the user.
 */
export function calculateHybridSurveySplit(
  grossCents: number,
  userSharePercent: number = DEFAULT_USER_SHARE_PERCENT,
  pointsPerGrossUsdt: number = DEFAULT_POINTS_PER_USDT
): HybridSurveySplit {
  const safeGrossCents = Math.max(0, Math.round(grossCents || 0));
  const clampedUserPercent = Math.min(100, Math.max(1, Math.round(userSharePercent || DEFAULT_USER_SHARE_PERCENT)));
  const adminSharePercent = Math.max(0, 100 - clampedUserPercent);
  const safePointsPerUsdt = pointsPerGrossUsdt > 0 ? pointsPerGrossUsdt : DEFAULT_POINTS_PER_USDT;

  // 100 gross cents ($1.00 real value) = 10,000 Points
  const userRewardPoints = grossCentsToPoints(safeGrossCents, safePointsPerUsdt);
  // On those 10,000 Points, the user receives only `clampedUserPercent`% (e.g. 40% = 40 cents = $0.40 USDT)
  const userRewardCents = safeGrossCents > 0
    ? Math.max(1, Math.round(safeGrossCents * (clampedUserPercent / 100)))
    : 0;
  const adminProfitCents = Math.max(0, safeGrossCents - userRewardCents);

  const ptsFormatted = formatPointsString(userRewardPoints);
  const usdtDecimal = (userRewardCents / 100).toFixed(2);
  const userUsdtPer10kPoints = (clampedUserPercent / 100).toFixed(2);
  const adminProfitPer10kPoints = (adminSharePercent / 100).toFixed(2);

  return {
    grossCents: safeGrossCents,
    userRewardCents,
    adminProfitCents,
    userRewardPoints,
    userSharePercent: clampedUserPercent,
    adminSharePercent,
    adminProfitPercent: adminSharePercent,
    userUsdtPer10kPoints,
    adminProfitPer10kPoints,
    userUsdtFormatted: usdtDecimal,
    userPointsFormatted: ptsFormatted,
    userRewardPointsFormatted: ptsFormatted,
    userRewardUsdFormatted: `$${usdtDecimal}`,
    userRewardUsdtFormatted: `$${usdtDecimal} USDT`,
    adminProfitUsdFormatted: `$${(adminProfitCents / 100).toFixed(2)} USD`
  };
}


