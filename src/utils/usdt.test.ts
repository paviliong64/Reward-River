import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUsdtAddress,
  usdCentsToUsdt,
  formatUsdtString,
  calculateUsdtPayout
} from './usdt';

test('validateUsdtAddress: accurately recognizes TRON TRC-20 address format', () => {
  const trc20Addr = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';
  const result = validateUsdtAddress(trc20Addr);
  assert.equal(result.isValid, true);
  assert.equal(result.network, 'TRC20');
});

test('validateUsdtAddress: accurately recognizes Ethereum / EVM ERC-20 address format', () => {
  const erc20Addr = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // Tether USD contract address
  const result = validateUsdtAddress(erc20Addr);
  assert.equal(result.isValid, true);
  assert.equal(result.network, 'ERC20');
});

test('validateUsdtAddress: flags mismatch when expected network does not match format', () => {
  const trc20Addr = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';
  const checkMismatch = validateUsdtAddress(trc20Addr, 'ERC20');
  assert.equal(checkMismatch.isValid, false);
  assert.match(checkMismatch.error || '', /TRC-20/i);
});

test('validateUsdtAddress: rejects malformed or random strings', () => {
  assert.equal(validateUsdtAddress('not_an_address').isValid, false);
  assert.equal(validateUsdtAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').isValid, false); // Non-USDT address rejected
  assert.equal(validateUsdtAddress('T123').isValid, false); // Too short
});

test('usdCentsToUsdt and formatUsdtString: accurately formats decimal equivalents', () => {
  assert.equal(usdCentsToUsdt(500), 5);
  assert.equal(usdCentsToUsdt(1250), 12.5);
  assert.equal(formatUsdtString(500), '5.00');
  assert.equal(formatUsdtString(1250), '12.50');
});

test('calculateUsdtPayout: subtracts fee and calculates net USDT correctly', () => {
  // $10.00 withdrawal with $1.00 TRC-20 fee = $9.00 net
  const result = calculateUsdtPayout(1000, 'TRC20', 100);
  assert.equal(result.isViable, true);
  assert.equal(result.grossUsdt, '10.00');
  assert.equal(result.feeUsdt, '1.00');
  assert.equal(result.netUsdt, '9.00');
  assert.equal(result.netCents, 900);

  // Amount below fee
  const tooLow = calculateUsdtPayout(80, 'TRC20', 100);
  assert.equal(tooLow.isViable, false);
});
