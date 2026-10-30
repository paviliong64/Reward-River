/**
 * Supabase Edge Function: cpx-postback
 * Path: /supabase/functions/cpx-postback/index.ts
 *
 * Handles incoming Server-to-Server (S2S) postbacks from CPX Research:
 * 1. Rate-limits requests per IP.
 * 2. Verifies secure_hash in an isolated timing-safe function using CPX_APP_SECURE_HASH from server env.
 * 3. Logs every callback attempt (credited, duplicate, bad_hash, unknown_user, reversed, error) to callback_logs.
 * 4. Calls atomic Postgres RPC `process_cpx_postback` (SECURITY DEFINER) to credit/reverse points,
 *    insert survey_completions + points_ledger, award optional team_bonus, and update user total_points in one transaction.
 * 5. Always returns HTTP 200 "OK" for handled callbacks so CPX does not infinitely retry.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQ = 120;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX_REQ;
}

/**
 * Isolated timing-safe CPX hash verification function.
 * Official CPX spec: md5("{ext_user_id}-{secret}") or md5("{trans_id}-{secret}")
 */
export function verifyCpxSecureHashIsolated(params: {
  extUserId: string;
  transId: string;
  receivedHash: string;
  secretKey: string;
}): boolean {
  const { extUserId, transId, receivedHash, secretKey } = params;
  if (!receivedHash || !secretKey) return false;

  const cleanReceived = receivedHash.trim().toLowerCase();
  const candidates = [
    createHash('md5').update(`${extUserId}-${secretKey}`).digest('hex').toLowerCase(),
    createHash('md5').update(`${transId}-${secretKey}`).digest('hex').toLowerCase(),
    createHash('md5').update(`${transId}-${extUserId}-${secretKey}`).digest('hex').toLowerCase()
  ];

  const receivedBuf = Buffer.from(cleanReceived, 'utf8');
  let matched = false;

  for (const candidate of candidates) {
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (receivedBuf.length === candidateBuf.length && timingSafeEqual(receivedBuf, candidateBuf)) {
      matched = true;
    }
  }

  return matched;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  if (!checkRateLimit(ip)) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const cpxSecret = Deno.env.get('CPX_APP_SECURE_HASH') || Deno.env.get('CPX_HASH_KEY') || '';

  const sb = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const queryParams = Object.fromEntries(url.searchParams.entries());
  let bodyParams: Record<string, unknown> = {};
  if (req.method === 'POST') {
    try {
      bodyParams = await req.json();
    } catch {
      // ignore non-json body
    }
  }

  const params = { ...queryParams, ...bodyParams };
  const transId = String(params.trans_id || params.transaction_id || params.tx_id || '').trim();
  const extUserId = String(params.ext_user_id || params.user_id || params.subid_1 || '').trim();
  const offerId = String(params.offer_id || params.survey_id || transId || 'cpx_survey').trim();
  const amountUsd = Number(params.amount_usd ?? params.payout ?? 0) || 0;
  const rawStatus = String(params.status ?? '1').trim();
  const receivedHash = String(params.secure_hash || params.hash || params.signature || '').trim();

  if (!transId || !extUserId) {
    await sb.from('callback_logs').insert({
      provider: 'cpx',
      raw_query: url.search,
      ip,
      trans_id: transId || null,
      ext_user_id: extUserId || null,
      status_logged: 'error',
      points_delta: 0,
      details: { error: 'Missing trans_id or ext_user_id', params }
    });
    return new Response('OK', { status: 200 });
  }

  // Isolated timing-safe hash check
  const isValidHash = verifyCpxSecureHashIsolated({
    extUserId,
    transId,
    receivedHash,
    secretKey: cpxSecret
  });

  if (!isValidHash) {
    await sb.from('callback_logs').insert({
      provider: 'cpx',
      raw_query: url.search,
      ip,
      trans_id: transId,
      ext_user_id: extUserId,
      status_logged: 'bad_hash',
      points_delta: 0,
      details: { receivedHash: receivedHash || 'MISSING', offerId, status: rawStatus }
    });
    return new Response('OK', { status: 200 });
  }

  const numericStatus = rawStatus === '2' || rawStatus === '3' || rawStatus.toLowerCase() === 'reversed' ? 2 : 1;

  try {
    const { data, error } = await sb.rpc('process_cpx_postback', {
      p_trans_id: transId,
      p_ext_user_id: extUserId,
      p_offer_id: offerId,
      p_amount_usd: amountUsd,
      p_status: numericStatus,
      p_approved_by: 'CPX Edge Function S2S',
      p_ip: ip,
      p_raw_payload: params
    });

    if (error) {
      await sb.from('callback_logs').insert({
        provider: 'cpx',
        raw_query: url.search,
        ip,
        trans_id: transId,
        ext_user_id: extUserId,
        status_logged: 'error',
        points_delta: 0,
        details: { error: error.message, params }
      });
    } else {
      console.log('[CPX Edge Postback Processed]:', data);
    }
  } catch (err) {
    await sb.from('callback_logs').insert({
      provider: 'cpx',
      raw_query: url.search,
      ip,
      trans_id: transId,
      ext_user_id: extUserId,
      status_logged: 'error',
      points_delta: 0,
      details: { error: err instanceof Error ? err.message : String(err) }
    });
  }

  return new Response('OK', { status: 200 });
});
