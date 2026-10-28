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
