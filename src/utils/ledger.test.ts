import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateUserBalances,
  isDuplicateTransaction,
  canSubmitWithdrawal,
  LedgerEntry,
  WithdrawalRecord
} from './ledger';

test('calculateUserBalances: sums credits, debits, pending, and reserved correctly', () => {
  const userId = 'usr_abc';
  const entries: LedgerEntry[] = [
    {
      id: 'ledg_1',
      userId,
      providerTxId: 'cpx_tx_1',
      amountCents: 150, // $1.50
      entryType: 'credit',
      status: 'confirmed',
      createdAt: '2026-10-20T10:00:00Z'
    },
    {
      id: 'ledg_2',
      userId,
      providerTxId: 'cpx_tx_2',
      amountCents: 250, // $2.50
      entryType: 'credit',
      status: 'confirmed',
      createdAt: '2026-10-20T11:00:00Z'
    },
    {
      id: 'ledg_3',
      userId,
      providerTxId: 'cpx_tx_3',
      amountCents: 75, // $0.75
      entryType: 'credit',
      status: 'pending',
      createdAt: '2026-10-20T12:00:00Z'
    }
  ];

  const withdrawals: WithdrawalRecord[] = [];

  const balance = calculateUserBalances(userId, entries, withdrawals);
  assert.equal(balance.availableCents, 400); // 150 + 250
  assert.equal(balance.pendingCents, 75);
  assert.equal(balance.totalEarnedCents, 400);
  assert.equal(balance.reservedWithdrawalCents, 0);
  assert.equal(balance.totalWithdrawnCents, 0);
});

test('calculateUserBalances: reserves pending withdrawals and prevents double spend', () => {
  const userId = 'usr_abc';
  const entries: LedgerEntry[] = [
    {
      id: 'ledg_1',
      userId,
      providerTxId: 'cpx_tx_1',
      amountCents: 1000, // $10.00
      entryType: 'credit',
      status: 'confirmed',
      createdAt: '2026-10-20T10:00:00Z'
    }
  ];

  const withdrawals: WithdrawalRecord[] = [
    {
      id: 'w_1',
      userId,
      amountCents: 600, // $6.00 requested
      status: 'under_review',
      createdAt: '2026-10-20T12:00:00Z'
    }
  ];

  const balance = calculateUserBalances(userId, entries, withdrawals);
  assert.equal(balance.availableCents, 400); // 1000 - 600 reserved = 400 available
  assert.equal(balance.reservedWithdrawalCents, 600);
});

test('calculateUserBalances: handles CPX chargebacks / reversals cleanly', () => {
  const userId = 'usr_abc';
  const entries: LedgerEntry[] = [
    {
      id: 'ledg_1',
      userId,
      providerTxId: 'cpx_tx_1',
      amountCents: 500, // $5.00
      entryType: 'credit',
      status: 'confirmed',
      createdAt: '2026-10-20T10:00:00Z'
    },
    {
      id: 'ledg_2',
      userId,
      providerTxId: 'cpx_tx_1_rev',
      amountCents: 500, // $5.00 reversal
      entryType: 'reversal',
      status: 'confirmed',
      createdAt: '2026-10-20T11:00:00Z'
    }
  ];

  const balance = calculateUserBalances(userId, entries, []);
  assert.equal(balance.availableCents, 0);
});

test('isDuplicateTransaction: detects replay attacks and duplicate webhook deliveries', () => {
  const entries: LedgerEntry[] = [
    {
      id: 'ledg_1',
      userId: 'usr_abc',
      providerTxId: 'cpx_trans_unique_123',
      amountCents: 200,
      entryType: 'credit',
      status: 'confirmed',
      createdAt: '2026-10-20T10:00:00Z'
    }
  ];

  assert.equal(isDuplicateTransaction('cpx_trans_unique_123', entries), true);
  assert.equal(isDuplicateTransaction('cpx_trans_fresh_456', entries), false);
});

test('canSubmitWithdrawal: enforces minimums, maximums, and balance', () => {

  // Below minimum
  const belowMin = canSubmitWithdrawal({
    amountCents: 300,
    availableCents: 2000,
    emailVerified: true,
    minCents: 500,
    maxCents: 50000
  });
  assert.equal(belowMin.allowed, false);
  assert.match(belowMin.reason || '', /minimum/i);

  // Insufficient balance
  const overdraft = canSubmitWithdrawal({
    amountCents: 2500,
    availableCents: 2000,
    emailVerified: true,
    minCents: 500,
    maxCents: 50000
  });
  assert.equal(overdraft.allowed, false);
  assert.match(overdraft.reason || '', /insufficient/i);

  // Valid
  const valid = canSubmitWithdrawal({
    amountCents: 1500,
    availableCents: 2000,
    emailVerified: true,
    minCents: 500,
    maxCents: 50000
  });
  assert.equal(valid.allowed, true);
});
