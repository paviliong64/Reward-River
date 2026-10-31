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
  UserCheck
} from 'lucide-react';
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
  const [coinsPerUsd, setCoinsPerUsd] = useState<number>(10000);
  const [note, setNote] = useState<string>(
    'Rewards are credited after the advertiser confirms, which can take minutes to days.'
  );
  const [surveyApi, setSurveyApi] = useState<TimewallSurveyFeed | null>(null);

  // Paginated Offerwall History state
  const [historyItems, setHistoryItems] = useState<OfferwallTransaction[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const pageSize = 10;

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
          `/api/earn/timewall?page=${targetPage}&pageSize=${pageSize}&screenWidth=${screenW}&screenHeight=${screenH}&limit=10&_t=${Date.now()}`,
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
              'Your offerwall access has been restricted by an administrator.'
          );
          return;
        }

        if (!res.ok) {
          setErrorMsg(data.error || 'Could not load TimeWall offerwall.');
          return;
        }

        setBlocked(false);
        setIframeUrl(data.iframeUrl || '');
        setOidConfigured(Boolean(data.oidConfigured));
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
        setErrorMsg('Network error while loading TimeWall offerwall.');
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

  // Poll user offerwall history & balance every 30s while on the TimeWall page so new credits appear automatically
  useEffect(() => {
    if (!user || !token || blocked) return;
    const interval = setInterval(() => {
      fetch(`/api/user/offerwall-history?page=${page}&pageSize=${pageSize}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (!data) return;
          if (data.history) {
            setHistoryItems(data.history.items || []);
            setTotalPages(data.history.totalPages || 1);
            setTotalItems(data.history.total || 0);
          }
          if (data.balances && onBalancesUpdated) {
            onBalancesUpdated(data.balances);
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [user, token, blocked, page, onBalancesUpdated]);

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
            Pending Review
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
            Blocked
          </span>
        );
    }
  };

  if (!user || !token) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-teal-700" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Sign In to Access TimeWall.io Offerwall
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
            Complete verified micro-tasks, surveys, and advertiser offers on TimeWall.io to earn Points directly to your Reward River account.
          </p>
          <button
            onClick={onRequireAuth}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-700 text-white hover:bg-teal-800 transition-colors cursor-pointer"
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
        <div className="bg-rose-50/70 rounded-2xl border border-rose-200 p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Offerwall Access Restricted
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            {errorMsg ||
              'Your account is currently restricted from opening the TimeWall offerwall. Please contact support if you need assistance.'}
          </p>
        </div>
      </div>
    );
  }

  const prescreenerLink = surveyApi?.surveys?.[0]?.link || iframeUrl;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  TimeWall.io Offerwall & Surveys
                </h1>
                <p className="text-xs text-slate-500">
                  Complete tasks, quizzes, and advertiser offers to earn site coins ({coinsPerUsd.toLocaleString('en-US')} Points per $1.00 rate)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sub-navigation between Offerwall, Live Surveys (API), and History */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/60">
              <button
                onClick={() => setActiveSubTab('offerwall')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeSubTab === 'offerwall'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                Offerwall
              </button>
              <button
                onClick={() => setActiveSubTab('surveys')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeSubTab === 'surveys'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-teal-600" />
                Live Surveys ({surveyApi?.surveys?.length || 0})
              </button>
              <button
                onClick={() => setActiveSubTab('history')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeSubTab === 'history'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5 text-teal-600" />
                Offerwall History ({totalItems})
              </button>
            </div>

            <button
              onClick={() => fetchTimewallData(page, true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh balance, surveys, and offerwall history"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {iframeUrl && (
              <a
                href={iframeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-700 text-white hover:bg-teal-800 transition-colors"
              >
                <span>Open in new tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Advertiser Confirmation Notice */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 px-3.5 py-2.5 text-xs text-amber-900">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Note:</span> {note}
          </div>
        </div>

        {/* Prescreener Required Prompt (Per TimeWall Survey API Spec: when prescreener_required: true, show "complete your profile" prompt) */}
        {surveyApi?.prescreenerRequired && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-xs text-teal-950">
            <div className="flex items-start gap-2.5">
              <UserCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-teal-900">
                  Complete Your Profile to Unlock Higher-Paying Surveys
                </div>
                <p className="text-teal-800 mt-0.5">
                  TimeWall requires a quick demographic prescreener before matching you with full surveys. Click below to complete your profile.
                </p>
              </div>
            </div>
            {prescreenerLink && (
              <a
                href={prescreenerLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800 shrink-0 transition-colors"
              >
                <span>Complete Your Profile</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={() => fetchTimewallData(page, true)}
            className="font-semibold underline ml-4 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {activeSubTab === 'offerwall' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {!oidConfigured && (
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-600">
              <span>
                TimeWall placement URL is active. If the wall does not load yet, ensure <code className="font-mono text-slate-800">TIMEWALL_OID</code> is configured in Admin Settings or <code className="font-mono text-slate-800">.env</code>.
              </span>
              {iframeUrl && (
                <a
                  href={iframeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-700 font-semibold hover:underline inline-flex items-center gap-1 shrink-0 ml-2"
                >
                  Open directly <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {loading ? (
            <div className="min-h-[800px] flex flex-col items-center justify-center p-8 text-slate-500">
              <RefreshCw className="w-7 h-7 animate-spin text-teal-600 mb-3" />
              <p className="text-sm font-medium">Loading TimeWall.io Offerwall...</p>
            </div>
          ) : (
            <iframe
              src={iframeUrl}
              title="TimeWall.io Offerwall"
              className="w-full min-h-[800px] border-0 bg-slate-50"
              allow="clipboard-write; fullscreen"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
        </div>
      ) : null}

      {activeSubTab === 'surveys' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-teal-600" />
                TimeWall Direct Survey Feed
              </h2>
              <p className="text-xs text-slate-500">
                Real-time surveys fetched server-to-server for your profile and location
              </p>
            </div>
            {iframeUrl && (
              <a
                href={iframeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-teal-700 hover:underline inline-flex items-center gap-1"
              >
                Open Full TimeWall Portal <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {surveyApi?.prescreenerRequired && (
            <div className="rounded-xl bg-teal-50 border border-teal-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-teal-900">
                  Step 1: Complete Your Profile Prescreener
                </div>
                <p className="text-xs text-teal-800 mt-0.5">
                  All survey links below currently point to TimeWall&apos;s profile prescreener. Complete it once to unlock direct survey payouts.
                </p>
              </div>
              {prescreenerLink && (
                <a
                  href={prescreenerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 shrink-0"
                >
                  Complete Your Profile <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {!surveyApi?.surveys || surveyApi.surveys.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-slate-600">
                {surveyApi?.message ||
                  'No direct API surveys are currently available for your IP/location. You can still browse all tasks, clicks, and offers in the Offerwall tab.'}
              </p>
              <button
                onClick={() => setActiveSubTab('offerwall')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer"
              >
                Switch to Full Offerwall
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {surveyApi.surveys.map(item => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-4 flex flex-col justify-between hover:border-teal-600/50 transition-colors bg-slate-50/40"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        {item.loi} min
                      </span>
                      <span className="font-mono text-sm font-black text-teal-700">
                        +{item.currency_amount.toLocaleString('en-US')} Pts
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {surveyApi.prescreenerRequired
                        ? 'Profile Prescreener Survey'
                        : `TimeWall Research Survey #${item.id.slice(0, 6)}`}
                    </div>
                  </div>

                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center justify-center gap-1.5 w-full px-3.5 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors"
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

      {/* Offerwall History Table (Always visible on History tab, and compact preview below Offerwall) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-teal-600" />
              Offerwall History
            </h2>
            <p className="text-xs text-slate-500">
              Your completed TimeWall.io offers, coin rewards, and verification statuses
            </p>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Total records: <span className="font-semibold text-slate-800">{totalItems}</span>
          </div>
        </div>

        {historyItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No TimeWall.io offer transactions recorded yet. Complete an offer above to earn Points!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Offer Name</th>
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4 text-right">Coins (Points)</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {historyItems.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap font-mono text-xs">
                      {tx.createdAtKarachi || new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {tx.offerName || 'TimeWall Offer'}
                      </div>
                      {tx.offerDetail && (
                        <div className="text-xs text-slate-500 line-clamp-1">
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
                        <span className="text-emerald-700">
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
          <div className="px-5 py-3.5 bg-slate-50/60 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
            <div>
              Page <span className="font-semibold text-slate-900">{page}</span> of{' '}
              <span className="font-semibold text-slate-900">{totalPages}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

