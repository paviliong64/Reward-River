import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCpxSecureHash,
  generateCpxTransactionHash,
  verifyCpxPostbackSignature,
  buildCpxSurveyUrl,
  normalizeCpxSurveyList,
  normalizeCpxPostbackGrossCents
} from './cpx';
import { generateCpxSecureHashBrowser, normalizeBrowserCpxSurveys } from './cpxClient';
import { calculateHybridSurveySplit } from './usdt';

test('generateCpxSecureHash: computes MD5(ext_user_id + "-" + hash_key) accurately and matches browser implementation', () => {
  const userId = 'usr_998124';
  const hashKey = '1u8hIFGwUYYORM76NM76PDxenCC50bCZ';
  const hash = generateCpxSecureHash(userId, hashKey);
  const browserHash = generateCpxSecureHashBrowser(userId, hashKey);
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 32);
  assert.equal(browserHash, hash);
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
    appId: '37699',
    extUserId: 'usr_test_1',
    hashKey: '1u8hIFGwUYYORM76NM76PDxenCC50bCZ',
    surveyId: 'survey_abc',
    subId1: 'web_campaign',
    mainColor: '0284c7'
  });

  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'oul.cpx-research.com');
  assert.equal(parsed.searchParams.get('app_id'), '37699');
  assert.equal(parsed.searchParams.get('ext_user_id'), 'usr_test_1');
  assert.equal(parsed.searchParams.get('survey_id'), 'survey_abc');
  assert.equal(parsed.searchParams.get('subid_1'), 'web_campaign');
  assert.equal(parsed.searchParams.get('main_color'), '0284c7');
  assert.equal(parsed.searchParams.has('secure_hash'), true);
});

test('normalizeCpxSurveyList: parses raw CPX API payload into normalized survey models without inflating points', () => {
  const rawApiPayload = {
    status: 'success',
    count_all_surveys: 3,
    surveys: [
      {
        id: '81362803',
        loi: 2,
        payout: '22800.00',
        payout_publisher_usd: 2.28,
        conversion_rate: '77.44',
        statistics_rating_avg: 4,
        statistics_rating_count: 30,
        top: 1,
        category: 'General',
        href: 'https://click.cpx-research.com/?k=test1'
      },
      {
        id: '81366670',
        loi: 3,
        payout: '4600.00',
        payout_publisher_usd: 0.46,
        statistics_rating_avg: 0,
        statistics_rating_count: 0,
        top: 0,
        category: 'General'
      },
      {
        id: '54321',
        loi: 5,
        payout: 0.60,
        cpi: 0.60,
        statistics_rating_avg: 4.2,
        statistics_rating_count: 12,
        top: 0
      }
    ]
  };

  const normalized = normalizeCpxSurveyList(rawApiPayload, '37699', 'usr_test_1', '1u8hIFGwUYYORM76NM76PDxenCC50bCZ');
  assert.equal(normalized.length, 3);

  // Survey 1: $2.28 gross -> 228 cents -> 22,800 Points & $0.91 USDT user share at 40%
  assert.equal(normalized[0].id, '81362803');
  assert.equal(normalized[0].loiMinutes, 2);
  assert.equal(normalized[0].rewardCents, 228);
  assert.equal(normalized[0].rewardUsdFormatted, '$2.28');
  assert.equal(normalized[0].ratingCount, 30);
  assert.equal(normalized[0].ratingAvg, 4);
  assert.equal(normalized[0].isTop, true);
  const split0 = calculateHybridSurveySplit(normalized[0].rewardCents, 40, 10000);
  assert.equal(split0.userRewardPoints, 22800);
  assert.equal(split0.userRewardPointsFormatted, '22,800');
  assert.equal(split0.userRewardCents, 91);

  // Survey 2: $0.46 gross -> 46 cents -> 4,600 Points & 0 Ratings preserved (never fabricated)
  assert.equal(normalized[1].id, '81366670');
  assert.equal(normalized[1].rewardCents, 46);
  assert.equal(normalized[1].ratingCount, 0);
  assert.equal(normalized[1].ratingAvg, 0);

  // Survey 3: $0.60 gross -> 60 cents
  assert.equal(normalized[2].id, '54321');
  assert.equal(normalized[2].rewardCents, 60);
  assert.equal(normalized[2].ratingCount, 12);

  // Verify browser normalizer produces identical split
  const browserSurveys = normalizeBrowserCpxSurveys(rawApiPayload.surveys, {
    appId: '37699',
    extUserId: 'usr_test_1',
    userSharePercent: 40,
    pointsPerUsdt: 10000
  });
  assert.equal(browserSurveys[0].rewardPoints, 22800);
  assert.equal(browserSurveys[0].rewardCents, 91);
  assert.equal(browserSurveys[1].ratingCount, 0);
});

test('normalizeCpxPostbackGrossCents: normalizes both USD and local points accurately', () => {
  assert.equal(normalizeCpxPostbackGrossCents('2.28', '22800.00', 10000), 228);
  assert.equal(normalizeCpxPostbackGrossCents(undefined, '22800.00', 10000), 228);
  assert.equal(normalizeCpxPostbackGrossCents('1.45', undefined, 10000), 145);
});

