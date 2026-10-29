import { Survey } from '../types';
import { calculateHybridSurveySplit } from './usdt';

/**
 * Pure TypeScript RFC 1321 MD5 implementation for browser-side CPX secure_hash generation.
 * Matches Node createHash('md5').update(`${extUserId}-${hashKey}`).digest('hex') bit-for-bit.
 */
export function md5Hex(input: string): string {
  function rotateLeft(lValue: number, iShiftBits: number): number {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }

  function addUnsigned(lX: number, lY: number): number {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return lResult ^ lX8 ^ lY8;
  }

  function f(x: number, y: number, z: number) { return (x & y) | (~x & z); }
  function g(x: number, y: number, z: number) { return (x & z) | (y & ~z); }
  function h(x: number, y: number, z: number) { return x ^ y ^ z; }
  function i(x: number, y: number, z: number) { return y ^ (x | ~z); }

  function ff(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  const utf8Bytes = new TextEncoder().encode(input);
  const lByteLength = utf8Bytes.length;
  const lNumberOfWordsTemp1 = lByteLength + 8;
  const lNumberOfWordsTemp2 = (lNumberOfWordsTemp1 - (lNumberOfWordsTemp1 % 64)) / 64;
  const lNumberOfWords = (lNumberOfWordsTemp2 + 1) * 16;
  const lWordArray = new Array<number>(lNumberOfWords).fill(0);

  let lBytePosition = 0;
  let lByteCount = 0;
  while (lByteCount < lByteLength) {
    const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (utf8Bytes[lByteCount] << lBytePosition);
    lByteCount++;
  }
  const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
  lBytePosition = (lByteCount % 4) * 8;
  lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
  lWordArray[lNumberOfWords - 2] = lByteLength << 3;
  lWordArray[lNumberOfWords - 1] = lByteLength >>> 29;

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let k = 0; k < lWordArray.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = ff(a, b, c, d, lWordArray[k + 0], 7, 0xd76aa478);
    d = ff(d, a, b, c, lWordArray[k + 1], 12, 0xe8c7b756);
    c = ff(c, d, a, b, lWordArray[k + 2], 17, 0x242070db);
    b = ff(b, c, d, a, lWordArray[k + 3], 22, 0xc1bdceee);
    a = ff(a, b, c, d, lWordArray[k + 4], 7, 0xf57c0faf);
    d = ff(d, a, b, c, lWordArray[k + 5], 12, 0x4787c62a);
    c = ff(c, d, a, b, lWordArray[k + 6], 17, 0xa8304613);
    b = ff(b, c, d, a, lWordArray[k + 7], 22, 0xfd469501);
    a = ff(a, b, c, d, lWordArray[k + 8], 7, 0x698098d8);
    d = ff(d, a, b, c, lWordArray[k + 9], 12, 0x8b44f7af);
    c = ff(c, d, a, b, lWordArray[k + 10], 17, 0xffff5bb1);
    b = ff(b, c, d, a, lWordArray[k + 11], 22, 0x895cd7be);
    a = ff(a, b, c, d, lWordArray[k + 12], 7, 0x6b901122);
    d = ff(d, a, b, c, lWordArray[k + 13], 12, 0xfd987193);
    c = ff(c, d, a, b, lWordArray[k + 14], 17, 0xa679438e);
    b = ff(b, c, d, a, lWordArray[k + 15], 22, 0x49b40821);
    a = gg(a, b, c, d, lWordArray[k + 1], 5, 0xf61e2562);
    d = gg(d, a, b, c, lWordArray[k + 6], 9, 0xc040b340);
    c = gg(c, d, a, b, lWordArray[k + 11], 14, 0x265e5a51);
    b = gg(b, c, d, a, lWordArray[k + 0], 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, lWordArray[k + 5], 5, 0xd62f105d);
    d = gg(d, a, b, c, lWordArray[k + 10], 9, 0x02441453);
    c = gg(c, d, a, b, lWordArray[k + 15], 14, 0xd8a1e681);
    b = gg(b, c, d, a, lWordArray[k + 4], 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, lWordArray[k + 9], 5, 0x21e1cde6);
    d = gg(d, a, b, c, lWordArray[k + 14], 9, 0xc33707d6);
    c = gg(c, d, a, b, lWordArray[k + 3], 14, 0xf4d50d87);
    b = gg(b, c, d, a, lWordArray[k + 8], 20, 0x455a14ed);
    a = gg(a, b, c, d, lWordArray[k + 13], 5, 0xa9e3e905);
    d = gg(d, a, b, c, lWordArray[k + 2], 9, 0xfcefa3f8);
    c = gg(c, d, a, b, lWordArray[k + 7], 14, 0x676f02d9);
    b = gg(b, c, d, a, lWordArray[k + 12], 20, 0x8d2a4c8a);
    a = hh(a, b, c, d, lWordArray[k + 5], 4, 0xfffa3942);
    d = hh(d, a, b, c, lWordArray[k + 8], 11, 0x8771f681);
    c = hh(c, d, a, b, lWordArray[k + 11], 16, 0x6d9d6122);
    b = hh(b, c, d, a, lWordArray[k + 14], 23, 0xfde5380c);
    a = hh(a, b, c, d, lWordArray[k + 1], 4, 0xa4beea44);
    d = hh(d, a, b, c, lWordArray[k + 4], 11, 0x4bdecfa9);
    c = hh(c, d, a, b, lWordArray[k + 7], 16, 0xf6bb4b60);
    b = hh(b, c, d, a, lWordArray[k + 10], 23, 0xbebfbc70);
    a = hh(a, b, c, d, lWordArray[k + 13], 4, 0x289b7ec6);
    d = hh(d, a, b, c, lWordArray[k + 0], 11, 0xeaa127fa);
    c = hh(c, d, a, b, lWordArray[k + 3], 16, 0xd4ef3085);
    b = hh(b, c, d, a, lWordArray[k + 6], 23, 0x04881d05);
    a = hh(a, b, c, d, lWordArray[k + 9], 4, 0xd9d4d039);
    d = hh(d, a, b, c, lWordArray[k + 12], 11, 0xe6db99e5);
    c = hh(c, d, a, b, lWordArray[k + 15], 16, 0x1fa27cf8);
    b = hh(b, c, d, a, lWordArray[k + 2], 23, 0xc4ac5665);
    a = ii(a, b, c, d, lWordArray[k + 0], 6, 0xf4292244);
    d = ii(d, a, b, c, lWordArray[k + 7], 10, 0x432aff97);
    c = ii(c, d, a, b, lWordArray[k + 14], 15, 0xab9423a7);
    b = ii(b, c, d, a, lWordArray[k + 5], 21, 0xfc93a039);
    a = ii(a, b, c, d, lWordArray[k + 12], 6, 0x655b59c3);
    d = ii(d, a, b, c, lWordArray[k + 3], 10, 0x8f0ccc92);
    c = ii(c, d, a, b, lWordArray[k + 10], 15, 0xffeff47d);
    b = ii(b, c, d, a, lWordArray[k + 1], 21, 0x85845dd1);
    a = ii(a, b, c, d, lWordArray[k + 8], 6, 0x6fa87e4f);
    d = ii(d, a, b, c, lWordArray[k + 15], 10, 0xfe2ce6e0);
    c = ii(c, d, a, b, lWordArray[k + 6], 15, 0xa3014314);
    b = ii(b, c, d, a, lWordArray[k + 13], 21, 0x4e0811a1);
    a = ii(a, b, c, d, lWordArray[k + 4], 6, 0xf7537e82);
    d = ii(d, a, b, c, lWordArray[k + 11], 10, 0xbd3af235);
    c = ii(c, d, a, b, lWordArray[k + 2], 15, 0x2ad7d2bb);
    b = ii(b, c, d, a, lWordArray[k + 9], 21, 0xeb86d391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  function wordToHex(lValue: number): string {
    let out = '';
    for (let lCount = 0; lCount <= 3; lCount++) {
      const lByte = (lValue >>> (lCount * 8)) & 255;
      const hex = '0' + lByte.toString(16);
      out += hex.substring(hex.length - 2);
    }
    return out;
  }

  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

export function generateCpxSecureHashBrowser(extUserId: string, hashKey: string): string {
  if (!extUserId || !hashKey) return '';
  return md5Hex(`${extUserId}-${hashKey}`);
}

export function normalizeBrowserCpxSurveys(
  rawList: any[],
  params: {
    appId: string;
    extUserId: string;
    secureHash?: string;
    userSharePercent?: number;
    pointsPerUsdt?: number;
  }
): Survey[] {
  if (!Array.isArray(rawList)) return [];
  const { appId, extUserId, secureHash = '', userSharePercent = 50, pointsPerUsdt = 5000 } = params;
  const safeFactor = pointsPerUsdt > 0 ? pointsPerUsdt : 5000;

  const result: Survey[] = [];
  for (const raw of rawList) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || '').trim();
    if (!id) continue;

    const loiMinutes = Math.max(1, Math.min(60, Number(raw.loi) || 10));
    const publisherUsd =
      raw.payout_publisher_usd !== undefined && raw.payout_publisher_usd !== null && raw.payout_publisher_usd !== ''
        ? Number(raw.payout_publisher_usd)
        : NaN;
    const rawCpi =
      raw.cpi !== undefined && raw.cpi !== null && raw.cpi !== ''
        ? Number(raw.cpi)
        : NaN;
    const rawPayoutNum = Number(raw.payout ?? raw.cpi) || 0;

    let grossCents = 10;
    if (!isNaN(publisherUsd) && publisherUsd > 0) {
      grossCents = Math.max(1, Math.round(publisherUsd * 100));
    } else if (!isNaN(rawCpi) && rawCpi > 0 && rawCpi <= 50) {
      grossCents = Math.max(1, Math.round(rawCpi * 100));
    } else if (rawPayoutNum > 50) {
      grossCents = Math.max(1, Math.round((rawPayoutNum / safeFactor) * 100));
    } else if (rawPayoutNum > 0) {
      grossCents = Math.max(1, Math.round(rawPayoutNum * 100));
    }

    const split = calculateHybridSurveySplit(grossCents, userSharePercent, safeFactor);
    const exactPoints =
      rawPayoutNum > 50 && (isNaN(publisherUsd) || publisherUsd <= 0)
        ? Math.round(rawPayoutNum)
        : split.userRewardPoints;
    const ratingCount = Math.max(0, Math.floor(Number(raw.statistics_rating_count) || 0));
    const rawRatingAvg = Number(raw.statistics_rating_avg);
    const ratingAvg = !isNaN(rawRatingAvg) && rawRatingAvg > 0
      ? Math.max(1, Math.min(5, rawRatingAvg))
      : ratingCount > 0
      ? 4.5
      : 0;
    const isTop = Boolean(raw.top && Number(raw.top) > 0);
    const category = typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : 'General';
    const conversionRate = Number(raw.conversion_rate) || 0;

    const directUrl =
      raw.href && typeof raw.href === 'string' && raw.href.startsWith('https://')
        ? raw.href
        : raw.href_new && typeof raw.href_new === 'string' && raw.href_new.startsWith('https://')
        ? raw.href_new
        : `https://offers.cpx-research.com/index.php?app_id=${encodeURIComponent(appId)}&ext_user_id=${encodeURIComponent(extUserId)}&survey_id=${encodeURIComponent(id)}${secureHash ? `&secure_hash=${encodeURIComponent(secureHash)}` : ''}`;

    result.push({
      id,
      loiMinutes,
      rewardCents: split.userRewardCents,
      rewardPoints: exactPoints,
      rewardPointsFormatted: exactPoints.toLocaleString('en-US'),
      rewardUsdFormatted: split.userRewardUsdFormatted,
      rewardUsdtFormatted: `${(split.userRewardCents / 100).toFixed(2)} USDT`,
      cpi: !isNaN(publisherUsd) && publisherUsd > 0 ? Number(publisherUsd.toFixed(2)) : grossCents / 100,
      ratingAvg,
      ratingCount,
      isTop,
      directUrl,
      category,
      conversionRate,
      rawPoints: exactPoints,
      isLiveCpx: true
    });
  }

  return result;
}

export async function fetchLiveCpxSurveysBrowser(params: {
  appId?: string;
  hashKey?: string;
  extUserId: string;
  userSharePercent?: number;
  pointsPerUsdt?: number;
  limit?: number;
}): Promise<{
  surveys: Survey[];
  totalAvailable: number;
  secureHash: string;
  appId: string;
}> {
  const appId = (params.appId || '37699').trim();
  const hashKey = (params.hashKey || '1u8hIFGwUYYORM76NM76PDxenCC50bCZ').trim();
  const extUserId = params.extUserId || 'rr_cpx_member';
  const limit = Math.max(1, Math.min(50, params.limit || 12));
  const secureHash = generateCpxSecureHashBrowser(extUserId, hashKey);

  const url = new URL('https://live-api.cpx-research.com/api/get-surveys.php');
  url.searchParams.set('app_id', appId);
  url.searchParams.set('ext_user_id', extUserId);
  url.searchParams.set('output_method', 'api');
  url.searchParams.set('ip_user', '142.250.190.46');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('secure_hash', secureHash);
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    url.searchParams.set('user_agent', navigator.userAgent);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });
  const json = await res.json();
  const surveys = normalizeBrowserCpxSurveys(json.surveys || [], {
    appId,
    extUserId,
    secureHash,
    userSharePercent: params.userSharePercent ?? 50,
    pointsPerUsdt: params.pointsPerUsdt ?? 5000
  });

  return {
    surveys: surveys.slice(0, limit),
    totalAvailable: Number(json.count_available_surveys) || surveys.length,
    secureHash,
    appId
  };
}
