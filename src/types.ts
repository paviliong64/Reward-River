export interface User {
  id: string;
  username?: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  role: 'user' | 'manager' | 'admin';
  status?: 'active' | 'disabled' | 'banned';
  createdAt: string;
  externalOpaqueId?: string;
  updatedAt?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  photoURL?: string;
  countryCode?: string;
  hasPromptedPhone?: boolean;
  provider?: 'google.com' | 'password' | string;
  teamId?: string;
  teamName?: string;
  teamCode?: string;
}

export interface ImpersonationSessionInfo {
  sessionId: string;
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetEmail: string;
  startedAt: string;
  expiresAt: string;
  readOnly: true;
}

export interface Team {
  id: string;
  name: string;
  managerId: string;
  managerEmail?: string;
  managerName?: string;
  teamCode: string;
  isActive: boolean;
  createdAt: string;
  memberCount?: number;
  activeTodayCount?: number;
  teamPoints?: number;
  completedSurveysCount?: number;
}

export interface TeamMember {
  id: string;
  teamId: string;
  teamName?: string;
  teamCode?: string;
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  joinedAt: string;
  consentAcceptedAt: string;
  surveysCompleted?: number;
  totalPoints?: number;
  availablePoints?: number;
  lastActiveAt?: string;
}

export interface CallbackLogEntry {
  id: string;
  provider: string;
  transId: string;
  extUserId: string;
  matchedUserId?: string;
  matchedUserEmail?: string;
  rawQuery: Record<string, unknown>;
  ipAddress: string;
  hashValid: boolean;
  result: 'credited' | 'duplicate' | 'bad_hash' | 'unknown_user' | 'reversed' | 'error';
  pointsDelta: number;
  amountUsd: number;
  notes?: string;
  createdAt: string;
}

export interface AdminUserDetail extends User {
  balances: UserBalances;
  completedSurveysCount: number;
  tasksPendingCount?: number;
  tasksRejectedCount?: number;
  totalTransactionsCount: number;
  cohort?: 'new' | 'old';
  storedPoints?: number;
  recentEntries?: LedgerEntry[];
  fullLedger?: LedgerEntry[];
  withdrawals?: Withdrawal[];
  lastActiveAt?: string;
  createdAtKarachi?: string;
  lastActiveAtKarachi?: string;
  team?: {
    teamId: string;
    teamName: string;
    teamCode: string;
    managerId: string;
    managerEmail?: string;
    joinedAt: string;
    consentAcceptedAt: string;
  } | null;
  managedTeams?: Team[];
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
  taskId?: string;
  amountCents: number;
  points?: number;
  grossCents?: number;
  adminProfitCents?: number;
  appliedSharePercent?: number;
  entryType: 'credit' | 'debit' | 'reversal';
  status: 'pending' | 'confirmed' | 'reversed' | 'rejected';
  reason?: 'cpx_complete' | 'cpx_reversal' | 'team_bonus' | 'manual_adjustment' | 'backfill' | string;
  createdAt: string;
  processedAt?: string;
  description?: string;
  cpxOfferId?: string;
  approvedBy?: string;
  reversalRef?: string;
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
  newUserDays?: number;
  timezone?: string;
  teamSystemEnabled?: boolean;
  managersCanCreateTeams?: boolean;
  maxTeamsPerManager?: number;
  teamBonusEnabled?: boolean;
  teamBonusPercent?: number;
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


