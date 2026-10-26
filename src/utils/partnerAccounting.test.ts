import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyLedgerPartner,
  calculatePartnerUnitEconomics,
  buildPartnerAccountingReport
} from './partnerAccounting';
import { LedgerEntry } from './ledger';

describe('Partner Revenue & Settlement Accounting Logic', () => {
  it('accurately classifies CPX Research vs AoyTasks (PTC & Shortlink) ledger entries', () => {
    const cpxEntry: Partial<LedgerEntry> = {
      providerTxId: 'test_cpx_1001',
      cpxOfferId: 'offer_302',
      description: 'CPX Survey (+10,000 Pts • Offer #302)'
    };
    const cpxClass = classifyLedgerPartner(cpxEntry);
    assert.equal(cpxClass.partnerId, 'cpx_research');
    assert.equal(cpxClass.subCategory, 'cpx_survey');

    const aoyPtcEntry: Partial<LedgerEntry> = {
      providerTxId: 'aoy_99812',
      cpxOfferId: 'ptc_41',
      description: 'Instant Task Reward (+5,000 Pts • Sponsored Visit)'
    };
    const aoyPtcClass = classifyLedgerPartner(aoyPtcEntry);
    assert.equal(aoyPtcClass.partnerId, 'aoytasks');
    assert.equal(aoyPtcClass.subCategory, 'aoy_ptc');

    const aoyShortlinkEntry: Partial<LedgerEntry> = {
      providerTxId: 'rr_task_usr1_sl_201_2026-10-26',
      cpxOfferId: 'sl_201',
      description: 'Instant Task Reward (+4,000 Pts • Express Link Verification)'
    };
    const aoySlClass = classifyLedgerPartner(aoyShortlinkEntry);
    assert.equal(aoySlClass.partnerId, 'aoytasks');
    assert.equal(aoySlClass.subCategory, 'aoy_shortlink');
  });

  it('computes unit economics milestones for 40% User Share and 60% Admin Profit', () => {
    const rows = calculatePartnerUnitEconomics(40, 10000);
    const tenK = rows.find((r) => r.pointsMilestone === 10000);
    assert.ok(tenK);
    assert.equal(tenK.partnerPaysGrossUsd, '$1.00');
    assert.equal(tenK.userGetsUsd, '$0.40');
    assert.equal(tenK.adminKeepsProfitUsd, '$0.60');
  });

  it('aggregates per-partner Gross Revenue, User Payout, and Admin Profit accurately', () => {
    const sampleLedger: LedgerEntry[] = [
      {
        id: 'l1',
        userId: 'u1',
        providerTxId: 'cpx_tx_1',
        amountCents: 40,
        points: 10000,
        grossCents: 100,
        adminProfitCents: 60,
        appliedSharePercent: 40,
        entryType: 'credit',
        status: 'confirmed',
        description: 'Survey Completion (+10,000 Pts • Offer #101)',
        cpxOfferId: '101',
        createdAt: '2026-10-26T10:00:00.000Z'
      },
      {
        id: 'l2',
        userId: 'u1',
        providerTxId: 'aoy_tx_1',
        amountCents: 20,
        points: 5000,
        grossCents: 50,
        adminProfitCents: 30,
        appliedSharePercent: 40,
        entryType: 'credit',
        status: 'confirmed',
        description: 'Instant Task Reward (+5,000 Pts • Sponsored Cloud Visit)',
        cpxOfferId: 'ptc_10',
        createdAt: '2026-10-26T11:00:00.000Z'
      }
    ];

    const report = buildPartnerAccountingReport(sampleLedger, 40, 10000);
    assert.equal(report.totals.grossRevenueCents, 150); // $1.50 total from partners
    assert.equal(report.totals.userPayoutCents, 60); // $0.60 total to users (40%)
    assert.equal(report.totals.adminProfitCents, 90); // $0.90 total profit to admin (60%)

    const cpx = report.partners.find((p) => p.partnerId === 'cpx_research')!;
    const aoy = report.partners.find((p) => p.partnerId === 'aoytasks')!;

    assert.equal(cpx.grossRevenueUsdFormatted, '$1.00');
    assert.equal(cpx.userPayoutUsdFormatted, '$0.40');
    assert.equal(cpx.adminProfitUsdFormatted, '$0.60');
    assert.equal(cpx.completedCount, 1);

    assert.equal(aoy.grossRevenueUsdFormatted, '$0.50');
    assert.equal(aoy.userPayoutUsdFormatted, '$0.20');
    assert.equal(aoy.adminProfitUsdFormatted, '$0.30');
    assert.equal(aoy.completedCount, 1);
    assert.equal(aoy.ptcCompletedCount, 1);
  });
});
