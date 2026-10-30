import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toKarachiDateKey,
  toKarachiMonthKey,
  toKarachiWeekKey,
  classifyUserCohort,
  computeAdminDashboardStats,
  verifyDataIntegrity
} from './adminStats';
import { LedgerEntry, WithdrawalRecord } from './ledger';

test('toKarachiDateKey: accurately shifts UTC timestamps to Asia/Karachi (+05:00)', () => {
  // 2026-10-29 21:30:00 UTC is 2026-10-30 02:30:00 PKT (Asia/Karachi)
  const utcEvening = '2026-10-29T21:30:00.000Z';
  assert.equal(toKarachiDateKey(utcEvening), '2026-10-30');
  assert.equal(toKarachiMonthKey(utcEvening), '2026-10');
  assert.equal(toKarachiWeekKey(utcEvening), '2026-10-26');
});

test('classifyUserCohort: classifies users registered in last 7 days as new and earlier as old', () => {
  const nowIso = '2026-10-30T10:00:00.000Z';
  assert.equal(classifyUserCohort('2026-10-28T10:00:00.000Z', nowIso), 'new');
  assert.equal(classifyUserCohort('2026-10-24T10:00:00.000Z', nowIso), 'new');
  assert.equal(classifyUserCohort('2026-10-15T10:00:00.000Z', nowIso), 'old');
});

test('computeAdminDashboardStats: computes real cohorts, tasks, points, top 10, and timeSeries', () => {
  const nowIso = '2026-10-30T12:00:00.000Z';
  const users = [
    {
      id: 'usr_1',
      email: 'alice@example.com',
      displayName: 'Alice',
      externalOpaqueId: 'rr_cpx_usr1',
      emailVerified: true,
      role: 'user' as const,
      createdAt: '2026-10-30T08:00:00.000Z' // Today (new)
    },
    {
      id: 'usr_2',
      email: 'bob@example.com',
      displayName: 'Bob',
      externalOpaqueId: 'rr_cpx_usr2',
      emailVerified: true,
      role: 'user' as const,
      createdAt: '2026-10-01T08:00:00.000Z' // > 7d ago (old)
    }
  ];

  const ledger: LedgerEntry[] = [
    {
      id: 'l1',
      userId: 'usr_1',
      providerTxId: 'tx_1',
      amountCents: 20,
      points: 2000,
      grossCents: 40,
      adminProfitCents: 20,
      entryType: 'credit',
      status: 'confirmed',
      createdAt: '2026-10-30T09:00:00.000Z',
      description: 'Survey #101 (+2,000 Pts)'
    },
    {
      id: 'l2',
      userId: 'usr_2',
      providerTxId: 'tx_2',
      amountCents: 50,
      points: 5000,
      grossCents: 100,
      adminProfitCents: 50,
      entryType: 'credit',
      status: 'confirmed',
      createdAt: '2026-10-10T09:00:00.000Z',
      description: 'Survey #102 (+5,000 Pts)'
    },
    {
      id: 'l3',
      userId: 'usr_2',
      providerTxId: 'tx_3',
      amountCents: 10,
      points: 1000,
      entryType: 'credit',
      status: 'pending',
      createdAt: '2026-10-29T09:00:00.000Z',
      description: 'Pending Task'
    },
    {
      id: 'l4',
      userId: 'usr_2',
      providerTxId: 'tx_4',
      amountCents: 5,
      points: 500,
      entryType: 'reversal',
      status: 'confirmed',
      createdAt: '2026-10-29T11:00:00.000Z',
      description: 'Reversed Task'
    }
  ];

  const withdrawals: WithdrawalRecord[] = [];

  const allStats = computeAdminDashboardStats({
    users,
    ledger,
    withdrawals,
    filter: { range: 'all', groupBy: 'day', nowIso }
  });

  assert.equal(allStats.users.totalUsers, 2);
  assert.equal(allStats.users.newUsersToday, 1);
  assert.equal(allStats.users.newUsersCount, 1);
  assert.equal(allStats.users.oldUsersCount, 1);
  assert.equal(allStats.users.activeUsersCount, 2);

  assert.equal(allStats.tasks.tasksCompletedCount, 2);
  assert.equal(allStats.tasks.tasksPendingCount, 1);
  assert.equal(allStats.tasks.tasksRejectedCount, 1);

  // 2000 + 5000 - 500 = 6500 net points awarded
  assert.equal(allStats.points.totalPointsAwarded, 6500);
  assert.equal(allStats.points.outstandingPointsBalance, 6500);
  assert.equal(allStats.topUsersByPoints[0].id, 'usr_2');
  assert.equal(allStats.topUsersByPoints[0].availablePoints, 4500);
  assert.equal(allStats.topUsersByPoints[1].id, 'usr_1');
  assert.equal(allStats.topUsersByPoints[1].availablePoints, 2000);

  // Today filter should only include l1 (2000 Pts)
  const todayStats = computeAdminDashboardStats({
    users,
    ledger,
    withdrawals,
    filter: { range: 'today', groupBy: 'day', nowIso }
  });
  assert.equal(todayStats.tasks.tasksCompletedCount, 1);
  assert.equal(todayStats.points.totalPointsAwarded, 2000);
});

test('verifyDataIntegrity: detects points mismatch and confirms healthy when synced', () => {
  const users = [
    { id: 'usr_1', email: 'alice@example.com', storedPoints: 2000 },
    { id: 'usr_2', email: 'bob@example.com', storedPoints: 9999 } // Mismatch! Ledger has 5000
  ];
  const ledger: LedgerEntry[] = [
    {
      id: 'l1',
      userId: 'usr_1',
      providerTxId: 'tx_1',
      amountCents: 20,
      points: 2000,
      entryType: 'credit',
      status: 'confirmed',
      createdAt: '2026-10-30T09:00:00.000Z'
    },
    {
      id: 'l2',
      userId: 'usr_2',
      providerTxId: 'tx_2',
      amountCents: 50,
      points: 5000,
      entryType: 'credit',
      status: 'confirmed',
      createdAt: '2026-10-30T09:00:00.000Z'
    }
  ];

  const report = verifyDataIntegrity({ users, ledger, withdrawals: [] });
  assert.equal(report.isHealthy, false);
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.mismatches[0].userId, 'usr_2');
  assert.equal(report.mismatches[0].ledgerPoints, 5000);
  assert.equal(report.mismatches[0].storedPoints, 9999);

  // Fix storedPoints and re-verify
  users[1].storedPoints = 5000;
  const healthyReport = verifyDataIntegrity({ users, ledger, withdrawals: [] });
  assert.equal(healthyReport.isHealthy, true);
  assert.equal(healthyReport.mismatchCount, 0);
});
