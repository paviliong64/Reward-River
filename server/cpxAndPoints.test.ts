import test from 'node:test';
import assert from 'node:assert/strict';
import { dbStore } from './db';
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from './auth';

test('authentication hashing, session token verification, and user lookup work reliably', async () => {
  const { hash, salt } = hashPassword('MySecurePass123');
  assert.equal(verifyPassword('MySecurePass123', hash, salt), true);
  assert.equal(verifyPassword('WrongPass', hash, salt), false);
  assert.equal(verifyPassword('MySecurePass123', '', ''), false);

  const testUserId = 'usr_auth_unit_test_1';
  const created = await dbStore.createUser({
    id: testUserId,
    username: 'river_earner',
    email: 'river_earner@gmail.com',
    passwordHash: hash,
    salt,
    displayName: 'river_earner',
    emailVerified: true,
    role: 'user',
    externalOpaqueId: 'rr_cpx_river_earner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provider: 'password',
    hasPromptedPhone: true
  });

  // Lookup by email, username, and email local-part
  assert.equal(dbStore.getUserByUsernameOrEmail('river_earner@gmail.com')?.id, testUserId);
  assert.equal(dbStore.getUserByUsernameOrEmail('river_earner')?.id, testUserId);
  assert.equal(dbStore.getUserByUsernameOrEmail('RIVER_EARNER')?.id, testUserId);

  const token = createSessionToken(created);
  const session = verifySessionToken(token);
  assert.ok(session);
  assert.equal(session.userId, testUserId);
  assert.equal(session.email, 'river_earner@gmail.com');
  assert.equal(session.username, 'river_earner');

  await dbStore.deleteUser(testUserId);
});

test('getUserByExternalId resolves exact, stripped rr_cpx_, and alphanumeric IDs', async () => {
  const userId = 'u_test_user_987654';
  const extId = `rr_cpx_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;

  await dbStore.createUser({
    id: userId,
    username: 'survey_tester',
    email: 'survey_tester@example.com',
    passwordHash: 'hash123',
    salt: 'salt123',
    displayName: 'Survey Tester',
    emailVerified: true,
    externalOpaqueId: extId,
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 1. Exact externalOpaqueId match
  const matchedExact = dbStore.getUserByExternalId(extId);
  assert.ok(matchedExact, 'Should match exact externalOpaqueId');
  assert.equal(matchedExact.id, userId);

  // 2. Direct user ID match
  const matchedDirect = dbStore.getUserByExternalId(userId);
  assert.ok(matchedDirect, 'Should match direct userId');
  assert.equal(matchedDirect.id, userId);

  // 3. Stripped prefix match (e.g., utestuser987654)
  const stripped = userId.replace(/[^a-zA-Z0-9]/g, '');
  const matchedStripped = dbStore.getUserByExternalId(stripped);
  assert.ok(matchedStripped, 'Should match normalized alphanumeric userId');
  assert.equal(matchedStripped.id, userId);

  await dbStore.deleteUser(userId);
});

test('getUserBalances tracks availablePoints and completedSurveysCount accurately', async () => {
  const userId = 'u_points_counter_1';
  const extId = `rr_cpx_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;

  await dbStore.createUser({
    id: userId,
    username: 'points_user',
    email: 'points_user@example.com',
    passwordHash: 'hash123',
    salt: 'salt123',
    displayName: 'Points User',
    emailVerified: true,
    externalOpaqueId: extId,
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const initialBalances = dbStore.getUserBalances(userId);
  assert.equal(initialBalances.availablePoints, 0);
  assert.equal(initialBalances.completedSurveysCount, 0);

  // Complete first CPX survey (+15,000 points)
  await dbStore.addLedgerEntry({
    id: 'led_test_survey_1',
    userId,
    providerTxId: 'cpx_tx_1001',
    cpxOfferId: 'offer_501',
    entryType: 'credit',
    amountCents: 60,
    points: 15000,
    status: 'confirmed',
    description: 'CPX Research Survey Completion (Offer #offer_501)',
    createdAt: new Date().toISOString()
  });

  const afterFirst = dbStore.getUserBalances(userId);
  assert.equal(afterFirst.availablePoints, 15000);
  assert.equal(afterFirst.completedSurveysCount, 1);

  // Complete second CPX survey (+25,000 points)
  await dbStore.addLedgerEntry({
    id: 'led_test_survey_2',
    userId,
    providerTxId: 'cpx_tx_1002',
    cpxOfferId: 'offer_502',
    entryType: 'credit',
    amountCents: 100,
    points: 25000,
    status: 'confirmed',
    description: 'CPX Research Survey Completion (Offer #offer_502)',
    createdAt: new Date().toISOString()
  });

  const afterSecond = dbStore.getUserBalances(userId);
  assert.equal(afterSecond.availablePoints, 40000);
  assert.equal(afterSecond.completedSurveysCount, 2);

  // Reversal of first survey decrements both points and completedSurveysCount
  await dbStore.addLedgerEntry({
    id: 'led_test_survey_1_rev',
    userId,
    providerTxId: 'cpx_tx_1001_rev',
    cpxOfferId: 'offer_501',
    entryType: 'reversal',
    amountCents: 60,
    points: 15000,
    status: 'confirmed',
    description: 'Chargeback: Survey Reversal (Tx #cpx_tx_1001)',
    createdAt: new Date().toISOString()
  });

  const afterReversal = dbStore.getUserBalances(userId);
  assert.equal(afterReversal.availablePoints, 25000);
  assert.equal(afterReversal.completedSurveysCount, 1);

  await dbStore.deleteUser(userId);
});

test('CPX Postback Handler covers completed, duplicate, bad hash, and reversed callback cases accurately', async () => {
  const { cpxResearchService } = await import('./cpxResearchService');
  const crypto = await import('crypto');

  const userId = 'u_cpx_postback_e2e_1';
  const extUserId = 'rr_cpx_ucpxpostbacke2e1';
  const secret = cpxResearchService.hashKey;

  await dbStore.createUser({
    id: userId,
    username: 'cpx_verifier',
    email: 'cpx_verifier@example.com',
    passwordHash: 'hash123',
    salt: 'salt123',
    displayName: 'CPX Verifier',
    emailVerified: true,
    externalOpaqueId: extUserId,
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const transId = `cpx_test_tx_${Date.now()}`;
  const validHash = crypto.createHash('md5').update(`${transId}-${secret}`).digest('hex');

  // CASE 1: BAD HASH CALLBACK -> Rejected, 0 points credited, logged in audit_log, HTTP 200 "OK"
  const badHashResult = await cpxResearchService.processCpxPostback({
    status: 1,
    transId,
    extUserId,
    amountLocal: 4000,
    amountUsd: 0.80,
    offerId: 'offer_999',
    secureHash: 'forged_invalid_md5_signature_0000'
  });
  assert.equal(badHashResult.httpStatus, 200);
  assert.equal(badHashResult.responseText, 'OK');
  assert.equal(badHashResult.outcome, 'bad_hash');
  assert.equal(badHashResult.pointsDelta, 0);
  assert.equal(dbStore.getUserBalances(userId).availablePoints, 0);

  // Verify audit log recorded the rejected bad hash attempt
  const auditLogs = dbStore.getAuditLogs();
  assert.ok(
    auditLogs.some((l) => l.action === 'CPX_POSTBACK_BAD_HASH_REJECTED' && l.details.includes(transId)),
    'Bad hash attempt must be recorded in audit_log'
  );

  // CASE 2: COMPLETED CALLBACK (status=1, valid secure_hash, amount_usd=0.80)
  // Points = amount_usd ($0.80) * conversion_rate (5,000 Pts/$1 from settings) = 4,000 Points
  const completedResult = await cpxResearchService.processCpxPostback({
    status: 1,
    transId,
    extUserId,
    amountLocal: 4000,
    amountUsd: 0.80,
    offerId: 'offer_999',
    secureHash: validHash
  });
  assert.equal(completedResult.httpStatus, 200);
  assert.equal(completedResult.responseText, 'OK');
  assert.equal(completedResult.outcome, 'credited');
  assert.equal(completedResult.pointsDelta, 4000);
  assert.equal(dbStore.getUserBalances(userId).availablePoints, 4000);
  assert.equal(dbStore.getUserBalances(userId).completedSurveysCount, 1);

  // CASE 3: DUPLICATE CALLBACK (same trans_id sent again) -> Idempotent, 0 points added, HTTP 200 "OK"
  const duplicateResult = await cpxResearchService.processCpxPostback({
    status: 1,
    transId,
    extUserId,
    amountLocal: 4000,
    amountUsd: 0.80,
    offerId: 'offer_999',
    secureHash: validHash
  });
  assert.equal(duplicateResult.httpStatus, 200);
  assert.equal(duplicateResult.responseText, 'OK');
  assert.equal(duplicateResult.outcome, 'duplicate');
  assert.equal(duplicateResult.pointsDelta, 0);
  assert.equal(dbStore.getUserBalances(userId).availablePoints, 4000);

  // CASE 4A: REVERSED CALLBACK ON UNCREDITED TRANS_ID -> Ignored, 0 deducted
  const unknownTransId = `cpx_never_credited_${Date.now()}`;
  const unknownValidHash = crypto.createHash('md5').update(`${unknownTransId}-${secret}`).digest('hex');
  const uncreditedRevResult = await cpxResearchService.processCpxPostback({
    status: 2,
    transId: unknownTransId,
    extUserId,
    amountLocal: 4000,
    amountUsd: 0.80,
    offerId: 'offer_999',
    secureHash: unknownValidHash
  });
  assert.equal(uncreditedRevResult.httpStatus, 200);
  assert.equal(uncreditedRevResult.outcome, 'reversal_ignored_not_credited');
  assert.equal(uncreditedRevResult.pointsDelta, 0);
  assert.equal(dbStore.getUserBalances(userId).availablePoints, 4000);

  // CASE 4B: REVERSED CALLBACK ON CREDITED TRANS_ID (status=2) -> Negative ledger entry (-4,000 Pts), balance = 0
  const reversedResult = await cpxResearchService.processCpxPostback({
    status: 2,
    transId,
    extUserId,
    amountLocal: 4000,
    amountUsd: 0.80,
    offerId: 'offer_999',
    secureHash: validHash
  });
  assert.equal(reversedResult.httpStatus, 200);
  assert.equal(reversedResult.responseText, 'OK');
  assert.equal(reversedResult.outcome, 'reversed');
  assert.equal(reversedResult.pointsDelta, -4000);
  assert.equal(dbStore.getUserBalances(userId).availablePoints, 0);
  assert.equal(dbStore.getUserBalances(userId).completedSurveysCount, 0);

  // CASE 4C: DUPLICATE REVERSAL -> Idempotent, cannot deduct twice
  const duplicateRevResult = await cpxResearchService.processCpxPostback({
    status: 2,
    transId,
    extUserId,
    amountLocal: 4000,
    amountUsd: 0.80,
    offerId: 'offer_999',
    secureHash: validHash
  });
  assert.equal(duplicateRevResult.outcome, 'duplicate_reversal');
  assert.equal(duplicateRevResult.pointsDelta, 0);
  assert.equal(dbStore.getUserBalances(userId).availablePoints, 0);

  await dbStore.deleteUser(userId);
});

