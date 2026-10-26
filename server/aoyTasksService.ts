import { dbStore } from './db';
import {
  WhiteLabelTask,
  sanitizeAoySubId,
  normalizeAoyPtcList,
  normalizeAoyShortlinkList,
  verifyAoyPostbackSignature
} from '../src/utils/aoytasks';

interface CacheEntry {
  expiresAt: number;
  tasks: WhiteLabelTask[];
  livePtcCount: number;
  liveShortlinkCount: number;
  source: 'live_api' | 'white_label_catalog';
}

export class AoyTasksService {
  private cache = new Map<string, CacheEntry>();

  get apiKey(): string {
    const settings = dbStore.getSettings();
    return settings.aoyApiKey || process.env.AOY_API_KEY || '';
  }

  get secretKey(): string {
    const settings = dbStore.getSettings();
    return settings.aoySecretKey || process.env.AOY_SECRET_KEY || '';
  }

  get bearerToken(): string {
    const settings = dbStore.getSettings();
    return settings.aoyBearerToken || process.env.AOY_BEARER_TOKEN || '';
  }

  get exchangeRate(): number {
    const settings = dbStore.getSettings();
    return Number(settings.aoyExchangeRate) || 10000;
  }

  get enableFallback(): boolean {
    const settings = dbStore.getSettings();
    return settings.aoyEnableFallback !== false;
  }

  getConfigStatus() {
    const hasApiKey = Boolean(this.apiKey && this.apiKey.trim().length > 0);
    const hasSecretKey = Boolean(this.secretKey && this.secretKey.trim().length > 0);
    const hasBearerToken = Boolean(this.bearerToken && this.bearerToken.trim().length > 0);
    return {
      isConfigured: hasApiKey && hasBearerToken,
      apiKeyConfigured: hasApiKey,
      secretKeyConfigured: hasSecretKey,
      bearerTokenConfigured: hasBearerToken,
      exchangeRate: this.exchangeRate,
      enableFallback: this.enableFallback,
      mode: hasApiKey && hasBearerToken ? ('live' as const) : ('white_label_catalog' as const)
    };
  }

  generateOfferwallUrl(rawUserId: string): string {
    const subId = sanitizeAoySubId(rawUserId);
    const key = this.apiKey || 'YOUR_API_KEY';
    return `https://aoyco.in/offerwall/${encodeURIComponent(key)}/${encodeURIComponent(subId)}`;
  }

  verifyPostback(params: {
    subId: string;
    transId: string;
    reward: string;
    signature: string;
  }): boolean {
    const settings = dbStore.getSettings();
    if (settings.aoyVerifySignature === false) return true;
    return verifyAoyPostbackSignature(
      params.subId,
      params.transId,
      params.reward,
      this.secretKey,
      params.signature
    );
  }

  private getCuratedWhiteLabelTasks(
    userSharePercent: number,
    pointsPerUsdt: number
  ): WhiteLabelTask[] {
    const rawPtc = [
      {
        id: 101,
        title: 'Cloud Infrastructure & Web3 Security Showcase',
        description: 'Explore our partner cloud security overview for 15 seconds to earn instant Points & USDT.',
        duration: 15,
        reward: '2500.00',
        payout: '0.25',
        url: '/?task_preview=ptc_101',
        ad_type: 'Iframe'
      },
      {
        id: 102,
        title: 'Digital Commerce & SaaS Analytics Review',
        description: 'Visit the featured SaaS analytics landing page and remain active until the timer completes.',
        duration: 20,
        reward: '4000.00',
        payout: '0.40',
        url: '/?task_preview=ptc_102',
        ad_type: 'Iframe'
      },
      {
        id: 103,
        title: 'Fintech Payment Gateway Partner Spotlight',
        description: 'Preview the multi-currency settlement portal for 10 seconds for instant account credit.',
        duration: 10,
        reward: '1500.00',
        payout: '0.15',
        url: '/?task_preview=ptc_103',
        ad_type: 'Iframe'
      },
      {
        id: 104,
        title: 'Global Consumer Brand Discovery Page',
        description: 'View our sponsored consumer electronics showcase to unlock your instant reward.',
        duration: 30,
        reward: '5000.00',
        payout: '0.50',
        url: '/?task_preview=ptc_104',
        ad_type: 'Window'
      }
    ];

    const rawShortlinks = [
      {
        id: 201,
        title: 'Reward River Express Verification Link #1',
        reward: '3500.00',
        payout: '0.35',
        available: '3',
        limit: '3',
        url: '/?task_preview=sl_201'
      },
      {
        id: 202,
        title: 'Reward River Priority Sponsor Gate #2',
        reward: '6000.00',
        payout: '0.60',
        available: '2',
        limit: '2',
        url: '/?task_preview=sl_202'
      },
      {
        id: 203,
        title: 'Reward River Daily Partner Link #3',
        reward: '2000.00',
        payout: '0.20',
        available: '5',
        limit: '5',
        url: '/?task_preview=sl_203'
      }
    ];

    return [
      ...normalizeAoyPtcList(rawPtc, {
        userSharePercent,
        pointsPerUsdt,
        exchangeRatePerUsd: this.exchangeRate
      }),
      ...normalizeAoyShortlinkList(rawShortlinks, {
        userSharePercent,
        pointsPerUsdt,
        exchangeRatePerUsd: this.exchangeRate
      })
    ];
  }

  async fetchWhiteLabelTasks(params: {
    rawUserId: string;
    ipAddress: string;
    userAgent: string;
    forceRefresh?: boolean;
  }): Promise<{
    tasks: WhiteLabelTask[];
    livePtcCount: number;
    liveShortlinkCount: number;
    source: 'live_api' | 'white_label_catalog';
  }> {
    const settings = dbStore.getSettings();
    const userSharePercent = settings.userSharePercent || 40;
    const pointsPerUsdt = settings.pointsPerUsdt || 10000;
    const subId = sanitizeAoySubId(params.rawUserId);
    const cacheKey = `${subId}_${userSharePercent}_${pointsPerUsdt}_${this.apiKey}`;

    if (!params.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          tasks: cached.tasks,
          livePtcCount: cached.livePtcCount,
          liveShortlinkCount: cached.liveShortlinkCount,
          source: cached.source
        };
      }
    }

    const cleanIp =
      params.ipAddress === '::1' || params.ipAddress === '127.0.0.1' || !params.ipAddress
        ? '5.146.176.100'
        : params.ipAddress;

    if (this.apiKey && this.bearerToken) {
      try {
        const ptcUrl = `https://aoyco.in/api/v1/ptc/${encodeURIComponent(this.apiKey)}/${encodeURIComponent(subId)}/${encodeURIComponent(cleanIp)}`;
        const slUrl = `https://aoyco.in/api/v1/sl-api/${encodeURIComponent(this.apiKey)}/${encodeURIComponent(subId)}/${encodeURIComponent(cleanIp)}`;
        const headers = {
          Authorization: `Bearer ${this.bearerToken}`,
          'User-UA': params.userAgent || 'Mozilla/5.0',
          Accept: 'application/json'
        };

        const [ptcRes, slRes] = await Promise.allSettled([
          fetch(ptcUrl, { headers, signal: AbortSignal.timeout(6000) }),
          fetch(slUrl, { headers, signal: AbortSignal.timeout(6000) })
        ]);

        let rawPtcData: any[] = [];
        let rawSlData: any[] = [];

        if (ptcRes.status === 'fulfilled' && ptcRes.value.ok) {
          const json = await ptcRes.value.json();
          if (String(json?.status) === '200' && Array.isArray(json?.data)) {
            rawPtcData = json.data;
          }
        }

        if (slRes.status === 'fulfilled' && slRes.value.ok) {
          const json = await slRes.value.json();
          if (String(json?.status) === '200' && Array.isArray(json?.data)) {
            rawSlData = json.data;
          }
        }

        const normalizedPtc = normalizeAoyPtcList(rawPtcData, {
          userSharePercent,
          pointsPerUsdt,
          exchangeRatePerUsd: this.exchangeRate
        });
        const normalizedSl = normalizeAoyShortlinkList(rawSlData, {
          userSharePercent,
          pointsPerUsdt,
          exchangeRatePerUsd: this.exchangeRate
        });

        const combined = [...normalizedPtc, ...normalizedSl];
        if (combined.length > 0 || !this.enableFallback) {
          const entry: CacheEntry = {
            expiresAt: Date.now() + 60_000,
            tasks: combined,
            livePtcCount: normalizedPtc.length,
            liveShortlinkCount: normalizedSl.length,
            source: 'live_api'
          };
          this.cache.set(cacheKey, entry);
          return entry;
        }
      } catch (err) {
        console.warn('AoyTasks live API fetch fallback:', err);
      }
    }

    const fallbackTasks = this.enableFallback
      ? this.getCuratedWhiteLabelTasks(userSharePercent, pointsPerUsdt)
      : [];

    const entry: CacheEntry = {
      expiresAt: Date.now() + 30_000,
      tasks: fallbackTasks,
      livePtcCount: 0,
      liveShortlinkCount: 0,
      source: 'white_label_catalog'
    };
    this.cache.set(cacheKey, entry);
    return entry;
  }
}

export const aoyTasksService = new AoyTasksService();
