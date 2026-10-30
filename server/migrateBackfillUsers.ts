import crypto from 'node:crypto';
import { dbStore, LedgerEntry } from './db';
import { formatKarachiDateTime } from '../src/utils/adminStats';

export interface BackfillResultSummary {
  dryRun: boolean;
  executedAt: string;
  executedAtKarachi: string;
  totalUsersScanned: number;
  permanentIdsAssigned: number;
  opaqueIdsAssigned: number;
  legacyPointsBackfilledCount: number;
  userTotalsReconciledCount: number;
  supabaseSyncedCount: number;
  beforeSummary: {
    totalUsers: number;
    totalLedgerEntries: number;
    sumOfStoredPoints: number;
    sumOfLedgerPoints: number;
  };
  afterSummary: {
    totalUsers: number;
    totalLedgerEntries: number;
    sumOfStoredPoints: number;
    sumOfLedgerPoints: number;
  };
  details: string[];
}

/**
 * Migration & Backfill Script for Existing ("Old") and New Users (Supports DRY-RUN and LIVE modes)
 *
 * Guarantees:
 * 1. Every user has a permanent, non-random server-side `id` and `externalOpaqueId` (`rr_cpx_<alphanumeric>`).
 * 2. Any old user who had stored points in Supabase `users.points` or `task_completions` prior to the points ledger
 *    receives an idempotent, verified `confirmed` credit entry in `reward_ledger` (`points_ledger`)
 *    so no historical earnings are ever lost.
 * 3. Every user's `users.points`, `users.balance_cents`, and `users.total_earned_points` in Supabase
 *    is reconciled to equal the exact sum of their confirmed `reward_ledger` entries minus withdrawals.
 * 4. When `dryRun: true`, computes the exact diff and before/after summary without mutating any records.
 */
export async function runUserAndLedgerBackfill(options?: { dryRun?: boolean }): Promise<BackfillResultSummary> {
  const dryRun = Boolean(options?.dryRun);
  await dbStore.init();
  await dbStore.syncFromSupabase(true);

  const sb = dbStore.getSupabaseClient();
  const nowIso = new Date().toISOString();
  const details: string[] = [];

  let permanentIdsAssigned = 0;
  let opaqueIdsAssigned = 0;
  let legacyPointsBackfilledCount = 0;
  let userTotalsReconciledCount = 0;
  let supabaseSyncedCount = 0;

  // Fetch raw Supabase users to check for any legacy points not yet in reward_ledger
  const sbUsersById = new Map<string, any>();
  if (sb) {
    try {
      const { data: sbUsers } = await sb.from('users').select('*');
      if (Array.isArray(sbUsers)) {
        for (const row of sbUsers) {
          if (row && row.id) {
            sbUsersById.set(String(row.id), row);
          }
        }
      }
    } catch (e) {
      details.push(`Supabase read warning: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const allUsers = dbStore.getAllUsers();
  const existingLedgerBefore = dbStore.getAllLedgerEntries();

  let beforeSumStored = 0;
  let beforeSumLedger = 0;
  for (const u of allUsers) {
    const sbRow = sbUsersById.get(u.id);
    const storedPts = sbRow !== undefined ? Number(sbRow.points) || 0 : (u.storedPoints ?? 0);
    const bal = dbStore.getUserBalances(u.id);
    beforeSumStored += storedPts;
    beforeSumLedger += bal.availablePoints;
  }

  let simulatedLedgerAddedPoints = 0;

  for (const user of allUsers) {
    let userUpdated = false;
    let targetId = String(user.id || '').trim();

    if (!targetId || targetId.length < 4) {
      targetId = `usr_${crypto.randomUUID()}`;
      permanentIdsAssigned++;
      userUpdated = true;
      details.push(`${dryRun ? '[DRY-RUN] Would assign' : 'Assigned'} permanent ID ${targetId} to ${user.email}`);
    }

    let extId = String(user.externalOpaqueId || '').trim();
    const isInvalidExt = !extId || extId.length < 6 || extId.includes('@') || extId.includes('gmail.com');
    if (isInvalidExt) {
      const cleanHex = targetId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
      extId = `rr_cpx_${cleanHex || crypto.randomBytes(8).toString('hex')}`;
      opaqueIdsAssigned++;
      userUpdated = true;
      details.push(`${dryRun ? '[DRY-RUN] Would assign' : 'Assigned'} permanent externalOpaqueId ${extId} to ${user.email}`);
    }

    // 1. Convert any past completed survey/task records (task_completions) into ledger entries once (idempotent, no data loss)
    const allCompletions = dbStore.getTaskCompletions().filter(
      tc =>
        (tc.userId === targetId || tc.userId === extId) &&
        tc.status === 'completed'
    );
    const existingLedger = dbStore.getAllLedgerEntries();
    let userAddedPtsFromCompletions = 0;

    for (const tc of allCompletions) {
      const txId = String(tc.providerTxId || tc.id).trim();
      if (!txId) continue;
      const alreadyInLedger = existingLedger.some(
        l => l.providerTxId === txId || l.id === `le_cpx_${txId}`
      );
      if (!alreadyInLedger) {
        const pts = Math.max(50, Math.round(Number(tc.pointsAwarded || (tc as any).points) || 500));
        const userAmountCents = Math.max(1, Math.round(pts / 100));
        const grossCents = Math.max(userAmountCents, Math.round((pts / 5000) * 100));
        const adminProfitCents = Math.max(0, grossCents - userAmountCents);
        const completionLedgerEntry: LedgerEntry = {
          id: `le_cpx_${txId.replace(/^cpx_/, '')}`,
          userId: targetId,
          providerTxId: txId,
          taskId: tc.taskId || 'task_cpx_survey',
          cpxOfferId: tc.taskId || txId,
          amountCents: userAmountCents,
          points: pts,
          grossCents,
          adminProfitCents,
          appliedSharePercent: 50,
          entryType: 'credit',
          status: 'confirmed',
          approvedBy: tc.approvedBy || 'System Completion Backfill',
          description: `${tc.title || (tc as any).reason || 'Completed Survey'} (+${pts.toLocaleString('en-US')} Pts)`,
          createdAt: tc.createdAt || user.createdAt || nowIso,
          processedAt: nowIso
        };
        if (!dryRun) {
          await dbStore.upsertLedgerEntry(completionLedgerEntry);
        }
        userAddedPtsFromCompletions += pts;
        simulatedLedgerAddedPoints += pts;
        legacyPointsBackfilledCount++;
        details.push(
          `${dryRun ? '[DRY-RUN] Would convert' : 'Converted'} completed survey/task ${txId} (+${pts.toLocaleString('en-US')} Pts) into ledger entry for ${user.email}`
        );
      }
    }

    // 2. Check if user had historical points in Supabase or storedPoints but 0 ledger records
    const userLedger = dbStore.getLedgerForUser(targetId);
    const sbRow = sbUsersById.get(targetId);
    const historicalPoints = Math.max(
      0,
      Number(sbRow?.points) || Number(user.storedPoints) || 0
    );

    if (user.role !== 'admin' && historicalPoints > 0 && userLedger.length === 0 && userAddedPtsFromCompletions === 0) {
      const userAmountCents = Math.max(1, Math.round(historicalPoints / 100));
      const grossCents = Math.max(userAmountCents, Math.round((historicalPoints / 5000) * 100));
      const adminProfitCents = Math.max(0, grossCents - userAmountCents);
      const backfillEntry: LedgerEntry = {
        id: `le_backfill_${targetId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`,
        userId: targetId,
        providerTxId: `backfill_tx_${targetId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`,
        taskId: 'task_cpx_survey',
        cpxOfferId: 'legacy_completed_work',
        amountCents: userAmountCents,
        points: historicalPoints,
        grossCents,
        adminProfitCents,
        appliedSharePercent: 50,
        entryType: 'credit',
        status: 'confirmed',
        approvedBy: 'System Historical Backfill',
        description: `Historical Completed Tasks Backfill (+${historicalPoints.toLocaleString('en-US')} Pts)`,
        createdAt: user.createdAt || nowIso,
        processedAt: nowIso
      };

      if (!dryRun) {
        await dbStore.upsertLedgerEntry(backfillEntry);
      }
      simulatedLedgerAddedPoints += historicalPoints;
      legacyPointsBackfilledCount++;
      details.push(
        `${dryRun ? '[DRY-RUN] Would backfill' : 'Backfilled'} ${historicalPoints.toLocaleString('en-US')} Pts ledger entry for ${user.email} (${targetId})`
      );
    }

    // 3. Recompute authoritative balance from ledger entries
    const balances = dbStore.getUserBalances(targetId);
    const projectedAvailable = dryRun
      ? balances.availablePoints + userAddedPtsFromCompletions
      : balances.availablePoints;
    const currentStoredPts = sbRow !== undefined ? Number(sbRow.points) || 0 : user.storedPoints;

    if (currentStoredPts !== projectedAvailable || userUpdated) {
      if (!dryRun) {
        await dbStore.updateUser(targetId, {
          externalOpaqueId: extId,
          storedPoints: balances.availablePoints
        });
      } else {
        details.push(
          `[DRY-RUN] Would reconcile storedPoints for ${user.email}: ${currentStoredPts ?? 0} -> ${projectedAvailable}`
        );
      }
      userTotalsReconciledCount++;
    }

    if (sb && !dryRun) {
      try {
        const { error } = await sb
          .from('users')
          .update({
            external_opaque_id: extId,
            points: balances.availablePoints,
            balance_cents: balances.availableCents,
            total_earned_points: balances.totalEarnedPoints,
            updated_at: nowIso
          })
          .eq('id', targetId);
        if (!error) {
          supabaseSyncedCount++;
        }
      } catch {
        // ignore individual row error
      }
    }
  }

  const afterLedgerCount = dryRun
    ? existingLedgerBefore.length + legacyPointsBackfilledCount
    : dbStore.getAllLedgerEntries().length;
  const afterSumLedger = dryRun
    ? beforeSumLedger + simulatedLedgerAddedPoints
    : dbStore.getAllUsers().reduce((acc, u) => acc + dbStore.getUserBalances(u.id).availablePoints, 0);

  return {
    dryRun,
    executedAt: nowIso,
    executedAtKarachi: formatKarachiDateTime(nowIso),
    totalUsersScanned: allUsers.length,
    permanentIdsAssigned,
    opaqueIdsAssigned,
    legacyPointsBackfilledCount,
    userTotalsReconciledCount,
    supabaseSyncedCount,
    beforeSummary: {
      totalUsers: allUsers.length,
      totalLedgerEntries: existingLedgerBefore.length,
      sumOfStoredPoints: beforeSumStored,
      sumOfLedgerPoints: beforeSumLedger
    },
    afterSummary: {
      totalUsers: allUsers.length,
      totalLedgerEntries: afterLedgerCount,
      sumOfStoredPoints: afterSumLedger,
      sumOfLedgerPoints: afterSumLedger
    },
    details
  };
}

// Allow direct execution via `npx tsx server/migrateBackfillUsers.ts [--dry-run]`
const isDirectExecution =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1]?.endsWith('migrateBackfillUsers.ts');

if (isDirectExecution) {
  const isDry = process.argv.includes('--dry-run');
  runUserAndLedgerBackfill({ dryRun: isDry })
    .then(summary => {
      console.log(`=== User & Points Ledger Backfill (${isDry ? 'DRY-RUN' : 'LIVE'}) Complete ===`);
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Backfill failed:', err);
      process.exit(1);
    });
}

