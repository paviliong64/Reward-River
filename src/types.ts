export interface User {
  id: string;
  username?: string;
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
  recentEntries?: LedgerEntry[];
  lastActiveAt?: string;
}

export interface UserBalances {
  availableCents: number;
  pendingCents: number;
  totalEarnedCents: number;
  totalWithdrawnCents: number;
  reservedWithdrawalCents: number;
  availablePoints: number;
  pendingPoints: number;
  totalEarnedPoints: number;
  totalWithdrawnPoints: number;
  totalAdminProfitCents?: number;
  totalGrossRevenueCents?: number;
  completedSurveysCount?: number;
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
  rewardPoints: number;
  rewardPointsFormatted: string;
  rewardUsdFormatted: string;
  rewardUsdtFormatted: string;
  cpi: number;
  ratingAvg: number;
  ratingCount: number;
  isTop: boolean;
  directUrl: string;
  category?: string;
  conversionRate?: number;
  rawPoints?: number;
  isLiveCpx?: boolean;
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
  points?: number;
  grossCents?: number;
  adminProfitCents?: number;
  appliedSharePercent?: number;
  entryType: 'credit' | 'debit' | 'reversal';
  status: 'pending' | 'confirmed' | 'reversed';
  createdAt: string;
  description?: string;
  cpxOfferId?: string;
}

export interface SystemSettings {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceKey?: string;
  minWithdrawalCents: number;
  maxWithdrawalCents: number;
  feeCentsTrc20: number;
  feeCentsErc20: number;
  userSharePercent: number;
  pointsPerUsdt: number;
  surveyDisplayMode?: 'hybrid' | 'points_only';
  cpxAppId?: string;
  cpxHashKey?: string;
  cpxApiKey?: string;
  cpxIntegrationMode?: 'hybrid_api' | 'direct_wall' | 'paused';
  cpxMaxSurveys?: number;
  cpxThemeColor?: string;
  cpxEnableFallback?: boolean;
  cpxVerifySignature?: boolean;
  aoyApiKey?: string;
  aoySecretKey?: string;
  aoyBearerToken?: string;
  aoyExchangeRate?: number;
  aoyEnableFallback?: boolean;
  aoyVerifySignature?: boolean;
  maintenanceMode: boolean;
  defaultNetwork: 'TRC20' | 'ERC20';
  googleAnalyticsId?: string;
  googleAnalyticsEnabled?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogImageUrl?: string;
  googleSearchConsoleKey?: string;
  sitemapEnabled?: boolean;
  updatedAt: string;
}

export interface WhiteLabelTask {
  id: string;
  taskType: 'ptc' | 'shortlink';
  title: string;
  description: string;
  durationSeconds: number;
  rewardPoints: number;
  rewardPointsFormatted: string;
  rewardCents: number;
  rewardUsdtFormatted: string;
  availableClaims: number;
  dailyLimit: number;
  adType: 'Iframe' | 'Window';
  launchUrl: string;
  isFeatured: boolean;
}

export interface CpxConfigStatus {
  isConfigured: boolean;
  appIdConfigured: boolean;
  hashKeyConfigured: boolean;
  postbackSecretConfigured: boolean;
  appId?: string;
  integrationMode?: 'hybrid_api' | 'direct_wall' | 'paused';
  mode: 'live' | 'demo' | 'unconfigured';
}

