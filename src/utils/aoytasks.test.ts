import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeAoySubId,
  generateAoyPostbackSignature,
  verifyAoyPostbackSignature,
  sanitizeWhiteLabelText,
  normalizeAoyPtcList,
  normalizeAoyShortlinkList
} from './aoytasks';

test('sanitizeAoySubId: strips non-alphanumeric characters to satisfy AoyTasks strict rule', () => {
  assert.equal(sanitizeAoySubId('usr_123-abc_XYZ!'), 'usr123abcXYZ');
  assert.equal(sanitizeAoySubId('rr_cpx_998877'), 'rrcpx998877');
});

test('generateAoyPostbackSignature & verifyAoyPostbackSignature: matches md5(subId + transId + reward + secret)', () => {
  const subId = 'usr12345';
  const transId = '3fe2905e';
  const reward = '10000.00';
  const secret = 'my_super_secret_key';

  const sig = generateAoyPostbackSignature(subId, transId, reward, secret);
  assert.equal(verifyAoyPostbackSignature(subId, transId, reward, secret, sig), true);
  assert.equal(verifyAoyPostbackSignature(subId, transId, reward, secret, 'forged_sig'), false);
});

test('sanitizeWhiteLabelText: removes any external AoyTasks / aoyco.in references for white-label display', () => {
  assert.equal(
    sanitizeWhiteLabelText('Complete this AoyTasks offer on aoyco.in', 'Fallback'),
    'Complete this Reward River offer on Reward River'
  );
});

test('normalizeAoyPtcList & normalizeAoyShortlinkList: applies 40% user share and white-label branding', () => {
  const ptcItems = normalizeAoyPtcList(
    [
      {
        id: 41,
        title: 'AoyTasks Sponsored Crypto Portal',
        description: 'Visit aoyco.in partner page',
        duration: 15,
        reward: '10000.00', // $1.00 gross at 10,000 exchange rate
        url: 'https://aoyco.in/offer/ptc/go/xyz',
        ad_type: 'Iframe'
      }
    ],
    { userSharePercent: 40, pointsPerUsdt: 10000, exchangeRatePerUsd: 10000 }
  );

  assert.equal(ptcItems.length, 1);
  assert.equal(ptcItems[0].title.includes('AoyTasks'), false);
  assert.equal(ptcItems[0].title, 'Reward River Sponsored Crypto Portal');
  assert.equal(ptcItems[0].rewardPoints, 10000);
  // 40% of $1.00 = 40 cents ($0.40 USDT) visible to user
  assert.equal(ptcItems[0].rewardCents, 40);
  assert.equal(ptcItems[0].rewardUsdtFormatted, '0.40');

  const slItems = normalizeAoyShortlinkList(
    [
      {
        id: 7,
        title: 'AOY Express Link #1',
        reward: '5000.00', // $0.50 gross
        available: '3',
        limit: '3',
        url: 'https://aoyco.in/offer/link/go/abc'
      }
    ],
    { userSharePercent: 40, pointsPerUsdt: 10000, exchangeRatePerUsd: 10000 }
  );

  assert.equal(slItems.length, 1);
  assert.equal(slItems[0].title, 'Reward River Express Link #1');
  assert.equal(slItems[0].rewardPoints, 5000);
  assert.equal(slItems[0].rewardCents, 20); // 40% of $0.50 = $0.20 USDT
});
