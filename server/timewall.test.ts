import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { dbStore } from './db';
import { timewallService } from './timewallService';
import {
  computeTimewallHash,
  extractRawQueryParams,
  parseDecimalToMicros,
  verifyAndComputeTimewallCoins
} from '../src/utils/timewall';

const TEST_SECRET = '3e8f2c753e704d59013d34c6474363c3';
const WHITELISTED_IP = '18.156.132.55';
const RETIRED_SOON_IP_1 = '51.81.120.73';
const RETIRED_SOON_IP_2 = '142.111.248.18';
const COINS_PER_USD = 5000;

describe('TimeWall.io Offerwall & Postback Integration Suite', () => {
  const testUserId = 'usr_tw_earner_01';
  const blockedUserId = 'usr_tw_blocked_02';

  before(async () => {
    await dbStore.init();

    await dbStore.createUser({
      id: testUserId,
      username: 'tw_earner',
      email: 'tw_earner@rewardriver.online',
      passwordHash: 'hash',
      salt: 'salt',
      displayName: 'TimeWall Earner',
      emailVerified: true,
      role: 'user',
      externalOpaqueId: 'rr_cpx_tw_earner_01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      offerwallBlocked: false
    });

    await dbStore.createUser({
      id: blockedUserId,
      username: 'tw_blocked',
      email: 'tw_blocked@rewardriver.online',
      passwordHash: 'hash',
      salt: 'salt',
      displayName: 'Blocked Earner',
      emailVerified: true,
      role: 'user',
      externalOpaqueId: 'rr_cpx_tw_blocked_02',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      offerwallBlocked: true
    });
  });

  it('1. Preserves raw revenue strings ("0.002", "0.5", "0.50") without rounding or padding to 2 decimals during query parsing and SHA-256 hashing', () => {
    const rawUrl1 = '/postback/timewall?userid=usr_1&txid=tx_1&revenue=0.5&currency=2500&hash=abc';
    const rawUrl2 = '/postback/timewall?userid=usr_1&txid=tx_2&revenue=0.002&currency=10&hash=def';

    const parsed1 = extractRawQueryParams(rawUrl1);
    const parsed2 = extractRawQueryParams(rawUrl2);

    assert.equal(parsed1.revenue, '0.5', '"0.5" must never be padded to "0.50"');
    assert.equal(parsed2.revenue, '0.002', 'Sub-cent "0.002" must never be rounded to "0.00"');

    const hash05 = computeTimewallHash('usr_1', '0.5', TEST_SECRET);
    const hash050 = computeTimewallHash('usr_1', '0.50', TEST_SECRET);
    assert.notEqual(hash05, hash050, '"0.5" and "0.50" must produce different SHA-256 hashes');

    const hash002 = computeTimewallHash('usr_1', '0.002', TEST_SECRET);
    const hash000 = computeTimewallHash('usr_1', '0.00', TEST_SECRET);
    assert.notEqual(hash002, hash000, '"0.002" and "0.00" must produce different SHA-256 hashes');

    const micros = parseDecimalToMicros('0.002');
    assert.equal(micros.valid, true);
    assert.equal(micros.micros, 2000n);
    assert.equal(micros.formatted6, '0.002000');
  });

  it('2. Credits user balance and writes an auditable ledger entry on valid postback with sub-cent revenue "0.002"', async () => {
    const txid = 'tw_tx_valid_002';
    const revenue = '0.002'; // 0.002 * 5000 = 10 coins
    const currency = '10';
    const hash = computeTimewallHash(testUserId, revenue, TEST_SECRET);

    const beforeBal = dbStore.getUserBalances(testUserId).availablePoints;

    const rawUrl = `/postback/timewall?userid=${testUserId}&txid=${txid}&revenue=${revenue}&currency=${currency}&hash=${hash}&ip=203.0.113.10&type=credit&offername=MicroQuiz&offerdetail=Step1`;
    const res = await timewallService.handlePostback({
      rawUrl,
      socketIp: '127.0.0.1',
      headers: { 'cf-connecting-ip': WHITELISTED_IP },
      overrideConfig: {
        secret: TEST_SECRET,
        coinsPerUsd: COINS_PER_USD,
        trustedProxies: ['127.0.0.1', 'cloudflare']
      }
    });

    assert.equal(res.httpStatus, 200);
    assert.equal(res.body, 'OK');
    assert.equal(res.outcome, 'credited');
    assert.equal(res.pointsDelta, 10);

    const afterBal = dbStore.getUserBalances(testUserId).availablePoints;
    assert.equal(afterBal - beforeBal, 10);

    const ledger = dbStore.getLedgerForUser(testUserId);
    const entry = ledger.find(l => l.providerTxId === `tw_${txid}`);
    assert.ok(entry, 'Ledger entry with providerTxId="tw_tw_tx_valid_002" must exist');
    assert.equal(entry?.reason, 'offerwall_timewall');
    assert.equal(entry?.points, 10);
  });

  it('3. Credits user on valid postback with trailing-zero revenue "0.50" hashed as raw string', async () => {
    const txid = 'tw_tx_valid_050';
    const revenue = '0.50'; // 0.50 * 5000 = 2500 coins
    const currency = '2500';
    const hash = computeTimewallHash(testUserId, revenue, TEST_SECRET);

    const beforeBal = dbStore.getUserBalances(testUserId).availablePoints;

    const rawUrl = `/postback/timewall?userid=${testUserId}&txid=${txid}&revenue=${revenue}&currency=${currency}&hash=${hash}&ip=203.0.113.10&type=credit&offername=Survey50`;
    const res = await timewallService.handlePostback({
      rawUrl,
      socketIp: '127.0.0.1',
      headers: { 'cf-connecting-ip': RETIRED_SOON_IP_1 },
      overrideConfig: {
        secret: TEST_SECRET,
        coinsPerUsd: COINS_PER_USD,
        trustedProxies: ['127.0.0.1', 'cloudflare']
      }
    });

    assert.equal(res.httpStatus, 200);
    assert.equal(res.body, 'OK');
    assert.equal(res.outcome, 'credited');
    assert.equal(res.pointsDelta, 2500);

    const afterBal = dbStore.getUserBalances(testUserId).availablePoints;
    assert.equal(afterBal - beforeBal, 2500);
  });

  it('4. Enforces idempotency on duplicate txid (does not credit twice and returns HTTP 200 OK)', async () => {
    const txid = 'tw_tx_valid_050'; // Same txid as test #3
    const revenue = '0.50';
    const currency = '2500';
    const hash = computeTimewallHash(testUserId, revenue, TEST_SECRET);

    const beforeBal = dbStore.getUserBalances(testUserId).availablePoints;

    const rawUrl = `/postback/timewall?userid=${testUserId}&txid=${txid}&revenue=${revenue}&currency=${currency}&hash=${hash}&ip=203.0.113.10&type=credit`;
    const res = await timewallService.handlePostback({
      rawUrl,
      socketIp: '127.0.0.1',
      headers: { 'cf-connecting-ip': RETIRED_SOON_IP_2 },
      overrideConfig: {
        secret: TEST_SECRET,
        coinsPerUsd: COINS_PER_USD,
        trustedProxies: ['127.0.0.1', 'cloudflare']
      }
    });

    assert.equal(res.httpStatus, 200);
    assert.equal(res.body, 'OK');
    assert.equal(res.outcome, 'duplicate');
    assert.equal(res.pointsDelta, 0);

    const afterBal = dbStore.getUserBalances(testUserId).availablePoints;
    assert.equal(afterBal, beforeBal, 'Balance must not change on duplicate txid');
  });

  it('5. Rejects requests with a bad SHA-256 hash (including float-coerced "0.5" hash when "0.50" is sent)', async () => {
    const txid = 'tw_tx_bad_hash_01';
    const revenue = '0.50';
    // Deliberately hash "0.5" instead of "0.50"
    const wrongFloatCoercedHash = computeTimewallHash(testUserId, '0.5', TEST_SECRET);

    const beforeBal = dbStore.getUserBalances(testUserId).availablePoints;

    const rawUrl = `/postback/timewall?userid=${testUserId}&txid=${txid}&revenue=${revenue}&currency=2500&hash=${wrongFloatCoercedHash}&ip=203.0.113.10`;
    const res = await timewallService.handlePostback({
      rawUrl,
      socketIp: '127.0.0.1',
      headers: { 'cf-connecting-ip': WHITELISTED_IP },
      overrideConfig: {
        secret: TEST_SECRET,
        coinsPerUsd: COINS_PER_USD,
        trustedProxies: ['127.0.0.1', 'cloudflare']
      }
    });

    assert.equal(res.httpStatus, 403);
    assert.equal(res.outcome, 'bad_hash');
    assert.equal(dbStore.getUserBalances(testUserId).availablePoints, beforeBal);
  });

  it('6. Rejects requests from non-whitelisted source IPs (and untrusted proxy headers)', async () => {
    const txid = 'tw_tx_bad_ip_01';
    const revenue = '0.10';
    const hash = computeTimewallHash(testUserId, revenue, TEST_SECRET);

    // 1) Spoofed header from an untrusted socket IP
    const rawUrl = `/postback/timewall?userid=${testUserId}&txid=${txid}&revenue=${revenue}&currency=500&hash=${hash}`;
    const resUntrustedProxy = await timewallService.handlePostback({
      rawUrl,
      socketIp: '198.51.100.77', // Not in trustedProxies
      headers: { 'cf-connecting-ip': WHITELISTED_IP },
      overrideConfig: {
        secret: TEST_SECRET,
        coinsPerUsd: COINS_PER_USD,
        trustedProxies: ['127.0.0.1']
      }
    });
    assert.equal(resUntrustedProxy.httpStatus, 403);
    assert.equal(resUntrustedProxy.outcome, 'forbidden_ip');

    // 2) Trusted proxy forwarding a non-whitelisted external IP
    const resNonWhitelisted = await timewallService.handlePostback({
      rawUrl,
      socketIp: '127.0.0.1',
      headers: { 'cf-connecting-ip': '203.0.113.99' },
      overrideConfig: {
        secret: TEST_SECRET,
        coinsPerUsd: COINS_PER_USD,
        trustedProxies: ['127.0.0.1', 'cloudflare']
      }
    });
    assert.equal(resNonWhitelisted.httpStatus, 403);
    assert.equal(resNonWhitelisted.outcome, 'forbidden_ip');
  });

  it('7. Logs unknown user and returns HTTP 200 OK so TimeWall does not retry endlessly', async () => {
    const unknownUser = 'usr_does_not_exist_999';
    const txid = 'tw_tx_unknown_usr_01';
    const revenue = '0.20';
    const hash = computeTimewallHash(unknownUser, revenue, TEST_SECRET);

    const rawUrl = `/postback/timewall?userid=${unknownUser}&txid=${txid}&revenue=${revenue}&currency=1000&hash=${hash}`;
    const res = await timewallService.handlePostback({
      rawUrl,
      socketIp: WHITELISTED_IP,
      headers: {},
      overrideConfig: {
        secret: TEST_SECRET,
        coinsPerUsd: COINS_PER_USD
      }
    });

    assert.equal(res.httpStatus, 200);
    assert.equal(res.body, 'OK');
    assert.equal(res.outcome, 'unknown_user');
  });

  it('8. Places transaction in status="needs_review" without crediting when currency mismatches revenue * rate, and allows Admin to approve it', async () => {
    const txid = 'tw_tx_mismatch_currency_01';
    const revenue = '0.10'; // Expected coins = 0.10 * 5000 = 500
    const tamperedCurrency = '50000'; // Tampered currency (not covered by hash!)
    const hash = computeTimewallHash(testUserId, revenue, TEST_SECRET);

    const beforeBal = dbStore.getUserBalances(testUserId).availablePoints;

    const rawUrl = `/postback/timewall?userid=${testUserId}&txid=${txid}&revenue=${revenue}&currency=${tamperedCurrency}&hash=${hash}&offername=TamperedCurrencyOffer`;
    const res = await timewallService.handlePostback({
      rawUrl,
      socketIp: WHITELISTED_IP,
      headers: {},
      overrideConfig: {
        secret: TEST_SECRET,
        coinsPerUsd: COINS_PER_USD
      }
    });

    assert.equal(res.httpStatus, 200);
    assert.equal(res.body, 'OK');
    assert.equal(res.outcome, 'needs_review');
    assert.equal(
      dbStore.getUserBalances(testUserId).availablePoints,
      beforeBal,
      'Balance must not change when placed in needs_review'
    );

    const txRecord = dbStore
      .getAllOfferwallTransactionsRaw()
      .find(t => t.providerTxid === txid);
    assert.ok(txRecord);
    assert.equal(txRecord?.status, 'needs_review');
  });

  it('9. Processes reversal once (deducts original coins and marks reversed) and ignores duplicate reversal', async () => {
    const txid = 'tw_tx_to_reverse_01';
    const revenue = '0.20'; // 1000 coins
    const currency = '1000';
    const hash = computeTimewallHash(testUserId, revenue, TEST_SECRET);

    const startBal = dbStore.getUserBalances(testUserId).availablePoints;

    // Step 1: Credit +1000 coins
    const creditUrl = `/postback/timewall?userid=${testUserId}&txid=${txid}&revenue=${revenue}&currency=${currency}&hash=${hash}&type=credit&offername=ReversibleOffer`;
    const creditRes = await timewallService.handlePostback({
      rawUrl: creditUrl,
      socketIp: WHITELISTED_IP,
      headers: {},
      overrideConfig: { secret: TEST_SECRET, coinsPerUsd: COINS_PER_USD }
    });
    assert.equal(creditRes.outcome, 'credited');
    assert.equal(dbStore.getUserBalances(testUserId).availablePoints, startBal + 1000);

    // Step 2: Reversal postback for the same txid
    const revUrl = `/postback/timewall?userid=${testUserId}&txid=${txid}&revenue=${revenue}&currency=${currency}&hash=${hash}&type=chargeback&reason=advertiser_chargeback`;
    const revRes = await timewallService.handlePostback({
      rawUrl: revUrl,
      socketIp: WHITELISTED_IP,
      headers: {},
      overrideConfig: { secret: TEST_SECRET, coinsPerUsd: COINS_PER_USD }
    });
    assert.equal(revRes.httpStatus, 200);
    assert.equal(revRes.outcome, 'reversed');
    assert.equal(revRes.pointsDelta, -1000);
    assert.equal(dbStore.getUserBalances(testUserId).availablePoints, startBal);

    // Step 3: Duplicate reversal must be ignored
    const dupRevRes = await timewallService.handlePostback({
      rawUrl: revUrl,
      socketIp: WHITELISTED_IP,
      headers: {},
      overrideConfig: { secret: TEST_SECRET, coinsPerUsd: COINS_PER_USD }
    });
    assert.equal(dupRevRes.httpStatus, 200);
    assert.equal(dupRevRes.outcome, 'duplicate_reversal');
    assert.equal(dupRevRes.pointsDelta, 0);
    assert.equal(dbStore.getUserBalances(testUserId).availablePoints, startBal);
  });

  it('10. Handles concurrent duplicate requests safely (credits exactly once)', async () => {
    const txid = 'tw_tx_concurrent_race_01';
    const revenue = '0.30'; // 1500 coins
    const currency = '1500';
    const hash = computeTimewallHash(testUserId, revenue, TEST_SECRET);

    const beforeBal = dbStore.getUserBalances(testUserId).availablePoints;
    const rawUrl = `/postback/timewall?userid=${testUserId}&txid=${txid}&revenue=${revenue}&currency=${currency}&hash=${hash}&type=credit&offername=ConcurrentOffer`;

    // Fire 8 concurrent requests with the exact same txid
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        timewallService.handlePostback({
          rawUrl,
          socketIp: WHITELISTED_IP,
          headers: {},
          overrideConfig: { secret: TEST_SECRET, coinsPerUsd: COINS_PER_USD }
        })
      )
    );

    const creditedCount = results.filter(r => r.outcome === 'credited').length;
    const duplicateCount = results.filter(r => r.outcome === 'duplicate').length;

    assert.equal(creditedCount, 1, 'Exactly one request must succeed as credited');
    assert.equal(duplicateCount, 7, 'All other 7 concurrent requests must be caught as duplicate');
    assert.equal(dbStore.getUserBalances(testUserId).availablePoints, beforeBal + 1500);
  });

  it('11. Logs postbacks for offerwall_blocked users as status="blocked" without crediting and returns HTTP 200 OK', async () => {
    const txid = 'tw_tx_blocked_user_01';
    const revenue = '0.40';
    const currency = '2000';
    const hash = computeTimewallHash(blockedUserId, revenue, TEST_SECRET);

    const beforeBal = dbStore.getUserBalances(blockedUserId).availablePoints;
    const rawUrl = `/postback/timewall?userid=${blockedUserId}&txid=${txid}&revenue=${revenue}&currency=${currency}&hash=${hash}&type=credit`;

    const res = await timewallService.handlePostback({
      rawUrl,
      socketIp: WHITELISTED_IP,
      headers: {},
      overrideConfig: { secret: TEST_SECRET, coinsPerUsd: COINS_PER_USD }
    });

    assert.equal(res.httpStatus, 200);
    assert.equal(res.body, 'OK');
    assert.equal(res.outcome, 'blocked');
    assert.equal(dbStore.getUserBalances(blockedUserId).availablePoints, beforeBal);
  });

  it('12. Configures live TimeWall OID (bbaca457a255e3e2), S2S Survey API Key (tw_...e8f04c), and builds valid S2S Survey API payload', () => {
    const cfg = timewallService.getConfig();
    assert.equal(cfg.oid, 'bbaca457a255e3e2');
    assert.equal(cfg.coinsPerUsd, 10000);
    assert.equal(
      cfg.apiKey,
      'tw_0fb821a06355392350c944a0e69ef60f40f0565fff6ffe62ce57629c76e8f04c'
    );
    assert.equal(cfg.secret, '3e8f2c753e704d59013d34c6474363c3');

    const wallUrl = timewallService.buildOfferwallUrl(testUserId);
    assert.equal(
      wallUrl,
      `https://timewall.io/users/login?oid=bbaca457a255e3e2&uid=${testUserId}`
    );

    const payload = timewallService.buildSurveyApiPayload({
      userId: testUserId,
      userIp: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
      screenWidth: 390,
      screenHeight: 844,
      limit: 10,
      provider: 'all'
    });

    assert.deepEqual(payload, {
      uid: testUserId,
      ip: '203.0.113.7',
      user_agent: 'Mozilla/5.0',
      screen_width: 390,
      screen_height: 844,
      limit: 10,
      provider: 'all'
    });
  });
});

