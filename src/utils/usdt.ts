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
