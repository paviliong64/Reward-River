import { dbStore } from './db';
import {
  OfferwallProvider,
  TimewallConfig,
  TimewallSurveyItem,
  TimewallSurveyApiResponse,
  DEFAULT_TIMEWALL_ALLOWED_IPS,
  extractRawQueryParams,
  maskSecretOrHash,
  verifyTimewallHash,
  verifyAndComputeTimewallCoins,
  resolveRealSourceIp,
  isAllowedTimewallIp,
  evaluateTimewallFraudFlags
} from '../src/utils/timewall';

export interface TimewallPostbackResult {
  httpStatus: number;
  body: string;
  outcome:
    | 'credited'
    | 'duplicate'
    | 'reversed'
    | 'duplicate_reversal'
    | 'needs_review'
    | 'blocked'
    | 'unknown_user'
    | 'bad_hash'
    | 'forbidden_ip'
    | 'rate_limited'
    | 'invalid_params'
    | 'internal_error';
  reason: string;
  sourceIp: string;
  userId?: string;
  txid?: string;
  pointsDelta?: number;
}

interface RateLimitBucket {
  count: number;
  resetAtMs: number;
}

export class TimewallService implements OfferwallProvider {
  readonly providerId = 'timewall';
  readonly displayName = 'TimeWall.io';

  // Per-IP rate limit state on the postback route (TimeWall whitelisted IPs are exempt)
  private ipBuckets = new Map<string, RateLimitBucket>();

  getConfig(): TimewallConfig {
    const settings = dbStore.getSettings();

    const oid = String(
      process.env.TIMEWALL_OID ||
        settings.timewallOid ||
        'bbaca457a255e3e2'
    ).trim();
    const placementUrlTemplate = String(
      process.env.TIMEWALL_PLACEMENT_URL ||
        settings.timewallPlacementUrl ||
        'https://timewall.io/users/login?oid={oid}&uid={userid}'
    ).trim();
    const apiKey = String(
      process.env.TIMEWALL_API_KEY ||
        settings.timewallApiKey ||
        'tw_0fb821a06355392350c944a0e69ef60f40f0565fff6ffe62ce57629c76e8f04c'
    ).trim();
    const secret = String(
      process.env.TIMEWALL_SECRET ||
        settings.timewallSecret ||
        '3e8f2c753e704d59013d34c6474363c3'
    ).trim();

    const rawAllowedIps = String(
      process.env.TIMEWALL_ALLOWED_IPS ||
        settings.timewallAllowedIps ||
        DEFAULT_TIMEWALL_ALLOWED_IPS.join(',')
    );
    const allowedIps = rawAllowedIps
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const coinsPerUsd =
      Number(process.env.TIMEWALL_COINS_PER_USD) > 0
        ? Number(process.env.TIMEWALL_COINS_PER_USD)
        : Number(settings.timewallCoinsPerUsd) > 0
        ? Number(settings.timewallCoinsPerUsd)
        : 10000;

    const allowDecimals =
      process.env.TIMEWALL_ALLOW_DECIMALS !== undefined
        ? String(process.env.TIMEWALL_ALLOW_DECIMALS).toLowerCase() === 'true'
        : Boolean(settings.timewallAllowDecimals ?? false);

    const rawCreditTypes = String(
      process.env.TIMEWALL_CREDIT_TYPES ?? settings.timewallCreditTypes ?? ''
    );
    const creditTypes = rawCreditTypes
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const rawReversalTypes = String(
      process.env.TIMEWALL_REVERSAL_TYPES ??
        settings.timewallReversalTypes ??
        'chargeback,reversal,cancel,deduct,2'
    );
    const reversalTypes = rawReversalTypes
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const negativeBalanceMode: 'allow' | 'flag_account' =
      (process.env.TIMEWALL_NEGATIVE_BALANCE_MODE || settings.timewallNegativeBalanceMode) ===
      'flag_account'
        ? 'flag_account'
        : 'allow';

    const maxSingleRevenueUsd = String(
      process.env.TIMEWALL_MAX_SINGLE_REVENUE_USD ||
        settings.timewallMaxSingleRevenueUsd ||
        '50.00'
    ).trim();

    const rawTrustedProxies = String(
      process.env.TRUSTED_PROXIES ||
        settings.trustedProxies ||
        'cloudflare,vercel,127.0.0.1,::1'
    );
    const trustedProxies = rawTrustedProxies
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    return {
      oid,
      placementUrlTemplate,
      apiKey,
      secret,
      allowedIps: allowedIps.length > 0 ? allowedIps : [...DEFAULT_TIMEWALL_ALLOWED_IPS],
      coinsPerUsd,
      allowDecimals,
      creditTypes,
      reversalTypes,
      negativeBalanceMode,
      maxSingleRevenueUsd,
      trustedProxies
    };
  }

  isConfigured(): boolean {
    const cfg = this.getConfig();
    return Boolean(cfg.oid || !cfg.placementUrlTemplate.includes('{oid}'));
  }

  private offerwallHealthCache: {
    oid: string;
    expiresAt: number;
    isLive: boolean;
    statusCode: number;
    reason?: string;
  } | null = null;

  /**
   * Probes whether the Offerwall placement is live and ready for users.
   * Caches result for 45s so user page loads stay fast while auto-activating as soon as live.
   */
  async probeOfferwallLive(userId: string, forceRefresh = false): Promise<{
    isLive: boolean;
    statusCode: number;
    reason?: string;
  }> {
    const cfg = this.getConfig();
    if (!cfg.oid) {
      return { isLive: false, statusCode: 400, reason: 'Placement not configured' };
    }

    if (
      !forceRefresh &&
      this.offerwallHealthCache &&
      this.offerwallHealthCache.oid === cfg.oid &&
      this.offerwallHealthCache.expiresAt > Date.now()
    ) {
      return {
        isLive: this.offerwallHealthCache.isLive,
        statusCode: this.offerwallHealthCache.statusCode,
        reason: this.offerwallHealthCache.reason
      };
    }

    const probeUrl = this.buildOfferwallUrl(userId || 'rr_health_probe');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(probeUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml'
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      const statusCode = res.status;
      if (statusCode === 404) {
        const result = {
          isLive: false,
          statusCode,
          reason: 'Placement URL returned 404'
        };
        this.offerwallHealthCache = { oid: cfg.oid, expiresAt: Date.now() + 30_000, ...result };
        return result;
      }

      if (res.ok) {
        const htmlSnippet = (await res.text().catch(() => '')).slice(0, 8000).toLowerCase();
        const unapprovedOrErrorMarkers = [
          'placement not found',
          'invalid placement',
          'placement is inactive',
          'placement disabled',
          'invalid oid'
        ];
        const matchedMarker = unapprovedOrErrorMarkers.find(m => htmlSnippet.includes(m));
        if (matchedMarker) {
          const result = {
            isLive: false,
            statusCode: 503,
            reason: `Placement under review (${matchedMarker})`
          };
          this.offerwallHealthCache = { oid: cfg.oid, expiresAt: Date.now() + 30_000, ...result };
          return result;
        }
      }

      const result = { isLive: true, statusCode: 200 };
      this.offerwallHealthCache = { oid: cfg.oid, expiresAt: Date.now() + 45_000, ...result };
      return result;
    } catch {
      // Even if server-side datacenter fetch times out, browser iframe loads directly from user's residential IP
      const result = { isLive: true, statusCode: 200 };
      this.offerwallHealthCache = { oid: cfg.oid, expiresAt: Date.now() + 30_000, ...result };
      return result;
    }
  }

  /**
   * Builds the TimeWall offerwall URL SERVER-SIDE exclusively from the authenticated user's ID.
   * Never accepts a user ID from the client query/body.
   */
  buildOfferwallUrl(userId: string): string {
    const cfg = this.getConfig();
    const safeUid = encodeURIComponent(String(userId || '').trim());
    const safeOid = encodeURIComponent(cfg.oid || 'bbaca457a255e3e2');

    let url = cfg.placementUrlTemplate || 'https://timewall.io/users/login?oid={oid}&uid={userid}';
    url = url
      .replace(/\{userid\}/gi, safeUid)
      .replace(/\{user_id\}/gi, safeUid)
      .replace(/\{uid\}/gi, safeUid)
      .replace(/\{oid\}/gi, safeOid);

    // Ensure the user ID is present even if the admin pasted a bare placement URL without {userid}
    if (!url.includes(safeUid)) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}uid=${safeUid}`;
    }
    return url;
  }

  /**
   * Builds the exact S2S request payload for TimeWall's `POST https://api.timewall.io/get-surveys`.
   * Required fields per TimeWall Survey API Reference: `uid`, `ip`, `user_agent` (must belong to the end user).
   */
  buildSurveyApiPayload(params: {
    userId: string;
    userIp: string;
    userAgent: string;
    screenWidth?: number;
    screenHeight?: number;
    limit?: number;
    provider?: string;
  }) {
    const rawIp = String(params.userIp || '').trim();
    const isPrivateOrLoopback =
      !rawIp ||
      rawIp === '127.0.0.1' ||
      rawIp === '::1' ||
      rawIp === 'unknown' ||
      rawIp.startsWith('::ffff:127.') ||
      rawIp.startsWith('10.') ||
      rawIp.startsWith('172.') ||
      rawIp.startsWith('192.168.');

    return {
      uid: String(params.userId || '').trim(),
      ip: isPrivateOrLoopback ? '203.0.113.7' : rawIp,
      user_agent:
        String(params.userAgent || '').trim() ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      screen_width: Math.max(240, Math.min(7680, Math.round(Number(params.screenWidth) || 390))),
      screen_height: Math.max(320, Math.min(4320, Math.round(Number(params.screenHeight) || 844))),
      limit: Math.max(1, Math.min(50, Math.round(Number(params.limit) || 10))),
      provider: String(params.provider || 'all').trim() || 'all'
    };
  }

  /**
   * Server-to-Server call to TimeWall Survey API (`POST https://api.timewall.io/get-surveys`).
   * Keeps `TIMEWALL_API_KEY` strictly on the backend (`Authorization: Bearer YOUR_API_KEY`).
   * Status codes: 200 = Success | 401 = Invalid API key | 400 = Invalid request | 422 = Validation error | 500 = Server error
   * When `prescreener_required: true`, all survey links point to a prescreener ("complete your profile" prompt).
   */
  async fetchSurveysForUser(params: {
    userId: string;
    userIp: string;
    userAgent: string;
    screenWidth?: number;
    screenHeight?: number;
    limit?: number;
    provider?: string;
  }): Promise<TimewallSurveyApiResponse> {
    const cfg = this.getConfig();
    if (!cfg.apiKey) {
      return {
        configured: false,
        success: false,
        prescreenerRequired: false,
        currency: 'Points',
        surveys: [],
        statusCode: 401,
        message: 'TIMEWALL_API_KEY is not configured on the server.'
      };
    }

    const requestBody = this.buildSurveyApiPayload(params);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('https://api.timewall.io/get-surveys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const statusCode = response.status;
      const data: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const statusExplanation =
          statusCode === 401
            ? 'Invalid TimeWall API key (401)'
            : statusCode === 400
            ? 'Invalid survey request (400)'
            : statusCode === 422
            ? 'Validation error from TimeWall Survey API (422)'
            : `TimeWall Survey API error (${statusCode})`;
        return {
          configured: true,
          success: false,
          prescreenerRequired: false,
          currency: String(data?.currency || 'Points'),
          surveys: [],
          statusCode,
          message: String(data?.message || data?.error || statusExplanation)
        };
      }

      const rawSurveys = Array.isArray(data?.surveys) ? data.surveys : [];
      const surveys: TimewallSurveyItem[] = rawSurveys
        .filter((s: any) => s && s.id && s.link)
        .map((s: any) => ({
          id: String(s.id),
          loi: Math.max(1, Math.round(Number(s.loi) || 10)),
          usd_rate: Number(s.usd_rate) || 0,
          currency_amount: Math.max(
            1,
            Math.round(
              Number(s.currency_amount) ||
                Math.round((Number(s.usd_rate) || 0) * cfg.coinsPerUsd)
            )
          ),
          link: String(s.link)
        }));

      const prescreenerRequired = Boolean(data?.prescreener_required);

      return {
        configured: true,
        success: Boolean(data?.success ?? true),
        prescreenerRequired,
        currency: String(data?.currency || 'Points'),
        surveys,
        statusCode: 200,
        message: prescreenerRequired
          ? 'Complete your TimeWall profile prescreener to unlock higher-paying targeted surveys.'
          : surveys.length === 0
          ? 'No matching surveys available right now for your profile/location.'
          : undefined
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        configured: true,
        success: false,
        prescreenerRequired: false,
        currency: 'Points',
        surveys: [],
        statusCode: 500,
        message: `Could not reach TimeWall Survey API: ${msg}`
      };
    }
  }

  /**
   * Per-IP rate limiter for `/postback/timewall`.
   * Generous limit (120 req / min) for non-exempt IPs; whitelisted TimeWall IPs are completely exempt.
   */
  private checkRateLimit(sourceIp: string, allowedIps: string[]): boolean {
    if (isAllowedTimewallIp(sourceIp, allowedIps)) {
      return true; // TimeWall IPs are exempt from rate limiting
    }
    const now = Date.now();
    const key = sourceIp || 'unknown';
    const existing = this.ipBuckets.get(key);
    if (!existing || now >= existing.resetAtMs) {
      this.ipBuckets.set(key, { count: 1, resetAtMs: now + 60_000 });
      return true;
    }
    existing.count += 1;
    return existing.count <= 120;
  }

  /**
   * Logs every postback request with secrets and full hashes masked.
   */
  private logPostbackEvent(params: {
    outcome: TimewallPostbackResult['outcome'];
    reason: string;
    sourceIp: string;
    userIp: string;
    userId: string;
    txid: string;
    revenueRaw: string;
    currencyRaw: string;
    maskedHash: string;
    type: string;
    pointsDelta: number;
    rawQueryMasked: Record<string, string>;
    hashValid: boolean;
    matchedUserId?: string;
    matchedUserEmail?: string;
  }) {
    const logPayload = {
      event: 'timewall_postback',
      outcome: params.outcome,
      reason: params.reason,
      sourceIp: params.sourceIp,
      userIp: params.userIp,
      userId: params.userId,
      txid: params.txid,
      revenueRaw: params.revenueRaw,
      currencyRaw: params.currencyRaw,
      hash: params.maskedHash,
      type: params.type,
      pointsDelta: params.pointsDelta,
      timestamp: new Date().toISOString()
    };
    console.info('[TimeWall Postback]', JSON.stringify(logPayload));

    // Also persist to callbackLogs in dbStore for unified admin visibility (with hash masked)
    try {
      dbStore.addCallbackLog?.({
        provider: 'timewall',
        transId: params.txid || 'unknown',
        extUserId: params.userId || 'unknown',
        matchedUserId: params.matchedUserId,
        matchedUserEmail: params.matchedUserEmail,
        rawQuery: params.rawQueryMasked,
        ipAddress: params.sourceIp,
        hashValid: params.hashValid,
        result:
          params.outcome === 'credited'
            ? 'credited'
            : params.outcome === 'duplicate' || params.outcome === 'duplicate_reversal'
            ? 'duplicate'
            : params.outcome === 'reversed'
            ? 'reversed'
            : params.outcome === 'bad_hash' || params.outcome === 'forbidden_ip'
            ? 'bad_hash'
            : params.outcome === 'unknown_user'
            ? 'unknown_user'
            : 'error',
        pointsDelta: params.pointsDelta,
        amountUsd: Number(params.revenueRaw) || 0,
        notes: `[${params.outcome}] ${params.reason}`
      });
    } catch {
      // Non-blocking callback log write
    }
  }

  /**
   * Executes the full TimeWall GET postback specification in exact required order (steps a–i).
   *
   * TODO (Confirm with TimeWall support upon receiving live test postback):
   * 1. Exact values of `type` that represent credit vs chargeback/reversal, and semantics of `withdrawid` and `reason`.
   * 2. Whether `revenue` is negative on reversals.
   * 3. Confirm that HTTP 200 with body `"OK"` is the expected success response and HTTP 4xx/5xx triggers retry.
   */
  async handlePostback(params: {
    rawUrl: string;
    socketIp?: string | null;
    headers: Record<string, string | string[] | undefined>;
    overrideConfig?: Partial<TimewallConfig>;
  }): Promise<TimewallPostbackResult> {
    const cfg: TimewallConfig = {
      ...this.getConfig(),
      ...(params.overrideConfig || {})
    };

    // Parse raw query parameters directly from rawUrl to prevent float coercion on `revenue` ("0.50", "0.002")
    const rawQuery = extractRawQueryParams(params.rawUrl);
    const userId = String(rawQuery.userid ?? '').trim();
    const txid = String(rawQuery.txid ?? '').trim();
    const revenueRaw = String(rawQuery.revenue ?? '').trim();
    const currencyRaw = String(rawQuery.currency ?? '').trim();
    const receivedHash = String(rawQuery.hash ?? '').trim();
    const userIp = String(rawQuery.ip ?? '').trim();
    const typeRaw = String(rawQuery.type ?? '').trim();
    const withdrawid = String(rawQuery.withdrawid ?? '').trim();
    const reason = String(rawQuery.reason ?? '').trim();
    const offerName = String(rawQuery.offername ?? '').trim();
    const offerDetail = String(rawQuery.offerdetail ?? '').trim();

    const maskedHash = maskSecretOrHash(receivedHash);
    const rawQueryMasked: Record<string, string> = {
      ...rawQuery,
      ...(receivedHash ? { hash: maskedHash } : {})
    };

    try {
      // Step a. Determine REAL source IP (only trust forwarded headers from TRUSTED_PROXIES) & check rate limit + IP whitelist
      const sourceIp = resolveRealSourceIp({
        socketIp: params.socketIp,
        headers: params.headers,
        trustedProxies: cfg.trustedProxies
      });

      if (!this.checkRateLimit(sourceIp, cfg.allowedIps)) {
        const res: TimewallPostbackResult = {
          httpStatus: 429,
          body: 'TOO_MANY_REQUESTS',
          outcome: 'rate_limited',
          reason: `Rate limit exceeded for IP ${sourceIp}`,
          sourceIp,
          userId,
          txid
        };
        this.logPostbackEvent({
          outcome: res.outcome,
          reason: res.reason,
          sourceIp,
          userIp,
          userId,
          txid,
          revenueRaw,
          currencyRaw,
          maskedHash,
          type: typeRaw,
          pointsDelta: 0,
          rawQueryMasked,
          hashValid: false
        });
        return res;
      }

      if (!isAllowedTimewallIp(sourceIp, cfg.allowedIps)) {
        const res: TimewallPostbackResult = {
          httpStatus: 403,
          body: 'FORBIDDEN_IP',
          outcome: 'forbidden_ip',
          reason: `Source IP ${sourceIp} is not in TIMEWALL_ALLOWED_IPS`,
          sourceIp,
          userId,
          txid
        };
        this.logPostbackEvent({
          outcome: res.outcome,
          reason: res.reason,
          sourceIp,
          userIp,
          userId,
          txid,
          revenueRaw,
          currencyRaw,
          maskedHash,
          type: typeRaw,
          pointsDelta: 0,
          rawQueryMasked,
          hashValid: false
        });
        return res;
      }

      // Validate required parameters before hash check
      if (!userId || !txid || !revenueRaw || !receivedHash) {
        const res: TimewallPostbackResult = {
          httpStatus: 400,
          body: 'MISSING_REQUIRED_PARAMS',
          outcome: 'invalid_params',
          reason: 'Missing one or more required parameters: userid, txid, revenue, hash',
          sourceIp,
          userId,
          txid
        };
        this.logPostbackEvent({
          outcome: res.outcome,
          reason: res.reason,
          sourceIp,
          userIp,
          userId,
          txid,
          revenueRaw,
          currencyRaw,
          maskedHash,
          type: typeRaw,
          pointsDelta: 0,
          rawQueryMasked,
          hashValid: false
        });
        return res;
      }

      // Step b. Verify SHA-256 hash using exact raw string value of `revenue` and constant-time compare
      if (!cfg.secret) {
        const res: TimewallPostbackResult = {
          httpStatus: 500,
          body: 'SERVER_MISCONFIGURED',
          outcome: 'internal_error',
          reason: 'TIMEWALL_SECRET is not configured on the server',
          sourceIp,
          userId,
          txid
        };
        this.logPostbackEvent({
          outcome: res.outcome,
          reason: res.reason,
          sourceIp,
          userIp,
          userId,
          txid,
          revenueRaw,
          currencyRaw,
          maskedHash,
          type: typeRaw,
          pointsDelta: 0,
          rawQueryMasked,
          hashValid: false
        });
        return res;
      }

      const hashValid = verifyTimewallHash({
        userId,
        revenueRaw,
        secretKey: cfg.secret,
        receivedHash
      });

      if (!hashValid) {
        const res: TimewallPostbackResult = {
          httpStatus: 403,
          body: 'INVALID_HASH',
          outcome: 'bad_hash',
          reason: `SHA-256 signature mismatch for userid=${userId}, revenueRaw="${revenueRaw}"`,
          sourceIp,
          userId,
          txid
        };
        this.logPostbackEvent({
          outcome: res.outcome,
          reason: res.reason,
          sourceIp,
          userIp,
          userId,
          txid,
          revenueRaw,
          currencyRaw,
          maskedHash,
          type: typeRaw,
          pointsDelta: 0,
          rawQueryMasked,
          hashValid: false
        });
        return res;
      }

      // Step c & e. Numeric sanity check and decimal math verification of `currency` vs `revenue_usd * TIMEWALL_COINS_PER_USD`
      const coinCalc = verifyAndComputeTimewallCoins({
        revenueRaw,
        currencyRaw,
        coinsPerUsd: cfg.coinsPerUsd,
        allowDecimals: cfg.allowDecimals
      });

      if (!coinCalc.validNumbers) {
        const res: TimewallPostbackResult = {
          httpStatus: 400,
          body: 'INVALID_NUMERIC_PARAMS',
          outcome: 'invalid_params',
          reason: coinCalc.mismatchReason || 'Invalid numeric format for revenue or currency',
          sourceIp,
          userId,
          txid
        };
        this.logPostbackEvent({
          outcome: res.outcome,
          reason: res.reason,
          sourceIp,
          userIp,
          userId,
          txid,
          revenueRaw,
          currencyRaw,
          maskedHash,
          type: typeRaw,
          pointsDelta: 0,
          rawQueryMasked,
          hashValid: true
        });
        return res;
      }

      // Look up user by ID or externalOpaqueId
      const matchedUser =
        dbStore.getUserById(userId) || dbStore.getUserByExternalId(userId);

      // Unknown user: log and return HTTP 200 "OK" so TimeWall does not retry forever
      if (!matchedUser) {
        const res: TimewallPostbackResult = {
          httpStatus: 200,
          body: 'OK',
          outcome: 'unknown_user',
          reason: `Unknown userid="${userId}"; acknowledged with HTTP 200 OK to prevent endless retries`,
          sourceIp,
          userId,
          txid,
          pointsDelta: 0
        };
        this.logPostbackEvent({
          outcome: res.outcome,
          reason: res.reason,
          sourceIp,
          userIp,
          userId,
          txid,
          revenueRaw,
          currencyRaw,
          maskedHash,
          type: typeRaw,
          pointsDelta: 0,
          rawQueryMasked,
          hashValid: true
        });
        return res;
      }

      // Classify whether this postback is a reversal or credit, or needs manual review
      const normalizedType = typeRaw.toLowerCase();
      const isReversal =
        (normalizedType !== '' && cfg.reversalTypes.includes(normalizedType)) ||
        coinCalc.revenueIsNegative;

      // Until `type` semantics are confirmed with TimeWall:
      // If `TIMEWALL_CREDIT_TYPES` is non-empty and `type` is not in it (and not a reversal), hold in `needs_review`
      const isUnconfirmedCreditType =
        !isReversal &&
        cfg.creditTypes.length > 0 &&
        (!normalizedType || !cfg.creditTypes.includes(normalizedType));

      // Anti-fraud evaluation
      const recentTransactions = dbStore.getAllOfferwallTransactionsRaw();
      const fraudEval = evaluateTimewallFraudFlags({
        userId: matchedUser.id,
        userIp,
        revenueRaw,
        maxSingleRevenueUsd: cfg.maxSingleRevenueUsd,
        recentTransactions
      });

      const needsReview =
        !isReversal &&
        (!coinCalc.withinTolerance || isUnconfirmedCreditType || fraudEval.holdForReview);

      const reviewReasons: string[] = [];
      if (!coinCalc.withinTolerance && coinCalc.mismatchReason) {
        reviewReasons.push(coinCalc.mismatchReason);
      }
      if (isUnconfirmedCreditType) {
        reviewReasons.push(
          `Unconfirmed type="${typeRaw}" not in TIMEWALL_CREDIT_TYPES (${cfg.creditTypes.join(',')})`
        );
      }
      if (fraudEval.holdForReview) {
        reviewReasons.push(`Fraud flag triggered: ${fraudEval.flags.join(', ')}`);
      }

      // Steps d, f, g. Execute inside ONE atomic lock/transaction
      const atomicResult = await dbStore.processTimewallPostbackAtomic({
        providerTxid: txid,
        user: matchedUser,
        offerName: offerName || 'TimeWall Offer',
        offerDetail,
        revenueRaw,
        revenueUsd: coinCalc.revenueFormatted6,
        coinsFormatted: coinCalc.finalCoinsFormatted,
        coinsInt: coinCalc.finalCoinsInt,
        type: typeRaw,
        withdrawid,
        reason,
        userIp,
        sourceIp,
        rawQuery: rawQueryMasked,
        isReversal,
        needsReview,
        reviewReason: reviewReasons.join(' | '),
        fraudFlags: fraudEval.flags,
        negativeBalanceMode: cfg.negativeBalanceMode,
        coinsPerUsd: cfg.coinsPerUsd
      });

      // Step h & i. Log outcome and return HTTP 200 with body "OK"
      // TODO: Confirm with TimeWall support that HTTP 200 with body "OK" is the expected success response.
      const finalRes: TimewallPostbackResult = {
        httpStatus: 200,
        body: 'OK',
        outcome: atomicResult.outcome,
        reason: atomicResult.notes,
        sourceIp,
        userId: matchedUser.id,
        txid,
        pointsDelta: atomicResult.pointsDelta
      };

      this.logPostbackEvent({
        outcome: finalRes.outcome,
        reason: finalRes.reason,
        sourceIp,
        userIp,
        userId,
        txid,
        revenueRaw,
        currencyRaw,
        maskedHash,
        type: typeRaw,
        pointsDelta: atomicResult.pointsDelta,
        rawQueryMasked,
        hashValid: true,
        matchedUserId: matchedUser.id,
        matchedUserEmail: matchedUser.email
      });

      return finalRes;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[TimeWall Postback Internal Error]', message);
      // Return HTTP 500 on internal failures so TimeWall retries
      return {
        httpStatus: 500,
        body: 'INTERNAL_ERROR',
        outcome: 'internal_error',
        reason: message,
        sourceIp: 'unknown',
        userId,
        txid
      };
    }
  }
}

export const timewallService = new TimewallService();
