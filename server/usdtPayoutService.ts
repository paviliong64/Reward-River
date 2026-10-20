/**
 * Reward River - USDT Payout Provider Abstraction
 * Supports TRON (TRC-20) and Ethereum (ERC-20) network payouts.
 */

import { WithdrawalRequestDoc } from './db';

export interface PayoutProviderStatus {
  providerName: string;
  isConfigured: boolean;
  supportedNetworks: ('TRC20' | 'ERC20')[];
  supportsAutomatedSettlement: boolean;
  instructions: string;
}

export interface PayoutResult {
  success: boolean;
  status: 'under_review' | 'approved' | 'processing' | 'paid' | 'failed';
  txHash?: string;
  message: string;
}

export interface UsdtPayoutProvider {
  readonly name: string;
  getStatus(): PayoutProviderStatus;
  processWithdrawal(request: WithdrawalRequestDoc): Promise<PayoutResult>;
}

/**
 * Default secure provider when no external hot wallet or automated payout provider API is configured.
 * Requests are securely placed into "under_review" where an administrator verifies compliance
 * and records settlement manually via signed cold storage or trusted batch transaction.
 */
export class UnconfiguredUsdtPayoutProvider implements UsdtPayoutProvider {
  readonly name = 'Manual Admin Review / Unconfigured USDT Engine';

  getStatus(): PayoutProviderStatus {
    return {
      providerName: this.name,
      isConfigured: false,
      supportedNetworks: ['TRC20', 'ERC20'],
      supportsAutomatedSettlement: false,
      instructions: 'No automated USDT payout API credentials configured. All withdrawal requests are routed into the Admin Review Queue. Administrators audit the USDT address and record on-chain TxID upon settlement.'
    };
  }

  async processWithdrawal(request: WithdrawalRequestDoc): Promise<PayoutResult> {
    return {
      success: true,
      status: 'under_review',
      message: `Withdrawal request for ${request.netUsdt} USDT (${request.network}) is held safely under review.`
    };
  }
}

class UsdtPayoutManager {
  private provider: UsdtPayoutProvider;

  constructor() {
    this.provider = new UnconfiguredUsdtPayoutProvider();
  }

  getProvider(): UsdtPayoutProvider {
    return this.provider;
  }

  getStatus(): PayoutProviderStatus {
    return this.provider.getStatus();
  }
}

export const usdtPayoutManager = new UsdtPayoutManager();
