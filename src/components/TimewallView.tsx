import React, { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  History,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Lock,
  Layers,
  ClipboardList,
  UserCheck,
  ShieldCheck,
  Wrench,
  Eye
} from 'lucide-react';
import { Logo } from './Logo';
import { User, OfferwallTransaction, UserBalances, TimewallSurveyFeed } from '../types';

interface TimewallViewProps {
  user: User | null;
  token: string | null;
  onRequireAuth: () => void;
  onBalancesUpdated?: (balances: UserBalances) => void;
}

interface TimewallPageResponse {
  blocked: boolean;
  error?: string;
  provider: string;
  displayName: string;
  isConfigured: boolean;
  oidConfigured: boolean;
  apiKeyConfigured?: boolean;
  offerwallLive?: boolean;
  offerwallReason?: string;
  surveyApiLive?: boolean;
  taskMaintenanceMode?: 'auto' | 'live' | 'maintenance';
  iframeUrl: string;
  coinsPerUsd: number;
  allowDecimals: boolean;
  note: string;
  balances?: UserBalances;
  surveyApi?: TimewallSurveyFeed;
  history?: {
    items: OfferwallTransaction[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export const TimewallView: React.FC<TimewallViewProps> = ({
  user,
  token,
  onRequireAuth,
  onBalancesUpdated
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'offerwall' | 'surveys' | 'history'>('offerwall');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [blocked, setBlocked] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const [oidConfigured, setOidConfigured] = useState<boolean>(true);
  const [offerwallLive, setOfferwallLive] = useState<boolean>(true);
  const [offerwallReason, setOfferwallReason] = useState<string | undefined>(undefined);
  const [taskMaintenanceMode, setTaskMaintenanceMode] = useState<'auto' | 'live' | 'maintenance'>('auto');
  const [adminPreviewMaintenance, setAdminPreviewMaintenance] = useState<boolean>(false);
  const [savingMode, setSavingMode] = useState<boolean>(false);
  const [coinsPerUsd, setCoinsPerUsd] = useState<number>(10000);
  const [note, setNote] = useState<string>(
    'Rewards are credited automatically to your Reward River balance after the advertiser confirms completion (usually within minutes).'
  );
  const [surveyApi, setSurveyApi] = useState<TimewallSurveyFeed | null>(null);

  // Paginated Task History state
  const [historyItems, setHistoryItems] = useState<OfferwallTransaction[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const pageSize = 10;

  const isAdmin = user?.role === 'admin';

  const fetchTimewallData = useCallback(
    async (targetPage = page, isManualRefresh = false) => {
      if (!user || !token) {
        setLoading(false);
        return;
      }
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setErrorMsg(null);

      try {
        const screenW = typeof window !== 'undefined' && window.screen?.width ? window.screen.width : 390;
        const screenH = typeof window !== 'undefined' && window.screen?.height ? window.screen.height : 844;
        const res = await fetch(
          `/api/earn/timewall?page=${targetPage}&pageSize=${pageSize}&screenWidth=${screenW}&screenHeight=${screenH}&limit=10${isManualRefresh ? '&force=1' : ''}&_t=${Date.now()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Cache-Control': 'no-cache'
            }
          }
        );
        const data: TimewallPageResponse = await res.json();

        if (res.status === 403 && data.blocked) {
          setBlocked(true);
          setErrorMsg(
            data.error ||
              'Your task access has been restricted by an administrator.'
          );
          return;
        }

        if (!res.ok) {
          setErrorMsg(data.error || 'Task feed is temporarily undergoing maintenance.');
          setOfferwallLive(false);
          return;
        }

        setBlocked(false);
        setIframeUrl(data.iframeUrl || '');
        setOidConfigured(Boolean(data.oidConfigured));
        setOfferwallLive(data.offerwallLive !== false);
        setOfferwallReason(data.offerwallReason);
        if (data.taskMaintenanceMode) {
          setTaskMaintenanceMode(data.taskMaintenanceMode);
        }
        setCoinsPerUsd(data.coinsPerUsd || 10000);
        if (data.note) setNote(data.note);
        if (data.surveyApi) setSurveyApi(data.surveyApi);

        if (data.history) {
          setHistoryItems(data.history.items || []);
          setPage(data.history.page || 1);
          setTotalPages(data.history.totalPages || 1);
          setTotalItems(data.history.total || 0);
        }

        if (data.balances && onBalancesUpdated) {
          onBalancesUpdated(data.balances);
        }
      } catch {
        setErrorMsg('Task network is refreshing. Please wait a moment.');
        setOfferwallLive(false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, token, page, onBalancesUpdated]
  );

  useEffect(() => {
    fetchTimewallData(1, false);
  }, [user?.id, token]);

  // Poll live status, history & balance every 30s so when tasks/surveys go live they auto-activate immediately
  useEffect(() => {
    if (!user || !token || blocked) return;
    const interval = setInterval(() => {
      fetchTimewallData(page, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [user, token, blocked, page, fetchTimewallData]);

  // Determine which sub-features are working & live right now
  const hasWorkingSurveys = Boolean(
    surveyApi?.success &&
      ((surveyApi.surveys && surveyApi.surveys.length > 0) || surveyApi.prescreenerRequired)
  );
  const isOfferwallWorking = Boolean(
    taskMaintenanceMode === 'live' ||
      (taskMaintenanceMode === 'auto' && offerwallLive && oidConfigured && iframeUrl && !errorMsg)
  );
  const isAnyTaskLiveForUsers =
    taskMaintenanceMode !== 'maintenance' && (isOfferwallWorking || hasWorkingSurveys);

  // Automatically switch regular users away from any sub-tab that isn't live
  useEffect(() => {
    if (isAdmin) return;
    if (activeSubTab === 'surveys' && !hasWorkingSurveys && isOfferwallWorking) {
      setActiveSubTab('offerwall');
    } else if (activeSubTab === 'offerwall' && !isOfferwallWorking && hasWorkingSurveys) {
      setActiveSubTab('surveys');
    }
  }, [isAdmin, activeSubTab, hasWorkingSurveys, isOfferwallWorking]);

  const handleUpdateTaskVisibilityMode = async (mode: 'auto' | 'live' | 'maintenance') => {
    if (!token || !isAdmin) return;
    setSavingMode(true);
    try {
      const res = await fetch('/api/admin/service-visibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ taskMaintenanceMode: mode })
      });
      if (res.ok) {
        setTaskMaintenanceMode(mode);
        await fetchTimewallData(page, true);
      }
    } catch {
      // ignore
    } finally {
      setSavingMode(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchTimewallData(newPage, true);
  };

  const renderStatusBadge = (status: OfferwallTransaction['status']) => {
    switch (status) {
      case 'credited':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Credited
          </span>
        );
      case 'reversed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Reversed
          </span>
        );
      case 'needs_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending Verification
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Rejected
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Restricted
          </span>
        );
    }
  };

  if (!user || !token) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-8 text-center space-y-4">
          <div className="flex justify-center">
            <Logo size="md" showTagline={false} />
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-[#079B55]" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Sign In to Access Reward River Tasks
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Complete verified tasks, quizzes, and partner offers on Reward River to earn Points directly into your account.
          </p>
          <button
            onClick={onRequireAuth}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#079B55] text-white hover:bg-[#058246] transition-colors cursor-pointer"
          >
            Sign In / Create Account
          </button>
        </div>
      </div>
    );
  }

  if (blocked || user.offerwallBlocked) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-rose-50/70 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-800 p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Task Center Access Restricted
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
            {errorMsg ||
              'Your account is currently restricted from accessing the Reward River Task Center. Please contact support if you need assistance.'}
          </p>
        </div>
      </div>
    );
  }

  const prescreenerLink = surveyApi?.surveys?.[0]?.link || iframeUrl;
  const showUserMaintenanceScreen =
    !loading && ((!isAdmin && !isAnyTaskLiveForUsers) || (isAdmin && adminPreviewMaintenance));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ADMIN-ONLY LIVE HEALTH & VISIBILITY CONTROL BAR */}
      {isAdmin && (
        <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-md space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    Admin Task Visibility & Auto-Live Control
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      isAnyTaskLiveForUsers
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isAnyTaskLiveForUsers ? 'LIVE FOR USERS' : 'UNDER MAINTENANCE FOR USERS'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Task Wall: <strong className="text-white">{isOfferwallWorking ? 'Working (Visible)' : `Auto-Hidden (${offerwallReason || 'Under Maintenance'})`}</strong>
                  {' • '}
                  Bonus Surveys: <strong className="text-white">{hasWorkingSurveys ? `Working (${surveyApi?.surveys?.length || 0} Live)` : 'Auto-Hidden from Users (0 Live)'}</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-800 p-1 border border-slate-700">
                <button
                  type="button"
                  disabled={savingMode}
                  onClick={() => handleUpdateTaskVisibilityMode('auto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    taskMaintenanceMode === 'auto'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Auto (Live Check)
                </button>
                <button
                  type="button"
                  disabled={savingMode}
                  onClick={() => handleUpdateTaskVisibilityMode('live')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    taskMaintenanceMode === 'live'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Force Live
                </button>
                <button
                  type="button"
                  disabled={savingMode}
                  onClick={() => handleUpdateTaskVisibilityMode('maintenance')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    taskMaintenanceMode === 'maintenance'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Maintenance (Hide from Users)
                </button>
              </div>

              <button
                type="button"
                onClick={() => setAdminPreviewMaintenance(prev => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>{adminPreviewMaintenance ? 'Exit User Preview' : 'Preview Maintenance Screen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHITE-LABEL REWARD RIVER MAINTENANCE SCREEN (Shown to regular users when not live, or when Admin previews it) */}
      {showUserMaintenanceScreen ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-[#D9EFE3] dark:border-slate-800 shadow-sm p-8 sm:p-12 text-center max-w-3xl mx-auto space-y-6">
          <div className="flex flex-col items-center gap-3">
            <Logo size="lg" showTagline={true} />
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-extrabold uppercase tracking-wider">
              <Wrench className="w-3.5 h-3.5 text-amber-600 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Reward River Official • Scheduled Maintenance</span>
            </div>
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-black text-[#192F40] dark:text-white tracking-tight">
              Reward River Task Center is Upgrading
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Our partner task wall and instant reward campaigns are currently undergoing scheduled quality verification for your region. As soon as live tasks are verified, this page will <strong className="text-[#079B55] dark:text-emerald-400">activate automatically</strong>.
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => fetchTimewallData(page, true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#079B55] hover:bg-[#058246] text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Checking Live Status...' : 'Check Live Status'}</span>
            </button>

            {totalItems > 0 && (
              <button
                type="button"
                onClick={() => setActiveSubTab('history')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                <History className="w-4 h-4 text-[#079B55]" />
                <span>View Task History ({totalItems})</span>
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-[#079B55] animate-ping" />
            <span>Auto-Sync Active on rewardriver.online • Checking for live tasks every 30 seconds</span>
          </div>
        </div>
      ) : (
        <>
          {/* White-Label Reward River Header Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#D9EFE3] dark:border-slate-800 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#079B55] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#F0FBF5] dark:bg-emerald-950/60 border border-[#D9EFE3] dark:border-emerald-800 text-[#079B55] dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                      <ShieldCheck className="w-3 h-3" />
                      Reward River Official • rewardriver.online
                    </span>
                  </div>
                  <h1 className="text-lg sm:text-xl font-black text-[#192F40] dark:text-white tracking-tight mt-1">
                    Reward River Task &amp; Offer Center
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Complete verified tasks, quizzes, and partner offers to earn Reward River Points ({coinsPerUsd.toLocaleString('en-US')} Points = $1.00 USD)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Sub-navigation: only show working sub-tabs to regular users; Admin sees all */}
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/60 dark:border-slate-700">
                  {(isOfferwallWorking || isAdmin) && (
                    <button
                      onClick={() => setActiveSubTab('offerwall')}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeSubTab === 'offerwall'
                          ? 'bg-white dark:bg-slate-900 text-[#192F40] dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#079B55]" />
                      <span>Task Wall</span>
                    </button>
                  )}

                  {(hasWorkingSurveys || isAdmin) && (
                    <button
                      onClick={() => setActiveSubTab('surveys')}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeSubTab === 'surveys'
                          ? 'bg-white dark:bg-slate-900 text-[#192F40] dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-[#079B55]" />
                      <span>Bonus Surveys ({surveyApi?.surveys?.length || 0})</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveSubTab('history')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeSubTab === 'history'
                        ? 'bg-white dark:bg-slate-900 text-[#192F40] dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <History className="w-3.5 h-3.5 text-[#079B55]" />
                    <span>Task History ({totalItems})</span>
                  </button>
                </div>

                <button
                  onClick={() => fetchTimewallData(page, true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                  title="Refresh balance and live tasks"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>

                {iframeUrl && (isOfferwallWorking || isAdmin) && (
                  <a
                    href={iframeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[#079B55] text-white hover:bg-[#058246] transition-colors"
                  >
                    <span>Open in New Tab</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Reward Confirmation Notice */}
            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#F0FBF5] dark:bg-emerald-950/40 border border-[#D9EFE3] dark:border-emerald-800/80 px-3.5 py-2.5 text-xs text-[#192F40] dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-[#079B55] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Reward River Guarantee:</span> {note}
              </div>
            </div>

            {/* Prescreener Required Prompt (Only shown when prescreenerRequired is active) */}
            {surveyApi?.prescreenerRequired && (
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 px-4 py-3 text-xs text-teal-950 dark:text-teal-200">
                <div className="flex items-start gap-2.5">
                  <UserCheck className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-teal-900 dark:text-teal-100">
                      Complete Your Reward River Profile to Unlock Higher-Paying Surveys
                    </div>
                    <p className="text-teal-800 dark:text-teal-300 mt-0.5">
                      Complete a quick 1-time demographic profile prescreener to unlock targeted high-reward surveys for your account.
                    </p>
                  </div>
                </div>
                {prescreenerLink && (
                  <a
                    href={prescreenerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#079B55] text-white font-bold hover:bg-[#058246] shrink-0 transition-colors"
                  >
                    <span>Complete Profile</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>

          {activeSubTab === 'offerwall' ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#D9EFE3] dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Branded White-Label Top Frame Bar */}
              <div className="px-4 py-3 bg-[#192F40] text-white flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold">Reward River Verified Task Wall</span>
                  <span className="text-slate-400 hidden sm:inline">• Instant Auto-Credit Enabled</span>
                </div>
                <span className="font-mono text-[11px] text-emerald-300 font-semibold">
                  $1.00 = {coinsPerUsd.toLocaleString('en-US')} Pts
                </span>
              </div>

              {loading ? (
                <div className="min-h-[800px] flex flex-col items-center justify-center p-8 text-slate-500">
                  <RefreshCw className="w-7 h-7 animate-spin text-[#079B55] mb-3" />
                  <p className="text-sm font-bold text-[#192F40] dark:text-white">
                    Loading Reward River Verified Tasks...
                  </p>
                </div>
              ) : (
                <iframe
                  src={iframeUrl}
                  title="Reward River Task Wall"
                  className="w-full min-h-[800px] border-0 bg-slate-50"
                  allow="clipboard-write; fullscreen"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}
            </div>
          ) : null}

          {activeSubTab === 'surveys' ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#D9EFE3] dark:border-slate-800 shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-[#079B55]" />
                    Reward River Bonus Surveys
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time verified surveys matched to your Reward River profile and location
                  </p>
                </div>
                {iframeUrl && (
                  <a
                    href={iframeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#079B55] hover:underline inline-flex items-center gap-1"
                  >
                    Open Full Task Portal <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {!surveyApi?.surveys || surveyApi.surveys.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-slate-800 text-amber-600 flex items-center justify-center mx-auto">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">
                    Bonus Survey Feed is Under Maintenance for Your Region
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {isAdmin
                      ? 'Admin Note: This empty survey tab is automatically hidden from regular users until live surveys are returned.'
                      : 'New bonus surveys will appear here automatically as soon as they become available.'}
                  </p>
                  {isOfferwallWorking && (
                    <button
                      onClick={() => setActiveSubTab('offerwall')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#079B55] text-white text-xs font-bold hover:bg-[#058246] cursor-pointer"
                    >
                      Switch to Task Wall
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {surveyApi.surveys.map(item => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between hover:border-[#079B55]/60 transition-colors bg-slate-50/40 dark:bg-slate-800/40"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <Clock className="w-3.5 h-3.5 text-[#079B55]" />
                            {item.loi} min
                          </span>
                          <span className="font-mono text-sm font-black text-[#079B55]">
                            +{item.currency_amount.toLocaleString('en-US')} Pts
                          </span>
                        </div>
                        <div className="text-sm font-bold text-[#192F40] dark:text-white">
                          {surveyApi.prescreenerRequired
                            ? 'Reward River Profile Prescreener'
                            : `Reward River Survey #${item.id.slice(0, 6)}`}
                        </div>
                      </div>

                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center justify-center gap-1.5 w-full px-3.5 py-2 rounded-xl bg-[#079B55] text-white text-xs font-bold hover:bg-[#058246] transition-colors"
                      >
                        <span>
                          {surveyApi.prescreenerRequired ? 'Complete Profile' : 'Start Survey'}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}

      {/* White-Label Task History Table */}
      {(activeSubTab === 'history' || !showUserMaintenanceScreen) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#D9EFE3] dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-[#079B55]" />
                Reward River Task &amp; Offer History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your completed tasks, Points rewards, and verification statuses on rewardriver.online
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Total records: <span className="font-semibold text-slate-800 dark:text-white">{totalItems}</span>
            </div>
          </div>

          {historyItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No completed task transactions recorded yet. Complete a task above to earn Reward River Points!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Task / Offer</th>
                    <th className="py-3 px-4">Reference ID</th>
                    <th className="py-3 px-4 text-right">Points</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                  {historyItems.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono text-xs">
                        {tx.createdAtKarachi || new Date(tx.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {(tx.offerName || 'Reward River Verified Offer').replace(/TimeWall(\.io)?/gi, 'Reward River')}
                        </div>
                        {tx.offerDetail && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {tx.offerDetail}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        {tx.providerTxid}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        {tx.status === 'reversed' ? (
                          <span className="text-red-600">
                            -{tx.coinsInt.toLocaleString('en-US')} Pts
                          </span>
                        ) : tx.status === 'credited' ? (
                          <span className="text-[#079B55]">
                            +{tx.coinsInt.toLocaleString('en-US')} Pts
                          </span>
                        ) : (
                          <span className="text-slate-600">
                            {tx.coinsInt.toLocaleString('en-US')} Pts
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {renderStatusBadge(tx.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-5 py-3.5 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <div>
                Page <span className="font-semibold text-slate-900 dark:text-white">{page}</span> of{' '}
                <span className="font-semibold text-slate-900 dark:text-white">{totalPages}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
