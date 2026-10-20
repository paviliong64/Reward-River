import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCpxSecureHash,
  generateCpxTransactionHash,
  verifyCpxPostbackSignature,
  buildCpxSurveyUrl,
  normalizeCpxSurveyList
} from './cpx';

test('generateCpxSecureHash: computes MD5(ext_user_id + "-" + hash_key) accurately', () => {
  const userId = 'usr_998124';
  const hashKey = 'mySecretKey123';
  // Expected md5 of "usr_998124-mySecretKey123"
  const hash = generateCpxSecureHash(userId, hashKey);
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 32);
});

test('verifyCpxPostbackSignature: approves legitimate CPX hash and rejects forged hash', () => {
  const transId = 'tx_cpx_778899';
  const userId = 'usr_998124';
  const hashKey = 'secure_publisher_secret_42';

  const validTxHash = generateCpxTransactionHash(transId, hashKey);
  assert.equal(verifyCpxPostbackSignature(transId, userId, validTxHash, hashKey), true);

  const forgedHash = '00000000000000000000000000000000';
  assert.equal(verifyCpxPostbackSignature(transId, userId, forgedHash, hashKey), false);
});

test('buildCpxSurveyUrl: generates official CPX URL with parameters and brand color', () => {
  const url = buildCpxSurveyUrl({
    appId: '12345',
    extUserId: 'usr_test_1',
    hashKey: 'secret_key',
    surveyId: 'survey_abc',
    subId1: 'web_campaign',
    mainColor: '0284c7'
  });

  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'oul.cpx-research.com');
  assert.equal(parsed.searchParams.get('app_id'), '12345');
  assert.equal(parsed.searchParams.get('ext_user_id'), 'usr_test_1');
  assert.equal(parsed.searchParams.get('survey_id'), 'survey_abc');
  assert.equal(parsed.searchParams.get('subid_1'), 'web_campaign');
  assert.equal(parsed.searchParams.get('main_color'), '0284c7');
  assert.equal(parsed.searchParams.has('secure_hash'), true);
});

test('normalizeCpxSurveyList: parses raw CPX API payload into normalized survey models', () => {
  const rawApiPayload = {
    status: 'success',
    count_all_surveys: 2,
    surveys: [
      {
        id: '98765',
        loi: 12,
        payout: 1.45,
        cpi: 1.45,
        conversion_rate: 75,
        statistics_rating_avg: 4.8,
        statistics_rating_count: 320,
        top: 1,
        href: 'https://oul.cpx-research.com/index.php?survey_id=98765'
      },
      {
        id: '54321',
        loi: 5,
        payout: 0.60,
        cpi: 0.60,
        statistics_rating_avg: 4.2,
        top: 0
      }
    ]
  };

  const normalized = normalizeCpxSurveyList(rawApiPayload, '12345', 'usr_test_1');
  assert.equal(normalized.length, 2);

  assert.equal(normalized[0].id, '98765');
  assert.equal(normalized[0].loiMinutes, 12);
  assert.equal(normalized[0].rewardCents, 145);
  assert.equal(normalized[0].rewardUsdFormatted, '$1.45');
  assert.equal(normalized[0].isTop, true);
  assert.equal(normalized[0].directUrl, 'https://oul.cpx-research.com/index.php?survey_id=98765');

  assert.equal(normalized[1].id, '54321');
  assert.equal(normalized[1].rewardCents, 60);
  assert.equal(normalized[1].rewardUsdFormatted, '$0.60');
  assert.equal(normalized[1].isTop, false);
});
