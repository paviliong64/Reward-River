/**
 * Reward River - Dedicated CPX Research Service
 * Official API documentation: https://www.cpx-research.com/main/en/doc.php
 */

import {
  generateCpxSecureHash,
  verifyCpxPostbackSignature,
  normalizeCpxSurveyList,
  buildCpxSurveyUrl,
  NormalizedSurvey
} from '../src/utils/cpx';

export interface CpxConfigStatus {
  isConfigured: boolean;
  appIdConfigured: boolean;
  hashKeyConfigured: boolean;
  postbackSecretConfigured: boolean;
  mode: 'live' | 'demo';
}

export interface FetchSurveysResult {
  success: boolean;
  surveys: NormalizedSurvey[];
  totalAvailable: number;
  message?: string;
  source: 'cpx_api' | 'demo_curated' | 'none';
}

export class CpxResearchService {
  private get appId(): string {
    return process.env.CPX_APP_ID || '';
  }

  private get hashKey(): string {
    return process.env.CPX_HASH_KEY || '';
  }

  private get postbackSecret(): string {
    return process.env.CPX_POSTBACK_SECRET || '';
  }

  /**
   * Returns current integration configuration status.
   */
  getConfigStatus(): CpxConfigStatus {
    const appIdConfigured = Boolean(this.appId && this.appId !== 'YOUR_CPX_APP_ID');
    const hashKeyConfigured = Boolean(this.hashKey && this.hashKey !== 'YOUR_CPX_SECURE_HASH_KEY');
    const postbackSecretConfigured = Boolean(this.postbackSecret && this.postbackSecret !== 'YOUR_CPX_POSTBACK_SECRET');

    const isConfigured = appIdConfigured && hashKeyConfigured;
    return {
      isConfigured,
      appIdConfigured,
      hashKeyConfigured,
      postbackSecretConfigured,
      mode: isConfigured ? 'live' : 'demo'
    };
  }

  /**
   * Retrieves eligible surveys using the official documented CPX endpoint:
   * https://oul.cpx-research.com/api/get-surveys.php
   */
  async fetchEligibleSurveys(params: {
    externalUserId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<FetchSurveysResult> {
    const { externalUserId, ipAddress = '127.0.0.1', userAgent = '' } = params;
    const config = this.getConfigStatus();

    // If CPX publisher credentials are not yet set up, return informative status
    if (!config.isConfigured) {
      // In demo mode for local development/audit without real keys,
      // return clearly labeled demo survey opportunities so flows are fully testable.
      const demoSurveys = this.getCuratedDemoSurveys(externalUserId);
      return {
        success: true,
        surveys: demoSurveys,
        totalAvailable: demoSurveys.length,
        message: 'Running in CPX Publisher Preview mode. Set CPX_APP_ID and CPX_HASH_KEY in server environment to connect live production inventory.',
        source: 'demo_curated'
      };
    }

    try {
      const secureHash = generateCpxSecureHash(externalUserId, this.hashKey);

      const url = new URL('https://oul.cpx-research.com/api/get-surveys.php');
      url.searchParams.set('app_id', this.appId);
      url.searchParams.set('ext_user_id', externalUserId);
      url.searchParams.set('output_method', 'api');
      url.searchParams.set('ip_click', ipAddress);
      url.searchParams.set('secure_hash', secureHash);
      if (userAgent) {
        url.searchParams.set('user_agent', userAgent);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RewardRiver-Server/1.0'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`CPX API HTTP Error: status=${response.status}`);
        return {
          success: false,
          surveys: [],
          totalAvailable: 0,
          message: `CPX Research API returned status ${response.status}.`,
          source: 'none'
        };
      }

      const json = await response.json();
      const normalized = normalizeCpxSurveyList(json, this.appId, externalUserId, this.hashKey);

      return {
        success: true,
        surveys: normalized,
        totalAvailable: normalized.length,
        source: 'cpx_api'
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('CPX Research Service connection failed:', errorMsg);
      return {
        success: false,
        surveys: [],
        totalAvailable: 0,
        message: 'Could not connect to CPX Research server. Please check network connectivity or try again.',
        source: 'none'
      };
    }
  }

  /**
   * Generates official CPX survey start URL for a specific survey or generic survey wall.
   */
  generateSurveyStartUrl(externalUserId: string, surveyId?: string): string {
    const config = this.getConfigStatus();
    if (!config.isConfigured) {
      // Return safe preview landing link
      return `https://oul.cpx-research.com/index.php?app_id=demo&ext_user_id=${encodeURIComponent(externalUserId)}`;
    }

    return buildCpxSurveyUrl({
      appId: this.appId,
      extUserId: externalUserId,
      hashKey: this.hashKey,
      surveyId,
      mainColor: '0284c7'
    });
  }

  /**
   * Verifies incoming server-to-server postback signature.
   */
  verifyPostback(transId: string, extUserId: string, secureHash?: string): boolean {
    const effectiveSecret = this.hashKey || this.postbackSecret;
    if (!effectiveSecret) {
      // In development when credentials are not configured
      return false;
    }
    if (!secureHash) return false;
    return verifyCpxPostbackSignature(transId, extUserId, secureHash, effectiveSecret);
  }

  /**
   * High-fidelity structured surveys for development and live demonstration
   * before publisher keys are inserted into .env.
   */
  private getCuratedDemoSurveys(externalUserId: string): NormalizedSurvey[] {
    const mockRaw = {
      status: 'success',
      surveys: [
        {
          id: 'cpx_101',
          loi: 7,
          payout: 1.25,
          cpi: 1.25,
          conversion_rate: 85,
          statistics_rating_avg: 4.8,
          statistics_rating_count: 512,
          top: 1
        },
        {
          id: 'cpx_102',
          loi: 12,
          payout: 2.10,
          cpi: 2.10,
          conversion_rate: 78,
          statistics_rating_avg: 4.6,
          statistics_rating_count: 240,
          top: 1
        },
        {
          id: 'cpx_103',
          loi: 15,
          payout: 3.40,
          cpi: 3.40,
          conversion_rate: 65,
          statistics_rating_avg: 4.4,
          statistics_rating_count: 180,
          top: 0
        },
        {
          id: 'cpx_104',
          loi: 4,
          payout: 0.65,
          cpi: 0.65,
          conversion_rate: 92,
          statistics_rating_avg: 4.9,
          statistics_rating_count: 670,
          top: 0
        },
        {
          id: 'cpx_105',
          loi: 20,
          payout: 4.50,
          cpi: 4.50,
          conversion_rate: 60,
          statistics_rating_avg: 4.3,
          statistics_rating_count: 98,
          top: 0
        }
      ]
    };

    return normalizeCpxSurveyList(mockRaw, 'preview_demo', externalUserId);
  }
}

export const cpxResearchService = new CpxResearchService();
