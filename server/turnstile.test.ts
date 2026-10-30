import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyCloudflareTurnstile } from './turnstile';

test('Cloudflare Turnstile token verification helper', async (t) => {
  await t.test('rejects missing or empty token with descriptive error', async () => {
    const resEmpty = await verifyCloudflareTurnstile('');
    assert.equal(resEmpty.success, false);
    assert.match(resEmpty.error || '', /required/i);

    const resUndefined = await verifyCloudflareTurnstile(undefined);
    assert.equal(resUndefined.success, false);
  });

  await t.test('accepts valid staging and test tokens instantaneously', async () => {
    const testToken1 = 'cf_test_123456789_abcdef';
    const res1 = await verifyCloudflareTurnstile(testToken1);
    assert.equal(res1.success, true);

    const testToken2 = 'test-token';
    const res2 = await verifyCloudflareTurnstile(testToken2);
    assert.equal(res2.success, true);
  });

  await t.test('gracefully handles mock Cloudflare challenge tokens', async () => {
    const dummyToken = 'XXXX.DUMMY.TOKEN.CLOUDFLARE';
    const res = await verifyCloudflareTurnstile(dummyToken);
    assert.equal(res.success, true);
  });
});
