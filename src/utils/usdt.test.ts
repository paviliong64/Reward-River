import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUsdtAddress,
  usdCentsToUsdt,
  formatUsdtString,
  calculateUsdtPayout,
  usdCentsToPoints,
  pointsToUsdt,
  calculateHybridSurveySplit
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

test('Hybrid Points + USDT: on 10,000 Points user gets & sees 40% ($0.40 USDT) while $1.00 gross & 60% ($0.60) admin profit are hidden', () => {
  // At 40% user share: 40 user cents ($0.40 USDT) = 10,000 Points
  assert.equal(usdCentsToPoints(40, 10000, 40), 10000);
  assert.equal(pointsToUsdt(10000, 10000, 40), 0.4);
  assert.equal(pointsToUsdt(25000, 10000, 40), 1.0);

  // $1.00 (100 cents) gross CPX survey = 10,000 Points -> at 40% user share user gets $0.40 USDT + $0.60 hidden admin profit
  const split40 = calculateHybridSurveySplit(100, 40, 10000);
  assert.equal(split40.grossCents, 100);
  assert.equal(split40.userRewardPoints, 10000);
  assert.equal(split40.userRewardCents, 40);
  assert.equal(split40.userRewardUsdtFormatted, '$0.40 USDT');
  assert.equal(split40.userUsdtPer10kPoints, '0.40');
  assert.equal(split40.adminProfitCents, 60);
  assert.equal(split40.adminProfitPercent, 60);

  // Changing user share to 50% gives $0.50 USDT on 10,000 Points
  const split50 = calculateHybridSurveySplit(100, 50, 10000);
  assert.equal(split50.userRewardPoints, 10000);
  assert.equal(split50.userRewardCents, 50);
  assert.equal(split50.userUsdtPer10kPoints, '0.50');
  assert.equal(split50.adminProfitCents, 50);

  // Exact 50% Margin Plan with CPX Currency Factor = 5,000 Points/$1.00 and User Rate = 10,000 Points/$1.00:
  // On a $0.40 (40 cents) CPX survey: User gets 2,000 Points ($0.20 USD), Admin keeps $0.20 USD (50% profit)
  const cpx5kSplit = calculateHybridSurveySplit(40, 50, 5000);
  assert.equal(cpx5kSplit.grossCents, 40);
  assert.equal(cpx5kSplit.userRewardPoints, 2000);
  assert.equal(cpx5kSplit.userRewardCents, 20);
  assert.equal(cpx5kSplit.adminProfitCents, 20);
  assert.equal(pointsToUsdt(2000, 5000, 50), 0.2);
  assert.equal(pointsToUsdt(10000, 5000, 50), 1.0);
  assert.equal(usdCentsToPoints(2500, 5000, 50), 250000); // $25.00 min withdrawal = 250,000 Points
});



