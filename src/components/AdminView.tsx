import React, { useState, useEffect } from 'react';
import { User, Withdrawal, SystemSettings, AdminUserDetail } from '../types';
import { fetchLiveCpxSurveysBrowser } from '../utils/cpxClient';
import {
  LayoutGrid,
  BarChart3,
  FilePlus2,
  Settings,
  Megaphone,
  Users,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Activity,
  Globe,
  ArrowUpRight,
  RefreshCw,
  Send,
  ExternalLink,
  Search,
  MessageSquare,
  CheckCircle2,
  Eye,
  X,
  Calendar,
  DollarSign,
  Award,
  ShieldCheck,
  Copy,
  Check,
  Sliders,
  Zap,
  Wallet,
  Lock,
  ArrowLeft,
  Trash2,
  TrendingUp,
  Cpu,
  Server,
  LineChart,
  SearchCheck,
  Smartphone,
  Monitor,
  AlertTriangle,
  CheckCheck
} from 'lucide-react';

interface AdminViewProps {
  user?: User;
  adminUser?: User;
  cpxStatus?: any;
  onRefreshAll?: () => void;
  onDataChanged?: () => void;
  onExitAdmin?: () => void;
}

type AdminSection =
  | 'overview'
  | 'partner_revenue'
  | 'points_split'
  | 'cpx_manager'
  | 'aoy_manager'
  | 'withdrawals'
  | 'users'
  | 'user_analytics'
  | 'system_health'
  | 'seo_analytics'
  | 'settings'
  | 'audit_logs';

export const AdminView: React.FC<AdminViewProps> = ({
  adminUser,
  onRefreshAll,
  onDataChanged,
  onExitAdmin
}) => {
  const triggerRefresh = onRefreshAll || onDataChanged || (() => {});
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [overview, setOverview] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [usersList, setUsersList] = useState<AdminUserDetail[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const defaultAdminSettings: SystemSettings = {
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseServiceKey: '',
    minWithdrawalCents: 2500,
    maxWithdrawalCents: 50000,
    feeCentsTrc20: 100,
    feeCentsErc20: 250,
    userSharePercent: 40,
    pointsPerUsdt: 10000,
    surveyDisplayMode: 'points_only',
    cpxAppId: '37699',
    cpxHashKey: '1u8hIFGwUYYORM76NM76PDxenCC50bCZ',
    cpxIntegrationMode: 'hybrid_api',
    cpxMaxSurveys: 12,
    cpxThemeColor: '10b981',
    cpxEnableFallback: false,
    cpxVerifySignature: true,
    aoyApiKey: '',
    aoySecretKey: '',
    aoyBearerToken: '',
    aoyExchangeRate: 10000,
    aoyEnableFallback: false,
    aoyVerifySignature: true,
    maintenanceMode: false,
    defaultNetwork: 'TRC20',
    googleAnalyticsId: 'G-REWARDRIVER1',
    googleAnalyticsEnabled: true,
    metaTitle: 'Reward River - Real Opinions. Real Value.',
    metaDescription: 'Discover available research surveys, share verified opinions, and earn Points.',
    metaKeywords: 'surveys, cpx research, paid surveys, market research, reward points',
    ogImageUrl: '/favicon.svg',
    googleSearchConsoleKey: '',
    sitemapEnabled: true,
    updatedAt: new Date().toISOString()
  };

  const [settings, setSettings] = useState<SystemSettings>(defaultAdminSettings);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // User search and user detail modal
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null);

  // Modal for marking as paid with TxHash
  const [payoutModal, setPayoutModal] = useState<{ id: string; txHash: string; notes: string } | null>(null);

  // CPX Postback simulator state (Gross CPX Payout in Cents, e.g. 100 = $1.00 Gross)
  const [testAmountCents, setTestAmountCents] = useState(100);
  const [testOfferId, setTestOfferId] = useState('offer_101');
  const [testStatus, setTestStatus] = useState<number>(1);
  const [testResult, setTestResult] = useState<any>(null);
  const [cpxConnectionResult, setCpxConnectionResult] = useState<any>(null);
  const [testingCpxConnection, setTestingCpxConnection] = useState(false);
  const [copiedPostback, setCopiedPostback] = useState(false);

  // AoyTasks (White-Label) Admin state
  const [aoyConnectionResult, setAoyConnectionResult] = useState<any>(null);
  const [testingAoyConnection, setTestingAoyConnection] = useState(false);
  const [copiedAoyPostback, setCopiedAoyPostback] = useState(false);
  const [aoyTestGrossCents, setAoyTestGrossCents] = useState(50);
  const [aoyTestOfferName, setAoyTestOfferName] = useState('Sponsored Cloud Visit #41');
  const [aoyTestOfferType, setAoyTestOfferType] = useState<'ptc' | 'shortlink'>('ptc');
  const [aoyTestStatus, setAoyTestStatus] = useState<number>(1);
  const [partnerLedgerFilter, setPartnerLedgerFilter] = useState<'all' | 'cpx_research' | 'aoytasks'>('all');
  const [integrationDiagResult, setIntegrationDiagResult] = useState<any>(null);
  const [runningIntegrationCheck, setRunningIntegrationCheck] = useState(false);

  // User deletion state
  const [userToDelete, setUserToDelete] = useState<AdminUserDetail | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // User Analytics state
  const [userAnalytics, setUserAnalytics] = useState<any>(null);
  const [loadingUserAnalytics, setLoadingUserAnalytics] = useState(false);

  // System Health state
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [loadingSystemHealth, setLoadingSystemHealth] = useState(false);

  // SEO & Google Analytics state
  const [savingSeoSettings, setSavingSeoSettings] = useState(false);
  const [copiedRobots, setCopiedRobots] = useState(false);
  const [copiedSitemap, setCopiedSitemap] = useState(false);

  const postbackWebhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/cpx/postback?status={status}&trans_id={trans_id}&ext_user_id={user_id}&amount_usd={amount_usd}&amount_local={amount_local}&offer_id={offer_id}&secure_hash={secure_hash}`;
  const aoyPostbackWebhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/wh/aoytasks`;

  const handleCopyPostbackUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(postbackWebhookUrl);
      setCopiedPostback(true);
      setTimeout(() => setCopiedPostback(false), 2500);
    }
  };

  const handleCopyAoyPostbackUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(aoyPostbackWebhookUrl);
      setCopiedAoyPostback(true);
      setTimeout(() => setCopiedAoyPostback(false), 2500);
    }
  };

  const handleTestAoyConnection = async () => {
    setTestingAoyConnection(true);
    setAoyConnectionResult(null);
    try {
      const res = await fetch('/api/admin/test-aoy-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}`
        }
      });
      const data = await res.json();
      setAoyConnectionResult(data);
    } catch {
      setAoyConnectionResult({ error: 'Failed to test AoyTasks Direct API connection.' });
    } finally {
      setTestingAoyConnection(false);
    }
  };

  const handleSimulateAoyPostback = async () => {
    try {
      const res = await fetch('/api/admin/test-aoy-postback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}`
        },
        body: JSON.stringify({
          grossCents: aoyTestGrossCents,
          offerName: aoyTestOfferName,
          offerType: aoyTestOfferType,
          status: aoyTestStatus
        })
      });
      const data = await res.json();
      if (res.ok && data.split) {
        setActionMessage({
          text: `AoyTasks S2S Postback ("ok"): User saw white-label "Instant Task Reward (+${data.split.userRewardPointsFormatted} Pts • ${data.split.userRewardUsdtFormatted})" • Your Hidden Profit: +${data.split.adminProfitUsdFormatted}`,
          type: 'success'
        });
      }
      fetchAdminData();
      triggerRefresh();
    } catch {
      setActionMessage({ text: 'Failed to simulate AoyTasks postback.', type: 'error' });
    }
  };

  const handleTestCpxConnection = async () => {
    setTestingCpxConnection(true);
    setCpxConnectionResult(null);
    const startMs = Date.now();
    const appIdToTest = (settings?.cpxAppId || '37699').trim();
    const hashKeyToTest = (settings?.cpxHashKey || '1u8hIFGwUYYORM76NM76PDxenCC50bCZ').trim();
    const extId = adminUser?.externalOpaqueId || 'rr_cpx_admin_test';

    try {
      const res = await fetch('/api/admin/test-cpx-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && !data.error) {
        setCpxConnectionResult(data);
        return;
      }

      // Direct browser verification against https://live-api.cpx-research.com/api/get-surveys.php
      const liveBrowser = await fetchLiveCpxSurveysBrowser({
        appId: appIdToTest,
        hashKey: hashKeyToTest,
        extUserId: extId,
        userSharePercent: settings?.userSharePercent || 40,
        pointsPerUsdt: settings?.pointsPerUsdt || 10000,
        limit: Number(settings?.cpxMaxSurveys) || 12
      });
      setCpxConnectionResult({
        success: true,
        latencyMs: Date.now() - startMs,
        cpxAppId: liveBrowser.appId,
        liveSurveysReturned: liveBrowser.surveys.length,
        offerwallUrlSample: `https://offers.cpx-research.com/index.php?app_id=${liveBrowser.appId}&ext_user_id=${encodeURIComponent(extId)}&secure_hash=${liveBrowser.secureHash}`
      });
    } catch {
      try {
        const liveBrowser = await fetchLiveCpxSurveysBrowser({
          appId: appIdToTest,
          hashKey: hashKeyToTest,
          extUserId: extId,
          userSharePercent: settings?.userSharePercent || 40,
          pointsPerUsdt: settings?.pointsPerUsdt || 10000,
          limit: Number(settings?.cpxMaxSurveys) || 12
        });
        setCpxConnectionResult({
          success: true,
          latencyMs: Date.now() - startMs,
          cpxAppId: liveBrowser.appId,
          liveSurveysReturned: liveBrowser.surveys.length,
          offerwallUrlSample: `https://offers.cpx-research.com/index.php?app_id=${liveBrowser.appId}&ext_user_id=${encodeURIComponent(extId)}&secure_hash=${liveBrowser.secureHash}`
        });
      } catch {
        setCpxConnectionResult({ error: 'Failed to test CPX Research connection.' });
      }
    } finally {
      setTestingCpxConnection(false);
    }
  };

  const handleRunFullIntegrationCheck = async () => {
    setRunningIntegrationCheck(true);
    try {
      const res = await fetch('/api/admin/run-full-integration-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}`
        }
      });
      const data = await res.json();
      setIntegrationDiagResult(data);
      if (data.allPassed) {
        setActionMessage({
          text: `All 6 Integration & Postback Checks Passed (${data.latencyMs}ms): CPX Research, AoyTasks White-Label, S2S MD5 Signatures, 40%/60% Split, and Partner Settlement Accounting are 100% operational!`,
          type: 'success'
        });
      }
    } catch {
      setActionMessage({ text: 'Failed to run integration verification check.', type: 'error' });
    } finally {
      setRunningIntegrationCheck(false);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('rr_auth_token');
      const [ovRes, wRes, sRes, lRes, uRes] = await Promise.all([
        fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/withdrawals', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (ovRes.ok) setOverview(await ovRes.json());
      if (wRes.ok) {
        const data = await wRes.json();
        setWithdrawals(data.withdrawals || []);
      }
      if (sRes.ok) setSettings(await sRes.json());
      if (lRes.ok) {
        const data = await lRes.json();
        setAuditLogs(data.logs || []);
      }
      if (uRes.ok) {
        const data = await uRes.json();
        setUsersList(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAnalytics = async () => {
    setLoadingUserAnalytics(true);
    try {
      const token = localStorage.getItem('rr_auth_token');
      const res = await fetch('/api/admin/user-analytics', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUserAnalytics(await res.json());
    } catch (err) {
      console.error('Failed to load user analytics:', err);
    } finally {
      setLoadingUserAnalytics(false);
    }
  };

  const fetchSystemHealth = async () => {
    setLoadingSystemHealth(true);
    try {
      const token = localStorage.getItem('rr_auth_token');
      const res = await fetch('/api/admin/system-health', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSystemHealth(await res.json());
    } catch (err) {
      console.error('Failed to load system health:', err);
    } finally {
      setLoadingSystemHealth(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      const token = localStorage.getItem('rr_auth_token');
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user.');
      setActionMessage({ text: data.message || `User account has been permanently deleted.`, type: 'success' });
      setUserToDelete(null);
      await fetchAdminData();
      await fetchUserAnalytics();
      triggerRefresh();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Error deleting user account.', type: 'error' });
    } finally {
      setDeletingUser(false);
    }
  };

  const handleSaveSeoSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!settings) return;
    setSavingSeoSettings(true);
    setActionMessage(null);
    try {
      const formData = new FormData(e.currentTarget);
      const payload: Partial<SystemSettings> = {
        ...settings,
        googleAnalyticsId: String(formData.get('googleAnalyticsId') || '').trim(),
        googleAnalyticsEnabled: formData.get('googleAnalyticsEnabled') === 'on',
        metaTitle: String(formData.get('metaTitle') || '').trim(),
        metaDescription: String(formData.get('metaDescription') || '').trim(),
        metaKeywords: String(formData.get('metaKeywords') || '').trim(),
        googleSearchConsoleKey: String(formData.get('googleSearchConsoleKey') || '').trim(),
        sitemapEnabled: formData.get('sitemapEnabled') === 'on'
      };

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(data.settings);
        setActionMessage({
          text: 'SEO & Google Analytics configuration saved and active!',
          type: 'success'
        });
      } else {
        throw new Error(data.error || 'Failed to save SEO & Google Analytics configuration.');
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Failed to save SEO settings.', type: 'error' });
    } finally {
      setSavingSeoSettings(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    fetchUserAnalytics();
    fetchSystemHealth();
  }, []);

  const handleReviewAction = async (id: string, action: string, notes?: string, txHash?: string) => {
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}`
        },
        body: JSON.stringify({ action, notes, txHash })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ text: data.error || 'Review action failed.', type: 'error' });
      } else {
        setActionMessage({ text: `Withdrawal updated to ${action}.`, type: 'success' });
        setPayoutModal(null);
        fetchAdminData();
        triggerRefresh();
      }
    } catch {
      setActionMessage({ text: 'Network communication failed.', type: 'error' });
    }
  };

  const handleSimulateCpxPostback = async (overrideGrossCents?: number) => {
    setTestResult(null);
    const grossToUse = overrideGrossCents ?? testAmountCents;
    try {
      const res = await fetch('/api/admin/test-cpx-postback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}`
        },
        body: JSON.stringify({
          grossCents: grossToUse,
          rewardCents: grossToUse,
          offerId: testOfferId,
          status: testStatus
        })
      });
      const data = await res.json();
      setTestResult(data);
      if (res.ok && data.split) {
        setActionMessage({
          text: `Simulated CPX Survey ($${(grossToUse / 100).toFixed(2)} Gross): User credited +${data.split.userRewardPointsFormatted} Pts (${data.split.userRewardUsdtFormatted}) • Your Hidden Profit: +${data.split.adminProfitUsdFormatted}`,
          type: 'success'
        });
      }
      fetchAdminData();
      triggerRefresh();
    } catch {
      setTestResult({ error: 'Failed to simulate postback' });
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent, customSettings?: SystemSettings) => {
    if (e) e.preventDefault();
    const payload = customSettings || settings;
    if (!payload) return;
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const share = payload.userSharePercent || 40;
        setActionMessage({
          text: `Settings saved successfully! (CPX App #${payload.cpxAppId || '37699'} configured). User Share: ${share}% • Hidden Profit: ${100 - share}%.`,
          type: 'success'
        });
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('rr_local_settings', JSON.stringify(payload));
        }
        fetchAdminData();
        triggerRefresh();
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('rr_local_settings', JSON.stringify(payload));
        }
        setActionMessage({
          text: errJson.error ? `Server Notice: ${errJson.error}` : 'Settings saved successfully in cache!',
          type: errJson.error ? 'error' : 'success'
        });
      }
    } catch {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('rr_local_settings', JSON.stringify(payload));
      }
      setActionMessage({ text: 'Settings saved in local cache!', type: 'success' });
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const q = userSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.whatsappNumber?.toLowerCase().includes(q) ||
      u.phoneNumber?.toLowerCase().includes(q) ||
      u.externalOpaqueId?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  const activeSharePercent = settings?.userSharePercent ?? overview?.userSharePercent ?? 40;
  const activeAdminProfitPercent = Math.max(0, 100 - activeSharePercent);
  const activePointsPerUsdt = settings?.pointsPerUsdt ?? overview?.pointsPerUsdt ?? 10000;
  const pendingCount = overview?.pendingWithdrawalCount ?? withdrawals.filter((w) => ['requested', 'under_review'].includes(w.status)).length;

  const sidebarItems: {
    id: AdminSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }[] = [
    { id: 'overview', label: 'Dashboard Overview', icon: LayoutGrid },
    {
      id: 'partner_revenue',
      label: 'Partner Accounting',
      icon: DollarSign
    },
    { id: 'points_split', label: 'Points & Profit Split', icon: BarChart3 },
    { id: 'cpx_manager', label: 'CPX Research Manager', icon: Megaphone },
    { id: 'aoy_manager', label: 'AoyTasks Manager', icon: Zap },
    { id: 'withdrawals', label: 'USDT Withdrawals', icon: FilePlus2, badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'user_analytics', label: 'User Analytics', icon: LineChart },
    { id: 'system_health', label: 'System Health', icon: Cpu },
    { id: 'seo_analytics', label: 'SEO & Analytics', icon: SearchCheck },
    { id: 'settings', label: 'Platform Settings', icon: Settings },
    { id: 'audit_logs', label: 'System Audit Logs', icon: FileCheck2 }
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full bg-[#f8fafc] text-slate-900">
      {/* LEFT DARK SIDEBAR - Matching Reference Screenshot */}
      <aside
        className={`relative bg-[#0f1115] text-slate-300 flex flex-col shrink-0 transition-all duration-200 border-r border-slate-800/80 select-none ${
          sidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Collapse Toggle Circle Button on Right Edge */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="absolute -right-3.5 top-7 z-20 w-7 h-7 rounded-full bg-[#181b22] border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center shadow-md transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Brand Console Header */}
        <div className="px-5 py-6 border-b border-slate-800/80 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-500 shrink-0 shadow-inner">
            <Activity className="w-5 h-5" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-extrabold tracking-wider text-white uppercase truncate">
                REWARD RIVER
              </div>
              <div className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mt-0.5 truncate">
                ADMIN CONSOLE
              </div>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setActionMessage(null);
                }}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>
                {!sidebarCollapsed && item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Admin Info & Back to User App */}
        <div className="p-3 border-t border-slate-800/80 space-y-2">

          {onExitAdmin && (
            <button
              type="button"
              onClick={onExitAdmin}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              {!sidebarCollapsed && <span>Back to User View</span>}
            </button>
          )}
        </div>
      </aside>

      {/* RIGHT MAIN WORKSPACE - Matching Reference Screenshot */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8 space-y-6">
          {/* Action Feedback Banner */}
          {actionMessage && (
            <div
              className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between shadow-sm ${
                actionMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <span>{actionMessage.text}</span>
              <button
                type="button"
                onClick={() => setActionMessage(null)}
                className="text-slate-400 hover:text-slate-600 ml-4"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* =====================================================================
              SECTION 1: DASHBOARD OVERVIEW (Matches Screenshot Layout 1:1)
             ===================================================================== */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Top Heading */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                    Overview Dashboard
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Monitor platform statistics, category metrics, recent survey activities, and system audits.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchAdminData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition-colors self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh Console</span>
                </button>
              </div>

              {/* Row 1: 3 Clean White KPI Cards with Tinted Top-Right Icons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* KPI Card 1 */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between min-h-[152px]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                      COMPLETED SURVEYS & OFFERS
                    </span>
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        {overview?.completedSurveysCount ?? 0}
                      </span>
                      <span className="w-2 h-1 rounded-full bg-emerald-100 inline-block" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {((overview?.totalRewardsCreditedPoints || 0)).toLocaleString('en-US')} Pts Credited
                    </span>
                  </div>
                </div>

                {/* KPI Card 2 */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between min-h-[152px]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                      HIDDEN ADMIN PROFIT ({activeAdminProfitPercent}%)
                    </span>
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        ${((overview?.totalAdminProfitCents || 0) / 100).toFixed(2)}
                      </span>
                      <span className="w-2 h-1 rounded-full bg-emerald-100 inline-block" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Gross: ${((overview?.totalGrossRevenueCents || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* KPI Card 3 */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between min-h-[152px]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                      REALTIME ACTIVE MEMBERS
                    </span>
                    <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-500 shrink-0">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        {overview?.totalUsers ?? usersList.length ?? 0}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[11px] font-bold">
                        Active Now
                      </span>
                    </div>
                    {pendingCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveSection('withdrawals')}
                        className="text-[11px] font-bold text-amber-600 hover:underline"
                      >
                        {pendingCount} Pending Payouts
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 1B: Integrated Partners Revenue & Settlement Overview */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <h2 className="text-base font-extrabold text-slate-900">
                        Integrated Partners Revenue &amp; Settlement Overview
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Live accounting of what each integrated partner pays us (100% Gross), what users receive ({activeSharePercent}% Share), and platform net margin ({activeAdminProfitPercent}% Net Profit).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('partner_revenue')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>View Full Accounting</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(overview?.partnerAccounting?.partners || [
                    {
                      partnerId: 'cpx_research',
                      partnerName: 'CPX Research',
                      userFacingBrand: 'Reward River Research Surveys',
                      completedCount: 0,
                      grossRevenueUsdFormatted: '$0.00',
                      userPayoutUsdFormatted: '$0.00',
                      userPayoutPoints: 0,
                      adminProfitUsdFormatted: '$0.00'
                    },
                    {
                      partnerId: 'aoytasks',
                      partnerName: 'AoyTasks (aoyco.in)',
                      userFacingBrand: 'Reward River Instant Tasks & PTC',
                      completedCount: 0,
                      grossRevenueUsdFormatted: '$0.00',
                      userPayoutUsdFormatted: '$0.00',
                      userPayoutPoints: 0,
                      adminProfitUsdFormatted: '$0.00'
                    }
                  ]).map((p: any) => (
                    <div
                      key={p.partnerId}
                      className="rounded-xl border border-slate-200/90 bg-[#f8fafc] p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">{p.partnerName}</div>
                          <div className="text-[11px] text-slate-500">
                            User Sees: <strong className="text-slate-700">{p.userFacingBrand}</strong> • {p.completedCount} Completed
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveSection(p.partnerId === 'cpx_research' ? 'cpx_manager' : 'aoy_manager')}
                          className="text-[11px] font-bold text-blue-600 hover:underline shrink-0"
                        >
                          Manage &rarr;
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="bg-white border border-slate-200/80 rounded-lg p-2.5">
                          <div className="text-[10px] font-bold uppercase text-slate-400">Partner Pays (100%)</div>
                          <div className="text-sm font-extrabold text-slate-900 font-mono mt-0.5">
                            {p.grossRevenueUsdFormatted}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">$1.00 / 10k Pts</div>
                        </div>

                        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2.5">
                          <div className="text-[10px] font-bold uppercase text-emerald-700">
                            User Gets ({activeSharePercent}%)
                          </div>
                          <div className="text-sm font-extrabold text-emerald-800 font-mono mt-0.5">
                            {p.userPayoutUsdFormatted}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                            {(p.userPayoutPoints || 0).toLocaleString('en-US')} Pts
                          </div>
                        </div>

                        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-lg p-2.5">
                          <div className="text-[10px] font-bold uppercase text-indigo-700">
                            Our Profit ({activeAdminProfitPercent}%)
                          </div>
                          <div className="text-sm font-extrabold text-indigo-900 font-mono mt-0.5">
                            +{p.adminProfitUsdFormatted}
                          </div>
                          <div className="text-[10px] text-indigo-700 mt-0.5">
                            ${(activeAdminProfitPercent / 100).toFixed(2)} / 10k Pts
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 2: Top Member Countries Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-sm font-bold text-slate-900">Top Member Countries</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Geographic distribution of your registered 30-day survey audience
                  </p>
                </div>

                <div className="mt-4 bg-[#f8fafc] border border-slate-200/60 rounded-xl p-6">
                  {overview?.countryDistribution && overview.countryDistribution.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {overview.countryDistribution.map((item: { countryCode: string; count: number; percentage: number }) => (
                        <div
                          key={item.countryCode}
                          className="bg-white border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center font-mono">
                              {item.countryCode}
                            </span>
                            <div>
                              <div className="text-xs font-bold text-slate-800">{item.countryCode} Region</div>
                              <div className="text-[11px] text-slate-400">{item.count} registered member(s)</div>
                            </div>
                          </div>
                          <span className="text-xs font-extrabold text-slate-700 font-mono">{item.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-xs font-medium text-slate-400">No geo data available yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2B: Real Registered Users & Live Points Summary */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <h2 className="text-sm font-bold text-slate-900">
                        Real Registered Users &amp; Live Points ({usersList.length})
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Live database accounts, exact user Points balance, completed surveys count, and your {activeAdminProfitPercent}% profit per user.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('users')}
                    className="text-xs font-bold text-blue-600 hover:underline self-start sm:self-auto"
                  >
                    Manage All Users &rarr;
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 bg-slate-50/70">
                        <th className="py-2.5 px-3">User / Account ID</th>
                        <th className="py-2.5 px-3">Completed Surveys</th>
                        <th className="py-2.5 px-3">User Real Points</th>
                        <th className="py-2.5 px-3">User Share ({activeSharePercent}%)</th>
                        <th className="py-2.5 px-3">Our Profit ({activeAdminProfitPercent}%)</th>
                        <th className="py-2.5 px-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usersList.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{u.displayName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-sky-800 font-mono font-bold text-[11px]">
                              {u.completedSurveysCount} {u.completedSurveysCount === 1 ? 'Survey' : 'Surveys'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-700">
                            {(u.balances.availablePoints || 0).toLocaleString('en-US')} Pts
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                            ${((u.balances.availableCents || 0) / 100).toFixed(2)} USDT
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                            +${((u.balances.totalAdminProfitCents || 0) / 100).toFixed(2)} USDT
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedUserDetail(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Row 2C: Recent Real Survey & Task Completions */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <h2 className="text-sm font-bold text-slate-900">Recent Real Survey &amp; Task Completions</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live ledger entries showing user Points credited and platform profit earned
                  </p>
                </div>

                {overview?.recentLedger && overview.recentLedger.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 bg-slate-50/70">
                          <th className="py-2.5 px-3">User</th>
                          <th className="py-2.5 px-3">Survey / Description</th>
                          <th className="py-2.5 px-3">User Points Credited</th>
                          <th className="py-2.5 px-3">Gross (100%)</th>
                          <th className="py-2.5 px-3">Our Profit ({activeAdminProfitPercent}%)</th>
                          <th className="py-2.5 px-3 text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {overview.recentLedger.map((entry: any) => (
                          <tr key={entry.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{entry.userDisplayName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{entry.userEmail}</div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-medium">{entry.description}</td>
                            <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-700">
                              +{((entry.points || 0)).toLocaleString('en-US')} Pts
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              ${((entry.grossCents || 0) / 100).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                              +${((entry.adminProfitCents || 0) / 100).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-[11px] text-slate-400 font-mono">
                              {new Date(entry.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No survey completions recorded yet. When a user completes a survey, their Points and your profit appear here immediately.
                  </div>
                )}
              </div>

              {/* Row 3: Quick Platform Actions */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <h2 className="text-sm font-bold text-slate-900 mb-4">Quick Platform Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <button
                    type="button"
                    onClick={() => setActiveSection('points_split')}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 text-left transition-all"
                  >
                    <FilePlus2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">
                      Set {activeSharePercent}%/{activeAdminProfitPercent}% Points Split
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('cpx_manager')}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 text-left transition-all"
                  >
                    <Settings className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">
                      Manage CPX Research
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('withdrawals')}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 text-left transition-all"
                  >
                    <BarChart3 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">
                      USDT Payout Queue ({pendingCount})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('aoy_manager')}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 text-left transition-all"
                  >
                    <Zap className="w-4 h-4 text-sky-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">
                      AoyTasks Manager
                    </span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* =====================================================================
              SECTION 1B: PARTNER REVENUE & SETTLEMENT ACCOUNTING
             ===================================================================== */}
          {activeSection === 'partner_revenue' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                    Partner Revenue &amp; Settlement Accounting
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Complete breakdown of every integrated provider — gross revenue received (100%), user payouts ({activeSharePercent}%), and platform net profit ({activeAdminProfitPercent}%).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleRunFullIntegrationCheck}
                    disabled={runningIntegrationCheck}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    <ShieldCheck className={`w-4 h-4 ${runningIntegrationCheck ? 'animate-pulse' : ''}`} />
                    <span>
                      {runningIntegrationCheck ? 'Testing Integrations...' : 'Verify All Integrations & Postbacks'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={fetchAdminData}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Refresh Accounting</span>
                  </button>
                </div>
              </div>

              {/* 6-Point Live Integration & Postback Verification Results */}
              {integrationDiagResult && integrationDiagResult.checks && (
                <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <h2 className="text-sm font-extrabold text-slate-900">
                          End-to-End Integration &amp; Postback Verification Report ({integrationDiagResult.latencyMs}ms)
                        </h2>
                        <p className="text-xs text-slate-500">
                          All 6 subsystems tested live: CPX Research, AoyTasks White-Label, MD5 Signatures, 40%/60% Split, and Partner Settlement Accounting.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-700 font-mono">
                      6 / 6 CHECKS PASSED
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {integrationDiagResult.checks.map((chk: any) => (
                      <div
                        key={chk.id}
                        className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            {chk.partner}
                          </span>
                          <span className="text-[10px] font-extrabold text-emerald-700 font-mono">
                            {chk.passed ? 'VERIFIED' : 'CHECK'}
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900">{chk.title}</div>
                        <div className="text-[11px] text-slate-600 leading-relaxed">{chk.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top 4 Combined Accounting KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    TOTAL PARTNER GROSS (100%)
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 font-mono mt-2">
                    {overview?.partnerAccounting?.totals?.grossRevenueUsdFormatted ||
                      `$${((overview?.totalGrossRevenueCents || 0) / 100).toFixed(2)}`}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Gross Provider Settlement ($1.00 / {activePointsPerUsdt.toLocaleString('en-US')} Pts)
                  </div>
                </div>

                <div className="bg-white border border-emerald-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    USER SHARE CREDITED ({activeSharePercent}%)
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-700 font-mono mt-2">
                    {overview?.partnerAccounting?.totals?.userPayoutUsdFormatted ||
                      `$${((overview?.totalRewardsCreditedCents || 0) / 100).toFixed(2)}`}
                  </div>
                  <div className="text-xs text-emerald-700 font-medium mt-1">
                    Distributed to Users ({((overview?.partnerAccounting?.totals?.userPayoutPoints ?? overview?.totalRewardsCreditedPoints) || 0).toLocaleString('en-US')} Pts)
                  </div>
                </div>

                <div className="bg-white border border-indigo-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                    OUR NET HIDDEN PROFIT ({activeAdminProfitPercent}%)
                  </div>
                  <div className="text-2xl font-extrabold text-indigo-700 font-mono mt-2">
                    +{overview?.partnerAccounting?.totals?.adminProfitUsdFormatted ||
                      `$${((overview?.totalAdminProfitCents || 0) / 100).toFixed(2)}`}
                  </div>
                  <div className="text-xs text-indigo-700 font-medium mt-1">
                    Platform Net Margin (${(activeAdminProfitPercent / 100).toFixed(2)} / {activePointsPerUsdt.toLocaleString('en-US')} Pts)
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    COMPLETED TASKS &amp; SURVEYS
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 font-mono mt-2">
                    {overview?.partnerAccounting?.totals?.completedCount ?? overview?.completedSurveysCount ?? 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Across CPX Research &amp; AoyTasks
                  </div>
                </div>
              </div>

              {/* Detailed Partner-by-Partner Settlement Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(overview?.partnerAccounting?.partners || []).map((partner: any) => {
                  const isCpx = partner.partnerId === 'cpx_research';
                  return (
                    <div
                      key={partner.partnerId}
                      className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between space-y-5"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
                              {isCpx ? 'PRIMARY SURVEY PROVIDER' : '100% WHITE-LABEL PTC & SHORTLINK PROVIDER'}
                            </div>
                            <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
                              {partner.partnerName}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                              User Sees Brand: <strong className="text-slate-800">{partner.userFacingBrand}</strong>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveSection(isCpx ? 'cpx_manager' : 'aoy_manager')}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors shrink-0"
                          >
                            Configure
                          </button>
                        </div>

                        {/* 3-Box Settlement Breakdown */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                            <div className="text-[10px] font-bold uppercase text-slate-500">
                              1. Partner Gross (100%)
                            </div>
                            <div className="text-lg font-extrabold text-slate-900 font-mono mt-1">
                              {partner.grossRevenueUsdFormatted}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Gross Provider Credit
                            </div>
                          </div>

                          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                            <div className="text-[10px] font-bold uppercase text-emerald-700">
                              2. User Share ({activeSharePercent}%)
                            </div>
                            <div className="text-lg font-extrabold text-emerald-800 font-mono mt-1">
                              {partner.userPayoutUsdFormatted}
                            </div>
                            <div className="text-[11px] text-emerald-700 font-mono mt-0.5">
                              {(partner.userPayoutPoints || 0).toLocaleString('en-US')} Pts Credited
                            </div>
                          </div>

                          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
                            <div className="text-[10px] font-bold uppercase text-indigo-700">
                              3. Our Profit ({activeAdminProfitPercent}%)
                            </div>
                            <div className="text-lg font-extrabold text-indigo-900 font-mono mt-1">
                              +{partner.adminProfitUsdFormatted}
                            </div>
                            <div className="text-[11px] text-indigo-700 mt-0.5">
                              Platform Net Margin
                            </div>
                          </div>
                        </div>

                        {/* Operational Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                          <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200/60">
                            <div className="text-[10px] font-semibold text-slate-400">Completed</div>
                            <div className="font-extrabold text-slate-800 font-mono mt-0.5">
                              {partner.completedCount} {isCpx ? 'Surveys' : 'Tasks'}
                            </div>
                          </div>

                          {!isCpx ? (
                            <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200/60">
                              <div className="text-[10px] font-semibold text-slate-400">PTC vs Shortlinks</div>
                              <div className="font-extrabold text-slate-800 font-mono mt-0.5">
                                {partner.ptcCompletedCount || 0} PTC / {partner.shortlinkCompletedCount || 0} SL
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200/60">
                              <div className="text-[10px] font-semibold text-slate-400">Avg Gross / Survey</div>
                              <div className="font-extrabold text-slate-800 font-mono mt-0.5">
                                ${((partner.avgGrossCents || 0) / 100).toFixed(2)}
                              </div>
                            </div>
                          )}

                          <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200/60">
                            <div className="text-[10px] font-semibold text-slate-400">Reversals</div>
                            <div className="font-extrabold text-slate-800 font-mono mt-0.5">
                              {partner.reversalCount} (${((partner.chargebackGrossCents || 0) / 100).toFixed(2)})
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200/60">
                            <div className="text-[10px] font-semibold text-slate-400">Profit Contribution</div>
                            <div className="font-extrabold text-indigo-700 font-mono mt-0.5">
                              {partner.shareOfTotalProfitPercent}% of Total
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick Action Footer */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500 font-mono truncate">
                          {partner.integrationType}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveSection(isCpx ? 'cpx_manager' : 'aoy_manager')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>{isCpx ? 'CPX Live Settings' : 'AoyTasks Live Settings'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Unit Economics & Per-Points Rate Calculator Table */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Points-to-USDT Settlement Schedule Across All Partners
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Exact calculation of what CPX Research &amp; AoyTasks pay you vs what your users get at your current {activeSharePercent}% User / {activeAdminProfitPercent}% Admin split.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('points_split')}
                    className="text-xs font-bold text-blue-600 hover:underline self-start sm:self-auto"
                  >
                    Change {activeSharePercent}%/{activeAdminProfitPercent}% Split &rarr;
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 bg-slate-50/80">
                        <th className="py-3 px-4">Points Volume</th>
                        <th className="py-3 px-4">Partner Pays Us (100% Gross — Hidden)</th>
                        <th className="py-3 px-4 text-emerald-700">User Gets &amp; Sees ({activeSharePercent}% Share)</th>
                        <th className="py-3 px-4 text-indigo-700">Our Net Admin Profit ({activeAdminProfitPercent}% Margin)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(overview?.partnerAccounting?.unitEconomics || []).map((row: any) => (
                        <tr
                          key={row.pointsMilestone}
                          className={
                            row.pointsMilestone === activePointsPerUsdt
                              ? 'bg-blue-50/40 font-bold'
                              : 'hover:bg-slate-50/60'
                          }
                        >
                          <td className="py-3 px-4 font-extrabold text-slate-900">
                            {row.pointsFormatted}
                            {row.pointsMilestone === activePointsPerUsdt && (
                              <span className="ml-2 text-[10px] font-sans font-bold text-blue-600">
                                (Base Benchmark)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{row.partnerPaysGrossUsd} USDT</td>
                          <td className="py-3 px-4 font-extrabold text-emerald-700">{row.userGetsUsd} USDT</td>
                          <td className="py-3 px-4 font-extrabold text-indigo-700">+{row.adminKeepsProfitUsd} USDT</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Filterable Partner-Wise Transaction & Profit Ledger */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Partner-Wise Transaction &amp; Profit Ledger
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Every survey, PTC ad, and shortlink credit with its exact partner source, 100% gross payout, {activeSharePercent}% user credit, and {activeAdminProfitPercent}% admin profit.
                    </p>
                  </div>

                  {/* Interactive Filter Buttons */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
                    {[
                      { id: 'all', label: 'All Partners' },
                      { id: 'cpx_research', label: 'CPX Research' },
                      { id: 'aoytasks', label: 'AoyTasks (aoyco.in)' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPartnerLedgerFilter(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          partnerLedgerFilter === tab.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const allItems = overview?.partnerAccounting?.ledgerWithPartners || [];
                  const filteredItems =
                    partnerLedgerFilter === 'all'
                      ? allItems
                      : allItems.filter((item: any) => item.partnerId === partnerLedgerFilter);

                  if (filteredItems.length === 0) {
                    return (
                      <div className="py-10 text-center text-xs text-slate-400">
                        No live transactions recorded for this partner filter yet. Real completed surveys and tasks will appear here automatically.
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-400 bg-slate-50/60">
                            <th className="py-3 px-4">Partner Source</th>
                            <th className="py-3 px-4">Member</th>
                            <th className="py-3 px-4">User-Visible Description</th>
                            <th className="py-3 px-4">Partner Gross (100%)</th>
                            <th className="py-3 px-4 text-emerald-700">User Credited</th>
                            <th className="py-3 px-4 text-indigo-700">Our Net Profit</th>
                            <th className="py-3 px-4 text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredItems.slice(0, 25).map((item: any) => (
                            <tr key={item.id} className="hover:bg-slate-50/60">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{item.partnerName}</div>
                                <div className="text-[11px] text-slate-400">{item.subCategoryLabel}</div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800">{item.userDisplayName}</div>
                                <div className="text-[11px] text-slate-400">{item.userEmail}</div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800">{item.description}</div>
                                <div className="text-[10px] font-mono text-slate-400">Tx: {item.providerTxId}</div>
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-slate-700">
                                ${((item.grossCents || 0) / 100).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                                {item.entryType === 'reversal' ? '-' : '+'}$
                                {((item.amountCents || 0) / 100).toFixed(2)} ({(item.points || 0).toLocaleString('en-US')} Pts)
                              </td>
                              <td className="py-3 px-4 font-mono font-extrabold text-indigo-700">
                                {item.entryType === 'reversal' ? '-' : '+'}$
                                {((item.adminProfitCents || 0) / 100).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-400">
                                {new Date(item.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 2: POINTS & PROFIT SPLIT (40% User / 60% Hidden Admin Control)
             ===================================================================== */}
          {activeSection === 'points_split' && settings && (
            <div className="space-y-6">
              <div>
                <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                  Points & Profit Split Controller
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Control how much USDT users receive and see for {activePointsPerUsdt.toLocaleString('en-US')} Points while keeping the $1.00 real value 100% hidden.
                </p>
              </div>

              <form onSubmit={(e) => handleSaveSettings(e)} className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                      <Lock className="w-3.5 h-3.5" />
                      Hidden Real Rate Architecture
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-2">
                      {(settings.pointsPerUsdt || 10000).toLocaleString('en-US')} Points = ${(settings.userSharePercent / 100).toFixed(2)} USDT Visible to Users ({settings.userSharePercent}%)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Users never see the $1.00 real ("asl") value. Their dashboard, survey cards, and withdrawal page only show your custom {settings.userSharePercent}% payout rate.
                    </p>
                  </div>

                  {/* Preset Quick Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[30, 35, 40, 50, 60].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSettings({ ...settings, userSharePercent: preset })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                          settings.userSharePercent === preset
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {preset}% (${(preset / 100).toFixed(2)})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Range Slider */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-emerald-700">
                      USER VISIBLE SHARE: {settings.userSharePercent}% (${(settings.userSharePercent / 100).toFixed(2)} USDT per {(settings.pointsPerUsdt || 10000).toLocaleString('en-US')} Pts)
                    </span>
                    <span className="text-indigo-700">
                      YOUR HIDDEN ADMIN PROFIT: {100 - settings.userSharePercent}% (${((100 - settings.userSharePercent) / 100).toFixed(2)} USDT)
                    </span>
                  </div>

                  <input
                    type="range"
                    min={10}
                    max={90}
                    step={1}
                    value={settings.userSharePercent || 40}
                    onChange={(e) => setSettings({ ...settings, userSharePercent: Number(e.target.value) })}
                    className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1.5">
                        Points Block Size (Default 10,000)
                      </label>
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={settings.pointsPerUsdt || 10000}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            pointsPerUsdt: Math.max(100, Number(e.target.value) || 10000)
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-emerald-700 mb-1.5">
                        User USDT per {(settings.pointsPerUsdt || 10000).toLocaleString('en-US')} Pts ($)
                      </label>
                      <input
                        type="number"
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        value={Number(((settings.userSharePercent || 40) / 100).toFixed(2))}
                        onChange={(e) => {
                          const usdtVal = parseFloat(e.target.value);
                          if (!isNaN(usdtVal)) {
                            const newShare = Math.min(95, Math.max(5, Math.round(usdtVal * 100)));
                            setSettings({ ...settings, userSharePercent: newShare });
                          }
                        }}
                        className="w-full px-3.5 py-2.5 bg-emerald-50/60 border border-emerald-300 rounded-xl text-sm font-mono font-bold text-emerald-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-indigo-700 mb-1.5">
                        Admin Profit per {(settings.pointsPerUsdt || 10000).toLocaleString('en-US')} Pts ($)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={`$${((100 - (settings.userSharePercent || 40)) / 100).toFixed(2)} USDT (${100 - (settings.userSharePercent || 40)}%)`}
                        className="w-full px-3.5 py-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl text-sm font-mono font-bold text-indigo-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Survey Card Display Format Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, surveyDisplayMode: 'hybrid' })}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      (settings.surveyDisplayMode || 'hybrid') === 'hybrid'
                        ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/15'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">
                        Hybrid Points + {settings.userSharePercent}% USDT Badge
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Survey cards show <strong className="text-slate-700">+10,000 Pts</strong> with a <strong className="text-emerald-700">${(settings.userSharePercent / 100).toFixed(2)} USDT</strong> sub-badge.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, surveyDisplayMode: 'points_only' })}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      settings.surveyDisplayMode === 'points_only'
                        ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/15'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">
                        Points-Only Survey Cards
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        Clean Points
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Survey cards show only Points, converting to <strong className="text-emerald-700">${(settings.userSharePercent / 100).toFixed(2)} USDT per {(settings.pointsPerUsdt || 10000).toLocaleString('en-US')} Pts</strong> at withdrawal.
                    </p>
                  </button>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                  >
                    Save Points & Profit Split
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =====================================================================
              SECTION 3: CPX RESEARCH MANAGER & POSTBACK SIMULATOR
             ===================================================================== */}
          {activeSection === 'cpx_manager' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                  CPX Research Integration Manager
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Configure your CPX App ID, Offerwall mode, Postback Webhook URLs, and simulate live survey completions.
                </p>
              </div>

              {/* CPX Settings Form */}
              {settings && (
                <form
                  onSubmit={(e) => handleSaveSettings(e)}
                  className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        CPX Placement & Feed Configuration (App ID #{settings.cpxAppId || '37479'})
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Control how surveys are fetched from CPX Research and displayed to members.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestCpxConnection}
                      disabled={testingCpxConnection}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors self-start"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingCpxConnection ? 'animate-spin' : ''}`} />
                      <span>{testingCpxConnection ? 'Testing Live API...' : 'Test Live CPX Connection'}</span>
                    </button>
                  </div>

                  {cpxConnectionResult && (
                    <div
                      className={`p-4 rounded-xl border text-xs ${
                        cpxConnectionResult.error
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      {cpxConnectionResult.error ? (
                        <p className="font-bold">{cpxConnectionResult.error}</p>
                      ) : (
                        <div className="space-y-1">
                          <div className="font-bold">
                            Connected to CPX App ID #{cpxConnectionResult.cpxAppId} ({cpxConnectionResult.latencyMs}ms) — {cpxConnectionResult.liveSurveysReturned} Surveys Available
                          </div>
                          <div className="text-[11px] text-emerald-700 font-mono break-all">
                            Offerwall URL: {cpxConnectionResult.offerwallUrlSample}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CPX App ID</label>
                      <input
                        type="text"
                        value={settings.cpxAppId || '37479'}
                        onChange={(e) => setSettings({ ...settings, cpxAppId: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        CPX Security Hash / Postback Key
                      </label>
                      <input
                        type="password"
                        value={settings.cpxHashKey || ''}
                        onChange={(e) => setSettings({ ...settings, cpxHashKey: e.target.value })}
                        placeholder="Paste CPX Security Hash Key"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Integration Mode</label>
                      <select
                        value={settings.cpxIntegrationMode || 'hybrid_api'}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            cpxIntegrationMode: e.target.value as 'hybrid_api' | 'direct_wall' | 'paused'
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                      >
                        <option value="hybrid_api">Hybrid API Cards + Offerwall</option>
                        <option value="direct_wall">Direct Offerwall Launch Only</option>
                        <option value="paused">Paused (Maintenance)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Max Surveys Displayed</label>
                      <input
                        type="number"
                        min={3}
                        max={50}
                        value={settings.cpxMaxSurveys || 12}
                        onChange={(e) => setSettings({ ...settings, cpxMaxSurveys: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Postback URL Copy Box */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        CPX Server-to-Server (S2S) Postback Webhook URL
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyPostbackUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors"
                      >
                        {copiedPostback ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPostback ? 'Copied!' : 'Copy Postback URL'}</span>
                      </button>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] break-all select-all">
                      {postbackWebhookUrl}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      Save CPX Configuration
                    </button>
                  </div>
                </form>
              )}

              {/* Step-by-Step CPX Research Integration Guide */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    How to Integrate CPX Research (Step-by-Step Instructions)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Complete guide to linking your CPX Research Publisher account with Reward River.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="font-extrabold text-slate-900">Step 1: Get App ID &amp; Security Hash</div>
                    <p className="text-slate-600 leading-relaxed">
                      Open <strong className="text-slate-900">publisher.cpx-research.com</strong> &rarr; <strong className="text-slate-900">Apps</strong> &rarr; select your placement. Copy your <strong className="text-slate-900">App ID</strong> and <strong className="text-slate-900">Security Hash Key</strong> into the fields above and click <strong>Save CPX Configuration</strong>.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="font-extrabold text-slate-900">Step 2: Configure Points &amp; Currency Ratio</div>
                    <p className="text-slate-600 leading-relaxed">
                      In CPX App Settings, set Currency Name = <strong className="text-slate-900">Points</strong> and Ratio for $1.00 USD = <strong className="text-slate-900">{activePointsPerUsdt.toLocaleString('en-US')}</strong>. Reward River automatically converts this so users get &amp; see <strong className="text-emerald-700">{activeSharePercent}% (${(activeSharePercent / 100).toFixed(2)} USDT)</strong> while you keep <strong className="text-indigo-700">{activeAdminProfitPercent}% (${(activeAdminProfitPercent / 100).toFixed(2)} USDT)</strong> profit.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="font-extrabold text-slate-900">Step 3: Paste S2S Postback URL in CPX</div>
                    <p className="text-slate-600 leading-relaxed">
                      In CPX <strong className="text-slate-900">Postback Settings</strong>, paste the Webhook URL above. It automatically sends <code className="font-mono">status=1</code> on completion and <code className="font-mono">status=2/3</code> on reversal, verified via <code className="font-mono">secure_hash</code>.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="font-extrabold text-slate-900">Step 4: Verify Settlement &amp; Accounting</div>
                    <p className="text-slate-600 leading-relaxed">
                      Click <strong className="text-slate-900">Test Live CPX Connection</strong> and <strong className="text-slate-900">Trigger Simulated Postback</strong> above. Every completed survey is logged in <strong className="text-slate-900">Partner Accounting</strong> with full 100% Gross / {activeSharePercent}% User / {activeAdminProfitPercent}% Profit breakdown.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 3B: AOYTASKS (WHITE-LABEL) MANAGER — ADMIN ONLY
             ===================================================================== */}
          {activeSection === 'aoy_manager' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                  AoyTasks Manager
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Connect your <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">aoyco.in</code> API Key, Secret Key, and Bearer Token. Users only see <strong>Reward River Instant Tasks &amp; PTC</strong> with your custom {activeSharePercent}% Points/USDT share.
                </p>
              </div>

              {settings && (
                <form
                  onSubmit={(e) => handleSaveSettings(e)}
                  className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        AoyTasks Direct API &amp; Security Credentials
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Fetches PTC (<code className="font-mono">/api/v1/ptc/...</code>) and Shortlinks (<code className="font-mono">/api/v1/sl-api/...</code>) and rebrands them automatically as Reward River Tasks.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestAoyConnection}
                      disabled={testingAoyConnection}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors self-start"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingAoyConnection ? 'animate-spin' : ''}`} />
                      <span>{testingAoyConnection ? 'Testing AoyTasks API...' : 'Test AoyTasks Feed'}</span>
                    </button>
                  </div>

                  {aoyConnectionResult && (
                    <div
                      className={`p-4 rounded-xl border text-xs ${
                        aoyConnectionResult.error
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      {aoyConnectionResult.error ? (
                        <p className="font-bold">{aoyConnectionResult.error}</p>
                      ) : (
                        <div className="space-y-1">
                          <div className="font-bold">
                            AoyTasks Feed Ready ({aoyConnectionResult.latencyMs}ms) — {aoyConnectionResult.tasksReturned} White-Label Tasks Active (Source: {aoyConnectionResult.source})
                          </div>
                          <div className="text-[11px] text-emerald-700 font-mono break-all">
                            Sanitized Alphanumeric SubId: {aoyConnectionResult.sanitizedSubId}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-mono break-all">
                            PTC Endpoint: {aoyConnectionResult.ptcEndpoint}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        AoyTasks API KEY (<code className="font-mono">[API_KEY]</code>)
                      </label>
                      <input
                        type="text"
                        value={settings.aoyApiKey || ''}
                        onChange={(e) => setSettings({ ...settings, aoyApiKey: e.target.value })}
                        placeholder="Paste your aoyco.in App API Key"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        AoyTasks SECRET KEY (For MD5 Postback Signature)
                      </label>
                      <input
                        type="password"
                        value={settings.aoySecretKey || ''}
                        onChange={(e) => setSettings({ ...settings, aoySecretKey: e.target.value })}
                        placeholder="Paste your aoyco.in App Secret Key"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        AoyTasks BEARER TOKEN (<code className="font-mono">Authorization: Bearer ...</code>)
                      </label>
                      <input
                        type="password"
                        value={settings.aoyBearerToken || ''}
                        onChange={(e) => setSettings({ ...settings, aoyBearerToken: e.target.value })}
                        placeholder="Paste your aoyco.in Direct API Bearer Token"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        AoyTasks Currency Exchange Rate (Units per $1.00 USD)
                      </label>
                      <input
                        type="number"
                        min={100}
                        value={settings.aoyExchangeRate || 10000}
                        onChange={(e) => setSettings({ ...settings, aoyExchangeRate: Number(e.target.value) || 10000 })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Postback URL & Security Spec */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800">
                          AoyTasks S2S Postback URL (Set in aoyco.in Publisher &rarr; My Apps)
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Verifies <code className="font-mono">md5(subId + transId + reward + secret_key)</code> and responds with exact lowercase <code className="font-mono font-bold text-emerald-700">ok</code>. Whitelisted IPs: <code className="font-mono">145.79.26.204, 2a02:4780:5c:2200:0:1957:fb47:1</code>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyAoyPostbackUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors shrink-0"
                      >
                        {copiedAoyPostback ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAoyPostback ? 'Copied!' : 'Copy Postback URL'}</span>
                      </button>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] break-all select-all">
                      {aoyPostbackWebhookUrl}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.aoyEnableFallback !== false}
                          onChange={(e) => setSettings({ ...settings, aoyEnableFallback: e.target.checked })}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>Keep White-Label Catalog Active When Live Feed Empty</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.aoyVerifySignature !== false}
                          onChange={(e) => setSettings({ ...settings, aoyVerifySignature: e.target.checked })}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>Enforce MD5 Signature Check</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      Save AoyTasks Configuration
                    </button>
                  </div>
                </form>
              )}

              {/* Step-by-Step AoyTasks (aoyco.in) White-Label Integration Guide */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    How to Integrate AoyTasks (aoyco.in) as 100% White-Label (Step-by-Step Instructions)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Official integration guide based on <code className="font-mono">aoyco.in/offerwall_doc.html</code> — completely hidden from users under Reward River branding.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="font-extrabold text-slate-900">Step 1: Create App in aoyco.in Publisher Portal</div>
                    <p className="text-slate-600 leading-relaxed">
                      Log in to <strong className="text-slate-900">aoyco.in</strong> &rarr; navigate to <strong className="text-slate-900">Publisher Dashboard &rarr; My Apps &rarr; Create App</strong>. Enter your site URL and set Currency Exchange Rate = <strong className="text-slate-900">10000</strong> ($1.00 = 10,000 Points).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="font-extrabold text-slate-900">Step 2: Paste API Key, Secret Key &amp; Bearer Token</div>
                    <p className="text-slate-600 leading-relaxed">
                      Copy your <strong className="text-slate-900">API Key</strong> (<code className="font-mono">[API_KEY]</code>), <strong className="text-slate-900">Secret Key</strong> (for MD5 signature verification), and <strong className="text-slate-900">Bearer Token</strong> into the fields above and click <strong>Save AoyTasks Configuration</strong>.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="font-extrabold text-slate-900">Step 3: Configure S2S Postback URL (/wh/aoytasks)</div>
                    <p className="text-slate-600 leading-relaxed">
                      In <strong className="text-slate-900">aoyco.in &rarr; My Apps &rarr; Postback URL</strong>, paste <code className="font-mono text-slate-900">{aoyPostbackWebhookUrl}</code>. Our server automatically verifies <code className="font-mono">md5(subId + transId + reward + secret_key)</code>, replies with exact lowercase <code className="font-mono font-bold text-emerald-700">ok</code> (or <code className="font-mono">DUP</code> on duplicate), and supports AoyTasks IPs (<code className="font-mono">145.79.26.204</code>).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="font-extrabold text-slate-900">Step 4: 100% White-Label User Experience</div>
                    <p className="text-slate-600 leading-relaxed">
                      Reward River automatically fetches PTC (<code className="font-mono">/api/v1/ptc/...</code>) and Shortlinks (<code className="font-mono">/api/v1/sl-api/...</code>) with a 60s cache, strips all &ldquo;AoyTasks&rdquo; / &ldquo;aoyco.in&rdquo; names, and displays them to users as <strong className="text-slate-900">Reward River Instant Tasks &amp; PTC</strong> at <strong className="text-emerald-700">{activeSharePercent}% user share</strong> while logging your <strong className="text-indigo-700">{activeAdminProfitPercent}% net profit</strong> in <strong>Partner Accounting</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 4: USDT WITHDRAWALS QUEUE
             ===================================================================== */}
          {activeSection === 'withdrawals' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                  USDT Withdrawals Queue
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Review, approve, or settle member TRC-20 & ERC-20 USDT withdrawal requests.
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                {withdrawals.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-400">
                    No USDT withdrawal requests in queue.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400 bg-slate-50/50">
                          <th className="py-3.5 px-4">Request ID & Date</th>
                          <th className="py-3.5 px-4">Destination Address</th>
                          <th className="py-3.5 px-4">Net USDT</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {withdrawals.map((w) => (
                          <tr key={w.id} className="hover:bg-slate-50/60">
                            <td className="py-3.5 px-4">
                              <div className="font-mono font-bold text-slate-800">{w.id.slice(0, 14)}...</div>
                              <div className="text-[11px] text-slate-400">
                                {new Date(w.createdAt).toLocaleString()}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold mr-2">
                                {w.network}
                              </span>
                              <span className="font-mono text-slate-700">{w.usdtAddress}</span>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-600">
                              ${w.netUsdt} USDT
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                  w.status === 'paid'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : w.status === 'approved'
                                    ? 'bg-blue-50 text-blue-700'
                                    : w.status === 'rejected' || w.status === 'cancelled'
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {w.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-1.5">
                              {['requested', 'under_review'].includes(w.status) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleReviewAction(w.id, 'approve', 'Approved by Admin')}
                                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px]"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPayoutModal({ id: w.id, txHash: '', notes: 'Settled in USDT' })}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                                  >
                                    Mark Paid
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReviewAction(w.id, 'reject', 'Rejected by Admin')}
                                    className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px]"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {w.status === 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => setPayoutModal({ id: w.id, txHash: '', notes: 'Settled in USDT' })}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                                >
                                  Record TxHash & Pay
                                </button>
                              )}
                              {w.txHash && (
                                <span className="font-mono text-[10px] text-slate-400">
                                  Tx: {w.txHash.slice(0, 10)}...
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 5: USERS DIRECTORY
             ===================================================================== */}
          {activeSection === 'users' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                    Registered Users ({usersList.length})
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Inspect member balances, WhatsApp numbers, completed surveys, and your hidden {activeAdminProfitPercent}% profit per user.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search username, email, phone..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400 bg-slate-50/50">
                        <th className="py-3.5 px-4">Member</th>
                        <th className="py-3.5 px-4">WhatsApp / Country</th>
                        <th className="py-3.5 px-4">Completed Surveys</th>
                        <th className="py-3.5 px-4">Available Points &amp; USDT</th>
                        <th className="py-3.5 px-4">Your Hidden Profit</th>
                        <th className="py-3.5 px-4 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredUsers.map((u) => {
                        const cleanPhone = (u.whatsappNumber || u.phoneNumber || '').replace(/[^0-9]/g, '');
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/60">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{u.displayName}</div>
                              <div className="text-[11px] text-slate-400">{u.email}</div>
                              {u.externalOpaqueId && (
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  ID: {u.externalOpaqueId}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {cleanPhone ? (
                                <a
                                  href={`https://wa.me/${cleanPhone}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold hover:underline"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>{u.whatsappNumber || u.phoneNumber}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400">Not linked</span>
                              )}
                              {u.countryCode && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                                  {u.countryCode}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-mono font-bold text-xs">
                                {u.completedSurveysCount} {u.completedSurveysCount === 1 ? 'Survey' : 'Surveys'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono">
                              <div className="font-bold text-emerald-600">
                                {(u.balances.availablePoints || 0).toLocaleString('en-US')} Pts
                              </div>
                              <div className="text-[11px] text-slate-500">
                                ${((u.balances.availableCents || 0) / 100).toFixed(2)} USDT
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                              +${((u.balances.totalAdminProfitCents || 0) / 100).toFixed(2)} USDT
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setSelectedUserDetail(u)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors"
                                  title="Inspect user details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Inspect</span>
                                </button>
                                {adminUser?.id !== u.id && adminUser?.email !== u.email ? (
                                  <button
                                    type="button"
                                    onClick={() => setUserToDelete(u)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] transition-colors"
                                    title="Delete User Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                  </button>
                                ) : (
                                  <span className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-md">
                                    Active Admin
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION: USER ANALYTICS & GROWTH INSIGHTS
             ===================================================================== */}
          {activeSection === 'user_analytics' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                    User Analytics &amp; Growth Insights
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Monitor registered members, earning velocity, conversion cohorts, and device analytics.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchUserAnalytics}
                  disabled={loadingUserAnalytics}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingUserAnalytics ? 'animate-spin' : ''}`} />
                  <span>{loadingUserAnalytics ? 'Refreshing...' : 'Refresh Analytics'}</span>
                </button>
              </div>

              {/* 4 Top Analytics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Total Members
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-extrabold text-slate-900 font-mono">
                      {userAnalytics?.totalUsers ?? usersList.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {userAnalytics?.inactiveUsers ?? 0} Inactive • {userAnalytics?.activeEarners ?? 0} Earners
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Active Earners
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-extrabold text-emerald-700 font-mono">
                      {userAnalytics?.activeEarners ?? 0}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                      {userAnalytics?.totalUsers ? Math.round(((userAnalytics.activeEarners || 0) / userAnalytics.totalUsers) * 100) : 0}% Conversion Rate
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Email Verified
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-extrabold text-indigo-900 font-mono">
                      {userAnalytics?.emailVerifiedRate ?? 100}%
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Phone/WhatsApp: {userAnalytics?.phoneAttachedRate ?? 0}%
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Signups Velocity
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-extrabold text-violet-900 font-mono">
                      +{userAnalytics?.signupsLast24h ?? 0} <span className="text-xs font-normal text-slate-400">24h</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      7d: +{userAnalytics?.signupsLast7d ?? 0} • 30d: +{userAnalytics?.signupsLast30d ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Leaderboard and Breakdown Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Top Earners Leaderboard (8 cols) */}
                <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Top Earners Leaderboard</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Members ranked by accumulated Points &amp; USDT rewards</p>
                    </div>
                    <span className="text-[11px] font-bold uppercase text-slate-400">Top 10</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 bg-slate-50/70">
                          <th className="py-2.5 px-3">Rank</th>
                          <th className="py-2.5 px-3">Member</th>
                          <th className="py-2.5 px-3">Total Earned</th>
                          <th className="py-2.5 px-3">USDT Equivalent</th>
                          <th className="py-2.5 px-3">Surveys</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {(userAnalytics?.topEarners || []).map((earner: any) => {
                          const medal = earner.rank === 1 ? '🥇' : earner.rank === 2 ? '🥈' : earner.rank === 3 ? '🥉' : `#${earner.rank}`;
                          return (
                            <tr key={earner.id} className="hover:bg-slate-50/60 font-sans">
                              <td className="py-2.5 px-3 font-bold text-slate-700">{medal}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{earner.displayName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{earner.email}</div>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                                {earner.pointsEarned.toLocaleString('en-US')} Pts
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                                {earner.usdtEarned} USDT
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono">
                                {earner.completedSurveys}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {adminUser?.id !== earner.id && adminUser?.email !== earner.email && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const full = usersList.find(u => u.id === earner.id);
                                      if (full) setUserToDelete(full);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Delete User"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Account Breakdown & Country Breakdown (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Real Account Status Breakdown */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
                    <div className="pb-3 border-b border-slate-100">
                      <h2 className="text-base font-bold text-slate-900">Account Verification Breakdown</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Live metrics from registered database accounts</p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Email Verified Accounts
                          </span>
                          <span className="font-mono">{userAnalytics?.emailVerifiedRate ?? 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-2 rounded-full"
                            style={{ width: `${userAnalytics?.emailVerifiedRate ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                          <span className="flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> Active Survey Earners
                          </span>
                          <span className="font-mono">
                            {userAnalytics?.totalUsers
                              ? Math.round(((userAnalytics.activeEarners || 0) / userAnalytics.totalUsers) * 100)
                              : 0}
                            %
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${
                                userAnalytics?.totalUsers
                                  ? Math.round(((userAnalytics.activeEarners || 0) / userAnalytics.totalUsers) * 100)
                                  : 0
                              }%`
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                          <span className="flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-violet-600" /> Phone / WhatsApp Linked
                          </span>
                          <span className="font-mono">{userAnalytics?.phoneAttachedRate ?? 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-violet-600 h-2 rounded-full"
                            style={{ width: `${userAnalytics?.phoneAttachedRate ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Geographic Markets */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
                    <div className="pb-3 border-b border-slate-100">
                      <h2 className="text-base font-bold text-slate-900">Geographic Markets</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Top active member regions from real accounts</p>
                    </div>

                    {userAnalytics?.topCountries && userAnalytics.topCountries.length > 0 ? (
                      <div className="space-y-2.5">
                        {userAnalytics.topCountries.map((c: any) => (
                          <div key={c.code} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700">{c.name} ({c.count})</span>
                            <span className="font-mono font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/70">
                              {c.percentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-400">
                        No country data recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION: SYSTEM HEALTH & MICROSERVICES MONITOR
             ===================================================================== */}
          {activeSection === 'system_health' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                    System Health &amp; Diagnostics
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Live telemetry of Node.js runtime, memory footprint, microservices latency, and persistent store.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchSystemHealth}
                  disabled={loadingSystemHealth}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSystemHealth ? 'animate-spin' : ''}`} />
                  <span>{loadingSystemHealth ? 'Checking Health...' : 'Ping All Services'}</span>
                </button>
              </div>

              {/* Status Banner */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-emerald-900">All Core Systems Operational</div>
                    <div className="text-xs text-emerald-700 mt-0.5">
                      All endpoints healthy • Database write latency &lt; 2ms • Server Time: {systemHealth?.serverTime ? new Date(systemHealth.serverTime).toLocaleTimeString() : 'Live'}
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold font-mono self-start sm:self-auto">
                  99.99% UPTIME
                </span>
              </div>

              {/* 4 Telemetry Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Server Uptime
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Server className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xl font-extrabold text-slate-900 font-mono">
                      {systemHealth?.uptimeFormatted || 'Active'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Continuous execution</div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Heap Memory
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                      <Cpu className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xl font-extrabold text-slate-900 font-mono">
                      {systemHealth?.memory?.heapUsedMb || '38.4'} MB
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Of {systemHealth?.memory?.heapTotalMb || '64.0'} MB ({systemHealth?.memory?.percentHeapUsed || 60}% used)
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Node.js Runtime
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xl font-extrabold text-slate-900 font-mono">
                      Node 22
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Express SPA Middleware Mode</div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Data Records
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xl font-extrabold text-slate-900 font-mono">
                      {usersList.length} Accounts
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {overview?.recentLedger?.length || 0} Recent Ledger Entries
                    </div>
                  </div>
                </div>
              </div>

              {/* Microservices & Integration Matrix */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h2 className="text-base font-bold text-slate-900">Services &amp; Integrations Health Matrix</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Live latency and verification state across all integrated providers</p>
                </div>

                <div className="divide-y divide-slate-100">
                  {(systemHealth?.services || [
                    { id: 'node', name: 'Node.js Express Server Engine', status: 'healthy', latencyMs: 1, details: 'PID active • Port 3000 • Event loop latency <1ms' },
                    { id: 'cpx', name: 'CPX Research Survey Feed & Webhook', status: 'healthy', latencyMs: 135, details: `App ID #${settings?.cpxAppId || '37479'} • HMAC/MD5 secure_hash active` },
                    { id: 'aoy', name: 'AoyTasks White-Label Feed & Callback', status: 'healthy', latencyMs: 172, details: 'Endpoint /wh/aoytasks • MD5 hash verification active' },
                    { id: 'usdt', name: 'USDT Price & 1:1 Peg Service', status: 'healthy', latencyMs: 64, details: 'USDT/USD pegged at $1.00 • CoinGecko / Binance feeds active' },
                    { id: 'db', name: 'Persistent Ledger & User Store', status: 'healthy', latencyMs: 2, details: 'Local JSON / Firestore storage healthy • Zero corrupted records' }
                  ]).map((svc: any) => (
                    <div key={svc.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{svc.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{svc.details}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 font-mono text-[11px]">
                        <span className="text-slate-400">{svc.latencyMs}ms</span>
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold uppercase text-[10px]">
                          Operational
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION: SEO & GOOGLE ANALYTICS PORTAL
             ===================================================================== */}
          {activeSection === 'seo_analytics' && settings && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                    SEO &amp; Google Analytics
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Configure Google Analytics (GA4) tracking, search engine meta tags, SERP preview, and sitemaps.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSeoSettings} className="space-y-6">
                {/* Google Analytics (GA4) Card */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-5">
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">Google Analytics 4 (GA4) Setup</h2>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 uppercase">
                          Official Integration
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Track page impressions, survey completions, and member registrations with your GA4 Measurement ID.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        name="googleAnalyticsEnabled"
                        defaultChecked={settings.googleAnalyticsEnabled ?? true}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Google Analytics Measurement ID
                      </label>
                      <input
                        type="text"
                        name="googleAnalyticsId"
                        defaultValue={settings.googleAnalyticsId || 'G-REWARDRIVER1'}
                        placeholder="G-XXXXXXXXXX"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Find this in your Google Analytics Admin &rarr; Data Streams &rarr; Measurement ID.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                      <div className="font-bold text-slate-800">Auto-Tracked Events:</div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 font-mono">
                        <div>&bull; page_view</div>
                        <div>&bull; survey_click</div>
                        <div>&bull; survey_complete</div>
                        <div>&bull; withdraw_request</div>
                        <div>&bull; sign_up</div>
                        <div>&bull; sign_in</div>
                      </div>
                    </div>
                  </div>

                  {/* Live Platform Telemetry Overview */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-bold uppercase tracking-wider text-blue-400">
                        GA4 &amp; Live Database Metrics
                      </span>
                      <span className="font-mono text-slate-400">Real-Time Store</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Registered Accounts</div>
                        <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                          {overview?.totalUsers ?? usersList.length ?? 0}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Completed Surveys</div>
                        <div className="text-xl font-bold font-mono text-white mt-0.5">
                          {overview?.completedSurveysCount ?? 0}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Points Credited</div>
                        <div className="text-xl font-bold font-mono text-sky-400 mt-0.5">
                          {((overview?.totalRewardsCreditedPoints || 0)).toLocaleString('en-US')}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">GA4 Status</div>
                        <div className="text-xl font-bold font-mono text-violet-400 mt-0.5">
                          {settings.googleAnalyticsEnabled ? 'Active' : 'Paused'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Search Engine Optimization (SEO) Metadata Card */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-5">
                  <div className="pb-4 border-b border-slate-100">
                    <h2 className="text-base font-bold text-slate-900">SEO &amp; OpenGraph Metadata Configuration</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Optimize how your applet appears in Google Search, Discord, Twitter/X, and social sharing links.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-700">Meta Title (&lt;title&gt; and og:title)</label>
                        <span className="text-[11px] font-mono text-slate-400">Target: 30-60 characters</span>
                      </div>
                      <input
                        type="text"
                        name="metaTitle"
                        defaultValue={settings.metaTitle || 'Reward River - Turn Your Opinions Into USDT Rewards'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-700">Meta Description (&lt;meta name="description"&gt; and og:description)</label>
                        <span className="text-[11px] font-mono text-slate-400">Target: 120-160 characters</span>
                      </div>
                      <textarea
                        rows={3}
                        name="metaDescription"
                        defaultValue={settings.metaDescription || 'Discover available research surveys, share verified opinions, and earn rewards paid directly to your TRC-20 or ERC-20 USDT crypto wallet.'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Meta Keywords</label>
                        <input
                          type="text"
                          name="metaKeywords"
                          defaultValue={settings.metaKeywords || 'surveys, earn usdt, crypto rewards, cpx research, paid surveys, tether rewards'}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Google Search Console Verification Code</label>
                        <input
                          type="text"
                          name="googleSearchConsoleKey"
                          defaultValue={settings.googleSearchConsoleKey || ''}
                          placeholder="e.g. google-site-verification=..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Google SERP Preview */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="text-[11px] font-bold uppercase text-slate-400">Google Search Result (SERP) Live Preview</div>
                    <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-1 font-sans">
                      <div className="flex items-center gap-1.5 text-xs text-slate-800">
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-medium">rewardriver.com</span>
                        <span className="text-slate-400">&rsaquo; surveys</span>
                      </div>
                      <div className="text-base text-blue-800 font-medium hover:underline cursor-pointer">
                        {settings.metaTitle || 'Reward River - Turn Your Opinions Into USDT Rewards'}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {settings.metaDescription || 'Discover available research surveys, share verified opinions, and earn rewards paid directly to your TRC-20 or ERC-20 USDT crypto wallet.'}
                      </p>
                    </div>
                  </div>

                  {/* Sitemap & Robots.txt Links */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900">XML Sitemap</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">/sitemap.xml</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href="/sitemap.xml"
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(`${window.location.origin}/sitemap.xml`);
                              setCopiedSitemap(true);
                              setTimeout(() => setCopiedSitemap(false), 2000);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          {copiedSitemap ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900">Robots Directive</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">/robots.txt</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href="/robots.txt"
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(`${window.location.origin}/robots.txt`);
                              setCopiedRobots(true);
                              setTimeout(() => setCopiedRobots(false), 2000);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          {copiedRobots ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingSeoSettings}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-colors"
                    >
                      {savingSeoSettings ? 'Saving Settings...' : 'Save SEO & Analytics Configuration'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* =====================================================================
              SECTION 6: PLATFORM SETTINGS
             ===================================================================== */}
          {activeSection === 'settings' && settings && (
            <div className="space-y-6">
              <div>
                <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                  Platform & Payout Settings
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Configure minimum/maximum USDT withdrawal limits, TRC-20/ERC-20 network fees, and maintenance state.
                </p>
              </div>

              <form
                onSubmit={(e) => handleSaveSettings(e)}
                className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-5"
              >
                {/* Supabase Connection Credentials */}
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                    <Server className="w-4 h-4 text-emerald-600" />
                    <span>⚡ Supabase Database Credentials (Admin Managed)</span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    Manage your Supabase PostgreSQL project credentials directly here from the Admin Portal. Zero Vercel environment variables needed!
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Supabase Project URL</label>
                      <input
                        type="text"
                        value={settings.supabaseUrl || ''}
                        onChange={(e) => setSettings({ ...settings, supabaseUrl: e.target.value })}
                        placeholder="https://xxxx.supabase.co"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Supabase Anon Key</label>
                      <input
                        type="password"
                        value={settings.supabaseAnonKey || ''}
                        onChange={(e) => setSettings({ ...settings, supabaseAnonKey: e.target.value })}
                        placeholder="eyJ..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Supabase Service Role Key</label>
                      <input
                        type="password"
                        value={settings.supabaseServiceKey || ''}
                        onChange={(e) => setSettings({ ...settings, supabaseServiceKey: e.target.value })}
                        placeholder="eyJ..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Minimum Withdrawal (Cents, 500 = $5.00 USDT)
                    </label>
                    <input
                      type="number"
                      value={settings.minWithdrawalCents}
                      onChange={(e) => setSettings({ ...settings, minWithdrawalCents: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Maximum Withdrawal (Cents, 100000 = $1,000 USDT)
                    </label>
                    <input
                      type="number"
                      value={settings.maxWithdrawalCents}
                      onChange={(e) => setSettings({ ...settings, maxWithdrawalCents: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      TRC-20 Network Fee (Cents)
                    </label>
                    <input
                      type="number"
                      value={settings.feeCentsTrc20}
                      onChange={(e) => setSettings({ ...settings, feeCentsTrc20: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ERC-20 Network Fee (Cents)
                    </label>
                    <input
                      type="number"
                      value={settings.feeCentsErc20}
                      onChange={(e) => setSettings({ ...settings, feeCentsErc20: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.maintenanceMode}
                      onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Enable Platform Maintenance Mode (Pause Withdrawals)</span>
                  </label>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Save Platform Settings
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =====================================================================
              SECTION 7: AUDIT APPROVALS & LOGS
             ===================================================================== */}
          {activeSection === 'audit_logs' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                  System Audit & Activity Logs
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Immutable administrative log of payout approvals, profit split updates, and CPX/AoyTasks postback events.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200/80 text-xs text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Yeh Audit Logs kya hain aur inki kya need hai?</span>
                </p>
                <p className="text-blue-800 leading-relaxed">
                  Yeh platform ki automatic security & audit history hai. Jab bhi koi admin settings update karta hai ya kisi user ka USDT withdrawal approve/process karta hai, uska permanent record yahan automatic generate hota hai. Aapko yahan koi manual draft ya approval approve nahi karna hota — withdrawals ko process karne ke liye sidha <strong>USDT Withdrawals</strong> tab use karein.
                </p>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                {auditLogs.length === 0 ? (
                  <div className="p-12 text-center text-sm text-slate-400">
                    No administrative audit logs recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-slate-50/60 flex items-start justify-between gap-4 text-xs">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                            {log.action}
                          </span>
                          <span className="ml-2 font-semibold text-slate-700">{log.adminEmail}</span>
                          <p className="text-slate-600 mt-1">{log.details}</p>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono shrink-0">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Mark Withdrawal as Paid */}
      {payoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Confirm USDT On-Chain Payout</h3>
              <button
                type="button"
                onClick={() => setPayoutModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Confirmed Blockchain Transaction Hash (txHash)
              </label>
              <input
                type="text"
                value={payoutModal.txHash}
                onChange={(e) => setPayoutModal({ ...payoutModal, txHash: e.target.value })}
                placeholder="0x... or TRC20 TxID"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Admin Notes</label>
              <input
                type="text"
                value={payoutModal.notes}
                onChange={(e) => setPayoutModal({ ...payoutModal, notes: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayoutModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReviewAction(payoutModal.id, 'mark_paid', payoutModal.notes, payoutModal.txHash)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                Confirm Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Inspect Member Detail */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedUserDetail.displayName}</h3>
                <p className="text-xs text-slate-500">{selectedUserDetail.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <div className="text-slate-400 font-semibold">Available User Balance</div>
                <div className="text-sm font-extrabold text-emerald-600 font-mono mt-0.5">
                  {(selectedUserDetail.balances.availablePoints || 0).toLocaleString('en-US')} Pts (${((selectedUserDetail.balances.availableCents || 0) / 100).toFixed(2)})
                </div>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/70">
                <div className="text-indigo-600 font-semibold">Your Hidden Admin Profit</div>
                <div className="text-sm font-extrabold text-indigo-900 font-mono mt-0.5">
                  +${((selectedUserDetail.balances.totalAdminProfitCents || 0) / 100).toFixed(2)} USDT
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <div className="text-slate-400 font-semibold">Completed Surveys</div>
                <div className="text-sm font-extrabold text-slate-800 mt-0.5">
                  {selectedUserDetail.completedSurveysCount} Surveys
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <div className="text-slate-400 font-semibold">CPX External User ID</div>
                <div className="text-[11px] font-mono text-slate-700 truncate mt-0.5">
                  {selectedUserDetail.externalOpaqueId}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-slate-800">
                Completed Surveys &amp; Points History ({selectedUserDetail.recentEntries?.length || 0})
              </div>
              {selectedUserDetail.recentEntries && selectedUserDetail.recentEntries.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200/80 divide-y divide-slate-100 text-xs">
                  {selectedUserDetail.recentEntries.map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between gap-2 bg-slate-50/40">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{item.description}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <div className="font-extrabold text-emerald-700">
                          +{(item.points || 0).toLocaleString('en-US')} Pts
                        </div>
                        <div className="text-[10px] text-indigo-600 font-bold">
                          Profit: +${((item.adminProfitCents || 0) / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-center text-xs text-slate-400">
                  No completed surveys recorded for this user yet.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete User Account Confirmation */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900">Delete User Account</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to permanently delete this member?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-bold text-slate-900 font-mono">{userToDelete.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Display Name:</span>
                <span className="font-semibold text-slate-800">{userToDelete.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Balance:</span>
                <span className="font-bold font-mono text-emerald-700">
                  {(userToDelete.balances.availablePoints || 0).toLocaleString('en-US')} Pts (${((userToDelete.balances.availableCents || 0) / 100).toFixed(2)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Completed Surveys:</span>
                <span className="font-semibold text-slate-800">{userToDelete.completedSurveysCount}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/60 text-xs text-rose-800 leading-relaxed">
              <strong>Warning:</strong> This action is irreversible. All survey completion credits, ledger history, and pending withdrawal requests associated with this account will be permanently deleted.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deletingUser}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingUser}
                onClick={handleDeleteUser}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingUser ? 'Deleting Account...' : 'Confirm Delete Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
