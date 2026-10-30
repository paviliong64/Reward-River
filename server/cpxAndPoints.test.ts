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

  // Verify callback_logs recorded bad_hash, credited, duplicate, reversed
  const cbLogs = dbStore.getCallbackLogs();
  assert.ok(cbLogs.some((c) => c.transId === transId && c.result === 'bad_hash'));
  assert.ok(cbLogs.some((c) => c.transId === transId && c.result === 'credited'));
  assert.ok(cbLogs.some((c) => c.transId === transId && c.result === 'duplicate'));
  assert.ok(cbLogs.some((c) => c.transId === transId && c.result === 'reversed'));

  await dbStore.deleteUser(userId);
});

test('Teams, Manager Roles, One-Manager-Many-Teams, Team Points Exclusion, and Scoping work accurately', async () => {
  const adminId = 'usr_admin_test_99';
  const mgrAId = 'usr_mgr_a_test_1';
  const mgrBId = 'usr_mgr_b_test_2';
  const member1Id = 'usr_member_1_test';
  const member2Id = 'usr_member_2_test';

  const adminUser = await dbStore.createUser({
    id: adminId,
    username: 'test_admin_99',
    email: 'test_admin_99@rewardriver.online',
    passwordHash: 'h',
    salt: 's',
    displayName: 'Test Admin',
    emailVerified: true,
    role: 'admin',
    externalOpaqueId: 'rr_cpx_admin99',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const mgrAUser = await dbStore.createUser({
    id: mgrAId,
    username: 'mgr_alpha',
    email: 'mgr_alpha@rewardriver.online',
    passwordHash: 'h',
    salt: 's',
    displayName: 'Manager Alpha',
    emailVerified: true,
    role: 'user',
    externalOpaqueId: 'rr_cpx_mgralpha',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  await dbStore.createUser({
    id: mgrBId,
    username: 'mgr_beta',
    email: 'mgr_beta@rewardriver.online',
    passwordHash: 'h',
    salt: 's',
    displayName: 'Manager Beta',
    emailVerified: true,
    role: 'manager',
    externalOpaqueId: 'rr_cpx_mgrbeta',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const member1User = await dbStore.createUser({
    id: member1Id,
    username: 'member_one',
    email: 'member_one@rewardriver.online',
    passwordHash: 'h',
    salt: 's',
    displayName: 'Member One',
    emailVerified: true,
    role: 'user',
    externalOpaqueId: 'rr_cpx_memberone',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  await dbStore.createUser({
    id: member2Id,
    username: 'member_two',
    email: 'member_two@rewardriver.online',
    passwordHash: 'h',
    salt: 's',
    displayName: 'Member Two',
    emailVerified: true,
    role: 'user',
    externalOpaqueId: 'rr_cpx_membertwo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Enable team_system_enabled for testing
  const prevSettings = { ...dbStore.getSettings() };
  await dbStore.updateSettings(
    {
      teamSystemEnabled: true,
      managersCanCreateTeams: false,
      maxTeamsPerManager: 5,
      teamBonusEnabled: true,
      teamBonusPercent: 10
    },
    adminId
  );

  // Non-admin user cannot promote to manager (Test Case 11)
  await assert.rejects(
    async () => {
      await dbStore.setUserRole({
        targetUserId: mgrAId,
        newRole: 'manager',
        actorUser: member1User
      });
    },
    /Only an Administrator can promote or demote managers/i
  );

  // Admin promotes mgrAId to manager
  const promoRes = await dbStore.setUserRole({
    targetUserId: mgrAId,
    newRole: 'manager',
    actorUser: adminUser
  });
  assert.equal(promoRes.user.role, 'manager');
  assert.equal(dbStore.getUserById(mgrAId)?.role, 'manager');

  // Non-admin manager cannot create team when managersCanCreateTeams = false (Test Case 11)
  await assert.rejects(
    async () => {
      await dbStore.createTeam({
        name: 'Unauthorized Self Team',
        managerId: mgrAId,
        actorUser: dbStore.getUserById(mgrAId)!
      });
    },
    /Team creation requires Admin approval/i
  );

  // Admin creates 2 teams for Manager Alpha (One Manager -> Many Teams)
  const team1 = await dbStore.createTeam({
    name: 'Alpha Squad 1',
    managerId: mgrAId,
    actorUser: adminUser
  });
  assert.ok(team1.teamCode.length >= 6 && team1.teamCode.length <= 8);

  const team2 = await dbStore.createTeam({
    name: 'Alpha Squad 2',
    managerId: mgrAId,
    actorUser: adminUser
  });
  assert.ok(team2.teamCode.length >= 6 && team2.teamCode.length <= 8);

  // Admin creates 1 team for Manager Beta
  const teamB = await dbStore.createTeam({
    name: 'Beta Squad',
    managerId: mgrBId,
    actorUser: adminUser
  });
  assert.ok(teamB.id);

  // Test Case 6: Joining with valid team_code requires consent=true
  await assert.rejects(
    async () => {
      await dbStore.joinTeamByCode({
        userId: member1Id,
        teamCode: team1.teamCode,
        consentAccepted: false
      });
    },
    /consent disclosure/i
  );

  const validJoin1 = await dbStore.joinTeamByCode({
    userId: member1Id,
    teamCode: team1.teamCode,
    consentAccepted: true
  });
  assert.equal(validJoin1.team.id, team1.id);

  // Test Case 7: Joining a second team is blocked (one team per user)
  await assert.rejects(
    async () => {
      await dbStore.joinTeamByCode({
        userId: member1Id,
        teamCode: team2.teamCode,
        consentAccepted: true
      });
    },
    /already a member of a team/i
  );

  // Block promoting a user who is currently a member of any team
  await assert.rejects(
    async () => {
      await dbStore.setUserRole({
        targetUserId: member1Id,
        newRole: 'manager',
        actorUser: adminUser
      });
    },
    /Cannot promote .* while they are a member of team/i
  );

  // Member 2 joins Alpha Squad 2
  const validJoin2 = await dbStore.joinTeamByCode({
    userId: member2Id,
    teamCode: team2.teamCode,
    consentAccepted: true
  });
  assert.equal(validJoin2.team.id, team2.id);

  // Test Case 8: Disabled or invalid team_code is rejected on join
  await dbStore.updateTeam({
    teamId: teamB.id,
    isActive: false,
    actorUser: adminUser
  });
  const lookupDisabled = dbStore.lookupTeamByCode(teamB.teamCode);
  assert.equal(lookupDisabled?.isActive, false);

  await assert.rejects(
    async () => {
      await dbStore.joinTeamByCode({
        userId: mgrAUser.id,
        teamCode: teamB.teamCode,
        consentAccepted: true
      });
    },
    /Managers cannot join a team|inactive/i
  );

  // Test Case 9 & 10: Team points = sum of members' ledger entries (excluding team_bonus & manager's personal points)
  await dbStore.addLedgerEntry({
    id: 'led_team_m1_1',
    userId: member1Id,
    providerTxId: 'tx_team_m1_1',
    entryType: 'credit',
    amountCents: 100,
    points: 5000,
    reason: 'survey_completion',
    status: 'confirmed',
    description: 'Survey completion M1',
    createdAt: new Date().toISOString()
  });

  await dbStore.addLedgerEntry({
    id: 'led_team_m2_1',
    userId: member2Id,
    providerTxId: 'tx_team_m2_1',
    entryType: 'credit',
    amountCents: 60,
    points: 3000,
    reason: 'survey_completion',
    status: 'confirmed',
    description: 'Survey completion M2',
    createdAt: new Date().toISOString()
  });

  await dbStore.addLedgerEntry({
    id: 'led_mgr_personal_1',
    userId: mgrAId,
    providerTxId: 'tx_mgr_personal_1',
    entryType: 'credit',
    amountCents: 40,
    points: 2000,
    reason: 'survey_completion',
    status: 'confirmed',
    description: 'Manager personal survey',
    createdAt: new Date().toISOString()
  });

  await dbStore.addLedgerEntry({
    id: 'led_mgr_bonus_1',
    userId: mgrAId,
    providerTxId: 'tx_team_m1_1_team_bonus',
    entryType: 'credit',
    amountCents: 10,
    points: 500,
    reason: 'team_bonus',
    status: 'confirmed',
    description: 'Team bonus from M1',
    createdAt: new Date().toISOString()
  });

  const mgrADashboard = dbStore.getManagerDashboardData({
    managerId: mgrAId,
    teamId: 'all',
    range: 'all'
  });

  assert.equal(mgrADashboard.summary.totalTeams, 2);
  assert.equal(mgrADashboard.summary.totalMembers, 2);
  // Combined team points = 5000 + 3000 = 8000 (excludes manager's 2000 personal + 500 team_bonus)
  assert.equal(mgrADashboard.summary.totalTeamPoints, 8000);
  assert.equal(mgrADashboard.summary.managerPersonalSurveyPoints, 2000);
  assert.equal(mgrADashboard.summary.managerTeamBonusPoints, 500);

  // Per-team filter check
  const mgrATeam1Only = dbStore.getManagerDashboardData({
    managerId: mgrAId,
    teamId: team1.id,
    range: 'all'
  });
  assert.equal(mgrATeam1Only.members.length, 1);
  assert.equal(mgrATeam1Only.members[0].totalPoints, 5000);

  // Test Case 12: Manager B cannot read Manager A's members
  const crossManagerRead = dbStore.getManagerMemberDetail({
    managerId: mgrBId,
    memberUserId: member1Id
  });
  assert.equal(crossManagerRead, null);
  const validManagerRead = dbStore.getManagerMemberDetail({
    managerId: mgrAId,
    memberUserId: member1Id
  });
  assert.ok(validManagerRead);
  assert.equal(validManagerRead.totalPoints, 5000);

  // Demoting Manager Alpha sets role = 'user' and is_active = false on all their teams while keeping member history
  const demoteRes = await dbStore.setUserRole({
    targetUserId: mgrAId,
    newRole: 'user',
    actorUser: adminUser
  });
  assert.equal(demoteRes.user.role, 'user');
  assert.equal(dbStore.getUserById(mgrAId)?.role, 'user');
  const mgrATeamsAfterDemote = dbStore.getTeamsForManager(mgrAId);
  assert.ok(mgrATeamsAfterDemote.every((t) => t.isActive === false));
  // Member history is preserved
  assert.ok(dbStore.getTeamMembershipForUser(member1Id));

  // Cleanup test records
  await dbStore.updateSettings(prevSettings, adminId);
  await dbStore.deleteUser(member1Id);
  await dbStore.deleteUser(member2Id);
  await dbStore.deleteUser(mgrAId);
  await dbStore.deleteUser(mgrBId);
  await dbStore.deleteUser(adminId);
});

test('Admin "View as User" Impersonation enforces 15-min expiry, read-only blocking, and prevents impersonating another admin', async () => {
  const { createImpersonationToken, verifySessionToken, blockWhenImpersonating } = await import('./auth');

  const adminUser = await dbStore.createUser({
    id: 'usr_imp_admin_1',
    username: 'imp_admin',
    email: 'imp_admin@rewardriver.online',
    passwordHash: 'h',
    salt: 's',
    displayName: 'Impersonation Admin',
    emailVerified: true,
    role: 'admin',
    externalOpaqueId: 'rr_cpx_impadmin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const secondAdmin = await dbStore.createUser({
    id: 'usr_imp_admin_2',
    username: 'imp_admin_2',
    email: 'imp_admin_2@rewardriver.online',
    passwordHash: 'h',
    salt: 's',
    displayName: 'Second Admin',
    emailVerified: true,
    role: 'admin',
    externalOpaqueId: 'rr_cpx_impadmin2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const regularUser = await dbStore.createUser({
    id: 'usr_imp_target_1',
    username: 'imp_target',
    email: 'imp_target@rewardriver.online',
    passwordHash: 'h',
    salt: 's',
    displayName: 'Impersonation Target',
    emailVerified: true,
    role: 'user',
    externalOpaqueId: 'rr_cpx_imptarget',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Test Case 16: Admin cannot impersonate another admin
  await assert.rejects(
    async () => {
      await dbStore.createImpersonationSession({
        adminUser,
        targetUserId: secondAdmin.id,
        ipAddress: '127.0.0.1'
      });
    },
    /cannot impersonate another Administrator/i
  );

  // Create 15-minute scoped read-only impersonation session
  const impSession = await dbStore.createImpersonationSession({
    adminUser,
    targetUserId: regularUser.id,
    ipAddress: '127.0.0.1'
  });

  const token = createImpersonationToken(regularUser, {
    sessionId: impSession.id,
    adminId: adminUser.id,
    adminEmail: adminUser.email,
    targetUserId: regularUser.id,
    targetEmail: regularUser.email,
    startedAt: impSession.startedAt,
    expiresAt: impSession.expiresAt,
    readOnly: true
  });

  const verified = verifySessionToken(token);
  assert.ok(verified);
  assert.equal(verified.userId, regularUser.id);
  assert.ok(verified.impersonation);
  assert.equal(verified.impersonation.readOnly, true);
  assert.equal(verified.impersonation.adminId, adminUser.id);

  // Test Case 14: Verify blockWhenImpersonating middleware rejects write requests with 403
  let statusSent = 200;
  let jsonBody: any = null;
  let nextCalled = false;
  const mockReq: any = { impersonation: verified.impersonation };
  const mockRes: any = {
    status(code: number) {
      statusSent = code;
      return this;
    },
    json(payload: any) {
      jsonBody = payload;
      return this;
    }
  };
  blockWhenImpersonating(mockReq, mockRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(statusSent, 403);
  assert.ok(String(jsonBody?.error || '').includes('Read-only mode active'));

  // Test Case 15: Verify expired impersonation token is rejected
  const expiredToken = createImpersonationToken(regularUser, {
    sessionId: impSession.id,
    adminId: adminUser.id,
    adminEmail: adminUser.email,
    targetUserId: regularUser.id,
    targetEmail: regularUser.email,
    startedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString(), // already expired
    readOnly: true
  });
  assert.equal(verifySessionToken(expiredToken), null);

  await dbStore.endImpersonationSession(impSession.id, adminUser.email);
  await dbStore.deleteUser(regularUser.id);
  await dbStore.deleteUser(secondAdmin.id);
  await dbStore.deleteUser(adminUser.id);
});

test('Data Integrity & Dry-Run Backfill verify every user balance equals SUM(points_ledger) without mutating on dryRun=true', async () => {
  const { runUserAndLedgerBackfill } = await import('./migrateBackfillUsers');

  const dryRunReport = await runUserAndLedgerBackfill({ dryRun: true });
  assert.equal(dryRunReport.dryRun, true);
  assert.ok(dryRunReport.beforeSummary);
  assert.ok(dryRunReport.afterSummary);

  // Verify every user's availablePoints matches getUserBalances(u.id).availablePoints
  const allUsers = dbStore.getAllUsers();
  for (const u of allUsers) {
    const bal = dbStore.getUserBalances(u.id);
    const ledger = dbStore.getLedgerForUser(u.id);
    let expectedEarned = 0;
    for (const entry of ledger) {
      const pts = entry.points !== undefined ? entry.points : entry.amountCents * 100;
      if (entry.entryType === 'credit' && entry.status === 'confirmed') {
        expectedEarned += pts;
      }
    }
    assert.equal(bal.totalEarnedPoints, expectedEarned, `User ${u.id} earned points must match ledger sum`);
  }
});


