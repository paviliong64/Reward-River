export interface User {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  role: 'user' | 'admin';
  createdAt: string;
  externalOpaqueId?: string;
  updatedAt?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  photoURL?: string;
  countryCode?: string;
  hasPromptedPhone?: boolean;
  provider?: 'google.com' | 'password' | string;
}

export interface AdminUserDetail extends User {
  balances: UserBalances;
  completedSurveysCount: number;
  totalTransactionsCount: number;
  lastActiveAt?: string;
}

export interface UserBalances {
  availableCents: number;
  pendingCents: number;
  totalEarnedCents: number;
  totalWithdrawnCents: number;
  reservedWithdrawalCents: number;
}

export interface UsdtQuote {
  priceUsd: number;
  formattedPrice: string;
  pegStatus: string;
  source: string;
  timestamp: string;
  expiresAt: string;
  isStale: boolean;
}

export interface Survey {
  id: string;
  loiMinutes: number;
  rewardCents: number;
  rewardUsdFormatted: string;
  rewardUsdtFormatted: string;
  cpi: number;
  ratingAvg: number;
  ratingCount: number;
  isTop: boolean;
  directUrl: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  userEmail: string;
  usdtAddress: string;
  network: 'TRC20' | 'ERC20';
  amountCents: number;
  feeCents: number;
  netCents: number;
  grossUsdt: string;
  feeUsdt: string;
  netUsdt: string;
  status: 'requested' | 'under_review' | 'approved' | 'processing' | 'paid' | 'rejected' | 'failed' | 'cancelled';
  txHash?: string;
  createdAt: string;
  updatedAt: string;
  reviewNotes?: string;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  providerTxId: string;
  amountCents: number;
  entryType: 'credit' | 'debit' | 'reversal';
  status: 'pending' | 'confirmed' | 'reversed';
  createdAt: string;
  description?: string;
  cpxOfferId?: string;
}

export interface SystemSettings {
  minWithdrawalCents: number;
  maxWithdrawalCents: number;
  feeCentsTrc20: number;
  feeCentsErc20: number;
  maintenanceMode: boolean;
  defaultNetwork: 'TRC20' | 'ERC20';
  updatedAt: string;
}

export interface CpxConfigStatus {
  isConfigured: boolean;
  appIdConfigured: boolean;
  hashKeyConfigured: boolean;
  postbackSecretConfigured: boolean;
  mode: 'live' | 'demo';
}
