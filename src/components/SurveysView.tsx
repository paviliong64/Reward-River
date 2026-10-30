import React, { useState, useEffect, useCallback } from 'react';
import { Survey, UsdtQuote, CpxConfigStatus, WhiteLabelTask, User, UserBalances } from '../types';
import {
  ClipboardList,
  Clock,
  Star,
  RefreshCw,
  AlertCircle,
  Info,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Flame,
  Lock,
  Zap,
  ExternalLink,
  X,
  Layers,
  Sparkles,
  Coins,
  UserCheck
} from 'lucide-react';

interface SurveysViewProps {
  surveys: Survey[];
  loading: boolean;
  error: string | null;
  cpxStatus: CpxConfigStatus | null;
  usdtQuote: UsdtQuote | null;
  balances?: UserBalances | null;
  surveyDisplayMode?: 'hybrid' | 'points_only';
  pointsPerUsdt?: number;
  userSharePercent?: number;
  onRefresh: () => void;
  onStartSurvey: (survey: Survey) => void;
  onTaskCompleted?: () => void;
  onOpenWithdraw?: () => void;
  user?: User | null;
  cpxConfig?: {
    appId: string;
    extUserId: string;
    secureHash: string;
    themeColor?: string;
  } | null;
}

export const SurveysView: React.FC<SurveysViewProps> = ({
  surveys,
  loading,
  error,
  cpxStatus,
  balances,
  onRefresh,
  onStartSurvey,
  onTaskCompleted,
  onOpenWithdraw,
  user,
  cpxConfig
}) => {
  const [marketplaceSection, setMarketplaceSection] = useState<'surveys' | 'tasks'>('surveys');
  const [filter, setFilter] = useState<'all' | 'quick' | 'highest'>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<'all' | 'ptc' | 'shortlink'>('all');

  const [tasks, setTasks] = useState<WhiteLabelTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [offerwallUrl, setOfferwallUrl] = useState<string>('');
  const [showOfferwallModal, setShowOfferwallModal] = useState<boolean>(false);
  const [activeTaskModal, setActiveTaskModal] = useState<WhiteLabelTask | null>(null);
  const [taskSecondsLeft, setTaskSecondsLeft] = useState(0);
  const [taskClaiming, setTaskClaiming] = useState(false);
  const [taskFeedback, setTaskFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Active started survey session tracking in background (no manual banner needed)
  const [activeSurveySession, setActiveSurveySession] = useState<Survey | null>(null);
  const [completingSurvey, setCompletingSurvey] = useState(false);
  const [rewardCelebration, setRewardCelebration] = useState<{
    points: number;
    usd: string;
    surveyId?: string;
  } | null>(null);
  const prevPointsRef = React.useRef<number | null>(null);

  const availablePoints = balances?.availablePoints ?? (balances?.availableCents ? balances.availableCents * 100 : 0);
  const availableUsdValue = (availablePoints / 10000).toFixed(2); // 10,000 Points = $1.00 USD
  const minWithdrawPoints = 250000; // $25.00 USD Minimum Withdrawal
  const withdrawProgressPercent = Math.min(100, Math.round((availablePoints / minWithdrawPoints) * 100));
  const completedSurveysCount = balances?.completedSurveysCount ?? 0;

  // Automatically trigger the Points Credited celebration animation whenever the user's points balance increases
  useEffect(() => {
    if (balances == null) return;
    if (prevPointsRef.current !== null && availablePoints > prevPointsRef.current) {
      const gainedPoints = availablePoints - prevPointsRef.current;
      setRewardCelebration({
        points: gainedPoints,
        usd: (gainedPoints / 10000).toFixed(2),
        surveyId: activeSurveySession?.id
      });
      setActiveSurveySession(null);
      const timer = setTimeout(() => setRewardCelebration(null), 5000);
      prevPointsRef.current = availablePoints;
      return () => clearTimeout(timer);
    }
    prevPointsRef.current = availablePoints;
  }, [availablePoints, balances, activeSurveySession?.id]);

  // Presentation mode for Surveys:
  // 'cards': Reward River verified responsive cards
  // 'official_widget': Embedded widget
  // 'offerwall': Full interactive wall iframe
  const [surveyPresentation, setSurveyPresentation] = useState<'cards' | 'official_widget' | 'offerwall'>('cards');
  const [cpxWidgetCount, setCpxWidgetCount] = useState<number | null>(null);

  // Single Page-Level CAPTCHA verification state
  const [captchaPassed, setCaptchaPassed] = useState<boolean>(() => {
    return Boolean(sessionStorage.getItem('rr_survey_captcha_cleared'));
  });

  const [captchaChecking, setCaptchaChecking] = useState(false);
  const [captchaCheckedBox, setCaptchaCheckedBox] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  // Sync get_transaction callback transactions to our backend ledger
  const syncCpxTransactionsToServer = useCallback(async (transactions: unknown) => {
    try {
      const token = localStorage.getItem('rr_auth_token');
      if (!token || !transactions) return;
      const res = await fetch('/api/cpx/sync-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ transactions })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.newlyCreditedCount > 0 && onTaskCompleted) {
          onTaskCompleted();
        }
      }
    } catch {
      // ignore
    }
  }, [onTaskCompleted]);

  const [cpxWidgetReloadKey, setCpxWidgetReloadKey] = useState(0);

  // Listen for script_tag_v2.0.js callbacks from the isolated widget frame
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const payload = event.data;
      if (!payload || payload.source !== 'rr-cpx-script-tag') return;

      if (payload.type === 'count_new_surveys' && typeof payload.count === 'number') {
        setCpxWidgetCount(payload.count);
      } else if (payload.type === 'get_all_surveys' && Array.isArray(payload.surveys)) {
        setCpxWidgetCount(payload.surveys.length);
      } else if (payload.type === 'get_transaction' && payload.transactions) {
        syncCpxTransactionsToServer(payload.transactions);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [syncCpxTransactionsToServer]);

  // Secure user identifier generation: strictly use Supabase UUID or opaque ID, NEVER pass user email or PII
  const effectiveAppId = Number(cpxConfig?.appId || '37699') || 37699;
  const effectiveUserId =
    cpxConfig?.extUserId ||
    (user?.externalOpaqueId && !user.externalOpaqueId.includes('@') ? user.externalOpaqueId : null) ||
    (user?.id && !user.id.includes('@') ? user.id : null) ||
    'rr_member_1';
  const effectiveHash = cpxConfig?.secureHash || '';
  const effectiveAoySubId =
    user?.externalOpaqueId && !user.externalOpaqueId.includes('@')
      ? user.externalOpaqueId
      : (user?.id ? user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) : 'member');
  const effectiveOfferwallUrl =
    offerwallUrl ||
    `https://aoyco.in/offerwall/223f26cc088f5bab7b79022b1d728e7d45106754ea0d38aa/${encodeURIComponent(effectiveAoySubId)}`;

  const cpxScriptWidgetSrcDoc = React.useMemo(() => {
    const safeUserId = JSON.stringify(effectiveUserId);
    const safeHash = JSON.stringify(effectiveHash);
    const safeSubId1 = JSON.stringify(effectiveUserId);

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #fullscreen {
      max-width: 950px;
      width: 100%;
      margin: auto;
      min-height: 360px;
    }
  </style>
</head>
<body>
  <div style="max-width: 950px; margin: auto" id="fullscreen"></div>
  <div style="display: none;">
    <div style="width: 100%; height: 150px;" id="single"></div>
    <div id="sidebar" style="height: 469px"></div>
    <div id="notification" style="height: 469px"></div>
    <div id="notification2" style="height: 469px"></div>
  </div>
  <script>
    // Guard against null getElementById('.style') lookups inside third-party script_tag_v2.0.js
    (function() {
      var origGetById = document.getElementById.bind(document);
      var fallbackNode = document.createElement('div');
      document.getElementById = function(id) {
        return origGetById(id) || fallbackNode;
      };
      window.addEventListener('error', function(e) {
        e.preventDefault();
        return true;
      }, true);
    })();

    const script1 = {
      div_id: "fullscreen",
      theme_style: 1,
      order_by: 2,
      limit_surveys: 12
    };

    const config = {
      general_config: {
        app_id: ${effectiveAppId},
        ext_user_id: ${safeUserId},
        email: "",
        username: "Member",
        secure_hash: ${safeHash},
        subid_1: ${safeSubId1},
        subid_2: ""
      },
      style_config: {
        text_color: "#2b2b2b",
        survey_box: {
          topbar_background_color: "#10b981",
          box_background_color: "white",
          rounded_borders: true,
          stars_filled: "#f59e0b"
        }
      },
      script_config: [script1],
      debug: false,
      useIFrame: true,
      iFramePosition: 1,
      functions: {
        no_surveys_available: () => {
          window.parent.postMessage({ source: "rr-cpx-script-tag", type: "no_surveys_available" }, "*");
        },
        count_new_surveys: (countsurveys) => {
          window.parent.postMessage({ source: "rr-cpx-script-tag", type: "count_new_surveys", count: countsurveys }, "*");
        },
        get_all_surveys: (surveys) => {
          window.parent.postMessage({ source: "rr-cpx-script-tag", type: "get_all_surveys", surveys: surveys }, "*");
        },
        get_transaction: (transactions) => {
          window.parent.postMessage({ source: "rr-cpx-script-tag", type: "get_transaction", transactions: transactions }, "*");
        }
      }
    };

    window.config = config;
  </script>
  <script type="text/javascript" src="https://cdn.cpx-research.com/assets/js/script_tag_v2.0.js"></script>
</body>
</html>`;
  }, [effectiveAppId, effectiveUserId, effectiveHash, user?.email, user?.username, user?.id, cpxWidgetReloadKey]);

  const fetchWhiteLabelTasks = async (force = false) => {
    setTasksLoading(true);
    try {
      const token = localStorage.getItem('rr_auth_token');
      const res = await fetch(`/api/tasks${force ? '?refresh=1' : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        if (data.offerwallUrl) {
          setOfferwallUrl(data.offerwallUrl);
        }
      }
    } catch {
      // ignore
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    if (captchaPassed) {
      fetchWhiteLabelTasks();
    }
  }, [captchaPassed]);

  // Countdown timer for active white-label PTC / Express task modal
  useEffect(() => {
    if (!activeTaskModal || taskSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setTaskSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTaskModal, taskSecondsLeft]);

  const handleOpenTask = (task: WhiteLabelTask) => {
    setTaskFeedback(null);
    // If live external URL from live campaign feed, open it and start timer
    if (task.launchUrl && task.launchUrl.startsWith('https://')) {
      window.open(task.launchUrl, '_blank', 'noopener,noreferrer');
    }
    setActiveTaskModal(task);
    setTaskSecondsLeft(Math.max(5, Math.min(30, task.durationSeconds || 10)));
  };

  const handleClaimTaskReward = async () => {
    if (!activeTaskModal || taskSecondsLeft > 0 || taskClaiming) return;
    setTaskClaiming(true);
    try {
      const token = localStorage.getItem('rr_auth_token');
      const res = await fetch('/api/tasks/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          taskId: activeTaskModal.id,
          title: activeTaskModal.title,
          rewardPoints: activeTaskModal.rewardPoints
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveTaskModal(null);
        if (onTaskCompleted) onTaskCompleted();
      } else {
        setTaskFeedback({
          text: data.error || 'Could not claim task reward.',
          type: 'error'
        });
        setActiveTaskModal(null);
      }
    } catch {
      setTaskFeedback({ text: 'Network error while claiming task reward.', type: 'error' });
      setActiveTaskModal(null);
    } finally {
      setTaskClaiming(false);
    }
  };

  // Launch survey card and track active survey session silently in background
  const handleLaunchSurveyCard = (survey: Survey) => {
    setTaskFeedback(null);
    setActiveSurveySession(survey);
    onStartSurvey(survey);
  };

  // Silently check with backend whether survey completion has been verified
  const handleConfirmSurveyCompletion = useCallback(async (surveyToComplete?: Survey, silent = true) => {
    const targetSurvey = surveyToComplete || activeSurveySession;
    if (!targetSurvey || completingSurvey) return;
    if (!silent) {
      setCompletingSurvey(true);
      setTaskFeedback(null);
    }

    try {
      const token = localStorage.getItem('rr_auth_token');
      const res = await fetch('/api/surveys/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          surveyId: targetSurvey.id
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.verified) {
        const creditedPts = Number(data.creditedPoints) || (targetSurvey.rewardPoints ?? targetSurvey.rewardCents * 100);
        setRewardCelebration({
          points: creditedPts,
          usd: (creditedPts / 10000).toFixed(2),
          surveyId: targetSurvey.id
        });
        setActiveSurveySession(null);
        if (onTaskCompleted) onTaskCompleted();
      }
    } catch {
      // silent background check
    } finally {
      if (!silent) {
        setCompletingSurvey(false);
      }
    }
  }, [activeSurveySession, completingSurvey, onTaskCompleted]);

  // Auto-sync user profile/ledger and silently check survey completion when user returns to tab or every 10s while a survey is open
  useEffect(() => {
    if (!activeSurveySession) return;

    const interval = setInterval(() => {
      handleConfirmSurveyCompletion(activeSurveySession, true);
      if (onTaskCompleted) onTaskCompleted();
    }, 10000);

    const handleReturnToTab = () => {
      if (document.visibilityState === 'visible') {
        handleConfirmSurveyCompletion(activeSurveySession, true);
        if (onTaskCompleted) onTaskCompleted();
      }
    };

    window.addEventListener('focus', handleReturnToTab);
    document.addEventListener('visibilitychange', handleReturnToTab);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleReturnToTab);
      document.removeEventListener('visibilitychange', handleReturnToTab);
    };
  }, [activeSurveySession, handleConfirmSurveyCompletion, onTaskCompleted]);

  // Filter surveys
  const filteredSurveys = [...surveys].sort((a, b) => {
    if (filter === 'quick') {
      return a.loiMinutes - b.loiMinutes;
    }
    if (filter === 'highest') {
      return b.rewardCents - a.rewardCents;
    }
    if (a.isTop && !b.isTop) return -1;
    if (!a.isTop && b.isTop) return 1;
    return b.rewardCents - a.rewardCents;
  });

  const filteredTasks = tasks.filter((t) => {
    if (taskTypeFilter === 'all') return true;
    return t.taskType === taskTypeFilter;
  });

  // Handle CAPTCHA checkbox click
  const handleToggleCaptchaBox = () => {
    if (captchaChecking || captchaPassed) return;
    setCaptchaCheckedBox(true);
    setCaptchaChecking(true);
    setCaptchaError(null);

    setTimeout(() => {
      setCaptchaChecking(false);
      setCaptchaPassed(true);
      sessionStorage.setItem('rr_survey_captcha_cleared', 'true');
    }, 900);
  };

  // Helper to render 5-star rating
  const renderStars = (rating: number, count = 0) => {
    const fullStars = count > 0 ? Math.max(1, Math.min(5, Math.round(rating || 5))) : 0;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              i <= fullStars ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200 dark:text-slate-700 dark:fill-slate-700'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Automatic Points Credited Celebration Animation Overlay */}
      {rewardCelebration && (
        <div
          onClick={() => setRewardCelebration(null)}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn cursor-pointer"
        >
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full border-2 border-emerald-400 dark:border-emerald-600 shadow-2xl text-center space-y-4 overflow-hidden">
            {/* Animated glowing coins */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/40 animate-bounce">
              <Coins className="w-10 h-10 text-amber-200" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-black uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Survey Completed • Auto-Credited</span>
            </div>

            <div className="space-y-1">
              <div className="text-4xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                +{rewardCelebration.points.toLocaleString('en-US')} Pts
              </div>
              <div className="text-sm font-extrabold text-slate-600 dark:text-slate-300 font-mono">
                +${rewardCelebration.usd} USD Added to Your Account!
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your top wallet balance has been updated automatically.
            </p>
          </div>
        </div>
      )}

      {taskFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            taskFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
          }`}
        >
          <span>{taskFeedback.text}</span>
          <button type="button" onClick={() => setTaskFeedback(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          VIEW A: RESEARCH SURVEYS
         ===================================================================== */}
      {marketplaceSection === 'surveys' && (
        <>
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={onRefresh} className="font-semibold underline hover:text-red-900 dark:hover:text-red-100">
                Try Again
              </button>
            </div>
          )}

          {/* Hidden background transaction listener iframe when in cards mode */}
          {surveyPresentation !== 'official_widget' && (
            <iframe
              key={cpxWidgetReloadKey}
              srcDoc={cpxScriptWidgetSrcDoc}
              title="Reward River Sync Listener"
              className="hidden"
            />
          )}

          {/* SUB-VIEW 1: EMBEDDED SURVEY WIDGET */}
          {surveyPresentation === 'official_widget' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Reward River Live Survey Wall
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSurveyPresentation('cards')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Back to Survey Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCpxWidgetReloadKey((prev) => prev + 1)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                    title="Reload Surveys"
                    aria-label="Reload Surveys"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="w-full">
                <iframe
                  key={cpxWidgetReloadKey}
                  srcDoc={cpxScriptWidgetSrcDoc}
                  title="Reward River Survey Wall"
                  className="w-full min-h-[520px] border-0 rounded-xl bg-transparent"
                  allow="clipboard-write; fullscreen"
                />
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: FULL RESPONSIVE SURVEY WALL IFRAME */}
          {surveyPresentation === 'offerwall' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-bold">Reward River Live Survey Portal</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSurveyPresentation('cards')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Back to Survey Cards</span>
                  </button>
                </div>
              </div>
              <iframe
                src={`https://wall.cpx-research.com/index.php?app_id=${cpxConfig?.appId || '37699'}&ext_user_id=${encodeURIComponent(cpxConfig?.extUserId || user?.externalOpaqueId || 'member')}${cpxConfig?.secureHash ? `&secure_hash=${cpxConfig.secureHash}` : ''}&main_color=10b981`}
                title="Reward River Survey Wall"
                className="w-full h-[750px] border-0"
                allow="clipboard-write; fullscreen"
              />
            </div>
          )}

          {/* SUB-VIEW 3: NATIVE DIRECT VERIFIED CARDS GRID */}
          {surveyPresentation === 'cards' && (
            loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 animate-pulse space-y-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="h-7 w-28 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
                      <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-md"></div>
                    </div>
                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/70 rounded"></div>
                    <div className="h-6 w-full bg-slate-100 dark:bg-slate-800/70 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : filteredSurveys.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 max-w-lg mx-auto space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">At this moment no surveys available for your profile</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Market research studies depend on your demographic profile. Please refresh shortly as new Reward River surveys become available.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <button
                    onClick={onRefresh}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Surveys</span>
                  </button>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSurveys.map((survey) => {
                const rewardPoints = survey.rewardPoints ?? survey.rewardCents * 100;
                const rewardPointsFormatted = survey.rewardPointsFormatted || rewardPoints.toLocaleString('en-US');
                const userUsdValue = (rewardPoints / 10000).toFixed(2);
                const ratingsCount = Math.max(0, Number(survey.ratingCount) || 0);

                return (
                  <div
                    key={survey.id}
                    onClick={() => handleLaunchSurveyCard(survey)}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 relative overflow-visible cursor-pointer group flex flex-col justify-between"
                  >
                    {survey.isTop && (
                      <div
                        className="absolute -top-3 -right-2.5 w-9 h-9 rounded-full bg-gradient-to-tr from-rose-500 via-red-500 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 z-10"
                        title="Top Featured Survey"
                      >
                        <Flame className="w-5 h-5 text-white fill-white" />
                      </div>
                    )}

                    <div className="px-5 pt-3.5 pb-1 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>RR #{survey.id}</span>
                      </span>
                      <span>{survey.category || 'General'}</span>
                    </div>

                    <div className="p-5 pt-2.5 flex items-stretch justify-between gap-3">
                      <div className="flex-1 flex flex-col justify-center">
                        <div className="text-emerald-500 dark:text-emerald-400 font-black text-2xl tracking-tight flex items-baseline gap-1 whitespace-nowrap">
                          <span>+ {rewardPointsFormatted}</span>
                          <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 font-sans">Pts</span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 font-mono">
                          Value: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">${userUsdValue} USD</span>
                        </div>
                      </div>

                      <div className="w-[1px] bg-slate-100 dark:bg-slate-800 shrink-0 my-1" />

                      <div className="flex-1 flex flex-col items-end justify-center text-right pl-2">
                        {renderStars(survey.ratingAvg || 0, ratingsCount)}
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                          {ratingsCount} {ratingsCount === 1 ? 'Rating' : 'Ratings'}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800" />

                    <div className="px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-2xl flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
                        <span>~ {survey.loiMinutes} {survey.loiMinutes === 1 ? 'Minute' : 'Minutes'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 transition-colors">
                        <span>Start Survey</span>
                        <ArrowRight className="w-4 h-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )
          )}
        </>
      )}

      {/* =====================================================================
          VIEW B: INSTANT TASKS & AOYCO OFFERWALL
         ===================================================================== */}
      {marketplaceSection === 'tasks' && (
        <div className="space-y-6">
          {/* Offerwall Launch Banner Card */}
          <div className="bg-gradient-to-br from-[#079B55] via-[#047A43] to-[#192F40] text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-white text-xs font-bold font-mono">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>PARTNER OFFERWALL &bull; 100% POSTBACK VERIFIED</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                Reward River Partner Offerwall
              </h3>
              <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
                Explore hundreds of mobile apps, games, free trials, and web tasks. Completed offers send an instant verified postback to credit Points straight into your account!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <a
                href={effectiveOfferwallUrl}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Full Offerwall (New Tab)</span>
              </a>
              <button
                type="button"
                onClick={() => setShowOfferwallModal(true)}
                className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Embed View</span>
              </button>
            </div>
          </div>

          {/* White-Label Tasks Grid */}
          {tasksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 animate-pulse space-y-4 shadow-sm">
                  <div className="h-6 w-28 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/70 rounded"></div>
                  <div className="h-8 w-full bg-slate-100 dark:bg-slate-800/70 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 max-w-md mx-auto space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-slate-800 text-emerald-600 flex items-center justify-center mx-auto">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">All Daily Tasks Claimed</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You have claimed the available fast-credit tasks for today! New daily tasks refresh regularly, or you can launch the Partner Offerwall above for unlimited offers.
              </p>
              <a
                href={effectiveOfferwallUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Explore Partner Offerwall</span>
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTasks.map((t) => {
                const pointsFormatted = t.rewardPoints.toLocaleString('en-US');
                return (
                  <div
                    key={t.id}
                    onClick={() => handleOpenTask(t)}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 uppercase tracking-wider font-mono">
                          {t.taskType === 'ptc' ? 'Sponsored Visit' : 'Express Task'}
                        </span>
                        <span className="text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{t.durationSeconds || 10}s</span>
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1">
                        {t.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {t.description || 'View sponsor webpage for required duration to earn Points reward.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="text-emerald-600 dark:text-emerald-400 font-mono font-black text-lg">
                        +{pointsFormatted} <span className="text-xs font-sans text-slate-500">Pts</span>
                      </div>
                      <button
                        type="button"
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1 transition-colors"
                      >
                        <span>Start</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fullscreen Embedded Offerwall Modal */}
          {showOfferwallModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
              <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-sm">Reward River Partner Offerwall</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={effectiveOfferwallUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Open in New Tab</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowOfferwallModal(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <iframe
                  src={effectiveOfferwallUrl}
                  title="Reward River Partner Offerwall"
                  className="w-full flex-1 border-0"
                  allow="clipboard-write; fullscreen"
                />
              </div>
            </div>
          )}

          {/* Active Task Claim Modal */}
          {activeTaskModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-slate-800 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <Zap className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {activeTaskModal.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {activeTaskModal.description || 'Sponsored task verification in progress.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Reward value upon completion:
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    +{activeTaskModal.rewardPoints.toLocaleString('en-US')} Points
                  </div>
                </div>

                <div className="space-y-3">
                  {taskSecondsLeft > 0 ? (
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1.5">
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Please keep sponsor window open: {taskSecondsLeft}s remaining...</span>
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Task timer complete! Ready to claim.</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTaskModal(null)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleClaimTaskReward}
                      disabled={taskSecondsLeft > 0 || taskClaiming}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {taskClaiming ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Crediting...</span>
                        </>
                      ) : (
                        <span>Claim Points</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
