import React, { useState, useEffect, useRef } from 'react';
import { Survey, UsdtQuote, CpxConfigStatus, WhiteLabelTask, User } from '../types';
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
  Sparkles
} from 'lucide-react';

interface SurveysViewProps {
  surveys: Survey[];
  loading: boolean;
  error: string | null;
  cpxStatus: CpxConfigStatus | null;
  usdtQuote: UsdtQuote | null;
  surveyDisplayMode?: 'hybrid' | 'points_only';
  pointsPerUsdt?: number;
  userSharePercent?: number;
  onRefresh: () => void;
  onStartSurvey: (survey: Survey) => void;
  onTaskCompleted?: () => void;
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
  surveyDisplayMode = 'hybrid',
  pointsPerUsdt = 10000,
  userSharePercent = 40,
  onRefresh,
  onStartSurvey,
  onTaskCompleted,
  user,
  cpxConfig
}) => {
  const [marketplaceSection, setMarketplaceSection] = useState<'surveys' | 'tasks'>('surveys');
  const [filter, setFilter] = useState<'all' | 'quick' | 'highest'>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<'all' | 'ptc' | 'shortlink'>('all');

  const [tasks, setTasks] = useState<WhiteLabelTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [activeTaskModal, setActiveTaskModal] = useState<WhiteLabelTask | null>(null);
  const [taskSecondsLeft, setTaskSecondsLeft] = useState(0);
  const [taskClaiming, setTaskClaiming] = useState(false);
  const [taskFeedback, setTaskFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const userUsdtPer10k = (userSharePercent / 100).toFixed(2);
  const minWithdrawPoints = Math.round((2500 / Math.max(1, userSharePercent)) * pointsPerUsdt);

  // Presentation mode for CPX Surveys:
  // 'cards': Reward River verified responsive cards
  // 'official_widget': Official CPX Script Tag widget into <div id="fullscreen">
  // 'offerwall': Full interactive CPX wall iframe
  const [surveyPresentation, setSurveyPresentation] = useState<'cards' | 'official_widget' | 'offerwall'>('cards');
  const [cpxWidgetCount, setCpxWidgetCount] = useState<number | null>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);

  // Single Page-Level CAPTCHA verification state
  const [captchaPassed, setCaptchaPassed] = useState<boolean>(() => {
    return Boolean(sessionStorage.getItem('rr_survey_captcha_cleared'));
  });

  const [captchaChecking, setCaptchaChecking] = useState(false);
  const [captchaCheckedBox, setCaptchaCheckedBox] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  // Official CPX Research Script Tag v2.0 loader (Step 1, Step 2 & Step 3 compliant)
  useEffect(() => {
    if (marketplaceSection !== 'surveys' || surveyPresentation !== 'official_widget' || !captchaPassed) {
      return;
    }

    const effectiveAppId = Number(cpxConfig?.appId || '37699') || 37699;
    const effectiveUserId = cpxConfig?.extUserId || (user ? (user.externalOpaqueId || `rr_${user.id}`) : 'rr_member_1');
    const effectiveHash = cpxConfig?.secureHash || '';

    const script1 = {
      div_id: 'fullscreen',
      theme_style: 1,
      order_by: 2,
      limit_surveys: 12
    };

    const script2 = {
      div_id: 'sidebar',
      theme_style: 1,
      order_by: 1
    };

    const script3 = {
      div_id: 'single',
      theme_style: 3,
      display_mode: 1
    };

    const script4 = {
      div_id: 'notification',
      theme_style: 4,
      position: 5,
      text: '',
      link: '',
      newtab: true
    };

    const script5 = {
      div_id: 'notification2',
      theme_style: 4,
      position: 6,
      text: '',
      link: `https://wall.cpx-research.com/index.php?app_id=${effectiveAppId}&ext_user_id=${encodeURIComponent(effectiveUserId)}`,
      newtab: true
    };

    // Set window.config according to official CPX Research documentation
    (window as any).config = {
      general_config: {
        app_id: effectiveAppId,
        ext_user_id: effectiveUserId,
        email: user?.email || '',
        username: user?.username || '',
        secure_hash: effectiveHash,
        subid_1: 'rewardriver',
        subid_2: ''
      },
      style_config: {
        text_color: '#2b2b2b',
        survey_box: {
          topbar_background_color: '#10b981',
          box_background_color: 'white',
          rounded_borders: true,
          stars_filled: '#f59e0b'
        }
      },
      script_config: [script1, script2, script3, script4, script5],
      debug: false,
      useIFrame: true,
      iFramePosition: 1,
      functions: {
        no_surveys_available: () => {
          console.log('no surveys available function here');
        },
        count_new_surveys: (countsurveys: number) => {
          console.log('count surveys function here, count:', countsurveys);
          setCpxWidgetCount(countsurveys);
        },
        get_all_surveys: (allSurveys: any) => {
          console.log('get all surveys function here, surveys: ', allSurveys);
          if (Array.isArray(allSurveys)) {
            setCpxWidgetCount(allSurveys.length);
          }
        },
        get_transaction: (transactions: any) => {
          console.log('transaction function here, transaction: ', transactions);
          if (onTaskCompleted) onTaskCompleted();
        }
      }
    };

    // Load or reload CPX CDN script right after window.config
    const scriptId = 'cpx-research-official-script';
    const oldScript = document.getElementById(scriptId);
    if (oldScript) {
      oldScript.remove();
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'text/javascript';
    script.src = 'https://cdn.cpx-research.com/assets/js/script_tag_v2.0.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Optional cleanup
    };
  }, [marketplaceSection, surveyPresentation, captchaPassed, cpxConfig, user, onTaskCompleted]);

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
        setTaskFeedback({
          text: `Credited +${data.creditedPointsFormatted} Pts (${data.creditedUsdt}) to your Reward River balance!`,
          type: 'success'
        });
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

  // Helper to render 5-star rating matching real CPX statistics_rating_avg & statistics_rating_count
  const renderStars = (rating: number, count = 0) => {
    const fullStars = count > 0 ? Math.max(1, Math.min(5, Math.round(rating || 5))) : 0;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              i <= fullStars ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'
            }`}
          />
        ))}
      </div>
    );
  };

  // IF CAPTCHA NOT PASSED -> SHOW SINGLE GLOBAL PAGE-LEVEL CAPTCHA STEP
  if (!captchaPassed) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 space-y-6 animate-fadeIn">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl relative overflow-hidden text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-sky-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Security Verification Required
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
              Please clear the human verification check below to unlock the live Reward River survey &amp; instant task marketplace.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-left space-y-4 max-w-sm mx-auto shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Page-Level Security Check</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Reward River Protection
              </span>
            </div>

            <div
              onClick={handleToggleCaptchaBox}
              className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer select-none ${
                captchaCheckedBox
                  ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-300 hover:border-emerald-400 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    captchaCheckedBox
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-400 bg-white'
                  }`}
                >
                  {captchaChecking ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : captchaCheckedBox ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : null}
                </div>
                <span className="text-xs font-bold text-slate-800">
                  {captchaChecking
                    ? 'Verifying human participant...'
                    : captchaCheckedBox
                    ? 'Verification Successful!'
                    : "I'm not a robot"}
                </span>
              </div>

              <div className="flex flex-col items-end">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="text-[9px] font-bold text-slate-400 mt-0.5">CAPTCHA</span>
              </div>
            </div>

            {captchaError && (
              <p className="text-[11px] text-red-600 font-medium">{captchaError}</p>
            )}
          </div>

          <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Pass once to access all surveys &amp; instant tasks seamlessly without popup verifications.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top White-Label Marketplace Mode Switcher */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {marketplaceSection === 'surveys' ? 'Choose a survey' : 'Reward River Instant Tasks'}
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                ✓ CAPTCHA Verified
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-mono">
                {pointsPerUsdt.toLocaleString('en-US')} Pts = ${userUsdtPer10k} USDT
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {marketplaceSection === 'surveys'
                ? `Complete any research survey below to earn instant Points & withdrawable USDT (${minWithdrawPoints.toLocaleString('en-US')} Pts = $25.00 USDT min withdrawal).`
                : 'Complete Reward River sponsored partner visits & express verification links for instant Points & USDT credit.'}
            </p>
          </div>

          {/* Primary Switcher: Research Surveys vs Instant Tasks & PTC */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setMarketplaceSection('surveys')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
                  marketplaceSection === 'surveys'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Research Surveys ({surveys.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMarketplaceSection('tasks')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
                  marketplaceSection === 'tasks'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Instant Tasks &amp; PTC ({tasks.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* CPX Research Display Mode Selector */}
        {marketplaceSection === 'surveys' && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setSurveyPresentation('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  surveyPresentation === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Real Survey Cards ({surveys.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSurveyPresentation('official_widget')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  surveyPresentation === 'official_widget'
                    ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Official CPX Widget {cpxWidgetCount !== null ? `(${cpxWidgetCount})` : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => setSurveyPresentation('offerwall')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  surveyPresentation === 'offerwall'
                    ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                <span>Live Offerwall</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>CPX Connected (App #{cpxConfig?.appId || '37699'})</span>
              </span>
            </div>
          </div>
        )}

        {/* Sub-filters Bar */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {marketplaceSection === 'surveys' ? (
            surveyPresentation === 'cards' ? (
              <>
                <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      filter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Recommended
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('quick')}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      filter === 'quick' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Quickest
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('highest')}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      filter === 'highest' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Highest Reward
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 transition-colors"
                  title="Refresh Surveys"
                  aria-label="Refresh Surveys"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
              </>
            ) : (
              <div className="text-xs text-slate-500 font-medium">
                {surveyPresentation === 'official_widget'
                  ? 'Official CPX Research script tag v2.0 rendered into #fullscreen container'
                  : 'Official CPX Research live responsive Offerwall iframe'}
              </div>
            )
          ) : (
            <>
              <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTaskTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    taskTypeFilter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Tasks ({tasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskTypeFilter('ptc')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    taskTypeFilter === 'ptc' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sponsored Visits (PTC)
                </button>
                <button
                  type="button"
                  onClick={() => setTaskTypeFilter('shortlink')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    taskTypeFilter === 'shortlink' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Express Links
                </button>
              </div>
              <button
                type="button"
                onClick={() => fetchWhiteLabelTasks(true)}
                disabled={tasksLoading}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 transition-colors"
                title="Refresh Instant Tasks"
                aria-label="Refresh Instant Tasks"
              >
                <RefreshCw className={`w-4 h-4 ${tasksLoading ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            </>
          )}
        </div>
      </div>

      {taskFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            taskFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <span>{taskFeedback.text}</span>
          <button type="button" onClick={() => setTaskFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          VIEW A: RESEARCH SURVEYS
         ===================================================================== */}
      {marketplaceSection === 'surveys' && (
        <>
          {cpxStatus && !cpxStatus.isConfigured && (
            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Reward River live survey stream synchronized. Click any survey card to participate immediately.</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={onRefresh} className="font-semibold underline hover:text-red-900">
                Try Again
              </button>
            </div>
          )}

          {/* SUB-VIEW 1: OFFICIAL CPX RESEARCH JAVASCRIPT SCRIPT WIDGET */}
          {surveyPresentation === 'official_widget' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold text-slate-800">
                    Official CPX Research CDN Widget (script_tag_v2.0.js)
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                    App #{cpxConfig?.appId || '37699'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://offers.cpx-research.com/index.php?app_id=${cpxConfig?.appId || '37699'}&ext_user_id=${encodeURIComponent(cpxConfig?.extUserId || user?.externalOpaqueId || 'member')}${cpxConfig?.secureHash ? `&secure_hash=${cpxConfig.secureHash}` : ''}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Standalone Wall</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const oldScript = document.getElementById('cpx-research-official-script');
                      if (oldScript) oldScript.remove();
                      const script = document.createElement('script');
                      script.id = 'cpx-research-official-script';
                      script.src = 'https://cdn.cpx-research.com/assets/js/script_tag_v2.0.js';
                      document.body.appendChild(script);
                    }}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    title="Reload CPX Widget"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Exact container IDs requested in official CPX documentation (Step 3) */}
              <div className="w-full flex justify-center py-2">
                <div
                  id="fullscreen"
                  ref={widgetContainerRef}
                  style={{ maxWidth: '950px', width: '100%', margin: 'auto', minHeight: '380px' }}
                  className="cpx-research-fullscreen-container"
                >
                  <div className="text-center py-12 space-y-3 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                    <p className="text-xs font-semibold text-slate-600">Connecting to official CPX Research widget stream...</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      If your browser ad-blocker blocks CDN scripts, click the <strong className="text-slate-700">Real Survey Cards</strong> tab above to view real surveys directly.
                    </p>
                  </div>
                </div>
              </div>
              <div className="hidden">
                <div id="single" style={{ width: '100%', height: '150px' }} />
                <div id="sidebar" style={{ height: '469px' }} />
                <div id="notification" style={{ height: '469px' }} />
                <div id="notification2" style={{ height: '469px' }} />
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: FULL RESPONSIVE CPX OFFERWALL IFRAME */}
          {surveyPresentation === 'offerwall' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-bold">CPX Research Live Offerwall (App #{cpxConfig?.appId || '37699'})</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://wall.cpx-research.com/index.php?app_id=${cpxConfig?.appId || '37699'}&ext_user_id=${encodeURIComponent(cpxConfig?.extUserId || user?.externalOpaqueId || 'member')}${cpxConfig?.secureHash ? `&secure_hash=${cpxConfig.secureHash}` : ''}&main_color=10b981`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Full Browser Tab</span>
                  </a>
                </div>
              </div>
              <iframe
                src={`https://wall.cpx-research.com/index.php?app_id=${cpxConfig?.appId || '37699'}&ext_user_id=${encodeURIComponent(cpxConfig?.extUserId || user?.externalOpaqueId || 'member')}${cpxConfig?.secureHash ? `&secure_hash=${cpxConfig.secureHash}` : ''}&main_color=10b981`}
                title="CPX Research Offerwall"
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
                  <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 animate-pulse space-y-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="h-7 w-28 bg-slate-200 rounded-md"></div>
                      <div className="h-6 w-20 bg-slate-200 rounded-md"></div>
                    </div>
                    <div className="h-4 w-full bg-slate-100 rounded"></div>
                    <div className="h-6 w-full bg-slate-100 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : filteredSurveys.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-lg mx-auto space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">At this moment no surveys available for your profile</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Market research studies depend on your demographic profile. You can also view the Official CPX Widget or complete Instant Tasks &amp; PTC.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <button
                    onClick={() => setSurveyPresentation('official_widget')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Switch to Official CPX Widget</span>
                  </button>
                  <button
                    onClick={() => setMarketplaceSection('tasks')}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Open Instant Tasks &amp; PTC</span>
                  </button>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSurveys.map((survey) => {
                const rewardAmountUsdt = (survey.rewardCents / 100).toFixed(2);
                const rewardPoints = survey.rewardPoints ?? survey.rewardCents * 100;
                const rewardPointsFormatted = survey.rewardPointsFormatted || rewardPoints.toLocaleString('en-US');
                const ratingsCount = Math.max(0, Number(survey.ratingCount) || 0);

                return (
                  <div
                    key={survey.id}
                    onClick={() => onStartSurvey(survey)}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 relative overflow-visible cursor-pointer group flex flex-col justify-between"
                  >
                    {survey.isTop && (
                      <div
                        className="absolute -top-3 -right-2.5 w-9 h-9 rounded-full bg-gradient-to-tr from-rose-500 via-red-500 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 z-10"
                        title="Top CPX Research Survey"
                      >
                        <Flame className="w-5 h-5 text-white fill-white" />
                      </div>
                    )}

                    <div className="px-5 pt-3.5 pb-1 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50/90 px-2 py-0.5 rounded border border-emerald-200/60 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>CPX #{survey.id}</span>
                      </span>
                      <span>{survey.category || 'General'}</span>
                    </div>

                    <div className="p-5 pt-2.5 flex items-stretch justify-between gap-3">
                      <div className="flex-1 flex flex-col justify-center">
                        <div className="text-emerald-500 font-black text-2xl tracking-tight flex items-baseline gap-1">
                          <span>+ {rewardPointsFormatted}</span>
                          <span className="text-xs font-extrabold uppercase text-slate-700 font-sans">Pts</span>
                        </div>
                        {surveyDisplayMode !== 'points_only' && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70 w-fit">
                            <span>≈ ${rewardAmountUsdt} USDT</span>
                          </div>
                        )}
                      </div>

                      <div className="w-[1px] bg-slate-100 shrink-0 my-1" />

                      <div className="flex-1 flex flex-col items-end justify-center text-right pl-2">
                        {renderStars(survey.ratingAvg || 0, ratingsCount)}
                        <span className="text-[11px] font-semibold text-slate-500 mt-1">
                          {ratingsCount} {ratingsCount === 1 ? 'Rating' : 'Ratings'}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100" />

                    <div className="px-5 py-3.5 bg-slate-50/50 rounded-b-2xl flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                        <span>~ {survey.loiMinutes} {survey.loiMinutes === 1 ? 'Minute' : 'Minutes'}</span>
                      </div>

                      <div className="flex items-center gap-1 text-amber-500 font-extrabold group-hover:text-amber-600 transition-colors">
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
          VIEW B: WHITE-LABEL REWARD RIVER INSTANT TASKS & PTC
         ===================================================================== */}
      {marketplaceSection === 'tasks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => handleOpenTask(task)}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 relative overflow-visible cursor-pointer group flex flex-col justify-between"
            >
              {task.isFeatured && (
                <div
                  className="absolute -top-3 -right-2.5 w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 z-10"
                  title="Featured Reward River Task"
                >
                  <Zap className="w-4 h-4 text-white fill-white" />
                </div>
              )}

              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-emerald-500 font-black text-2xl tracking-tight flex items-baseline gap-1">
                      <span>+ {task.rewardPointsFormatted}</span>
                      <span className="text-xs font-extrabold uppercase text-slate-700 font-sans">Pts</span>
                    </div>
                    {surveyDisplayMode !== 'points_only' && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70 w-fit">
                        <span>≈ ${task.rewardUsdtFormatted} USDT</span>
                      </div>
                    )}
                  </div>

                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider">
                    {task.taskType === 'ptc' ? 'Sponsored Visit' : `Express Link (${task.availableClaims}/${task.dailyLimit})`}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {task.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100" />

              <div className="px-5 py-3.5 bg-slate-50/50 rounded-b-2xl flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{task.durationSeconds} Seconds</span>
                </div>

                <div className="flex items-center gap-1 text-emerald-600 font-extrabold text-xs group-hover:text-emerald-700">
                  <span>Start Task</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* White-Label Reward River Task Timer Modal */}
      {activeTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-600">
                    Reward River Verified Partner Task
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{activeTaskModal.title}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTaskModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-3">
              <div className="text-xs font-semibold text-slate-500">
                {taskSecondsLeft > 0
                  ? 'Keep this window open while your Reward River partner visit is verified...'
                  : 'Verification complete! Click below to claim your Points & USDT reward.'}
              </div>

              <div className="text-3xl font-black font-mono text-slate-900">
                {taskSecondsLeft > 0 ? `${taskSecondsLeft}s remaining` : 'Ready to Claim!'}
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold font-mono">
                <span>Reward: +{activeTaskModal.rewardPointsFormatted} Pts</span>
                <span>(≈ ${activeTaskModal.rewardUsdtFormatted} USDT)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActiveTaskModal(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={taskSecondsLeft > 0 || taskClaiming}
                onClick={handleClaimTaskReward}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white text-xs font-bold transition-colors"
              >
                {taskClaiming
                  ? 'Crediting Balance...'
                  : taskSecondsLeft > 0
                  ? `Wait ${taskSecondsLeft}s...`
                  : `Claim +${activeTaskModal.rewardPointsFormatted} Pts ($${activeTaskModal.rewardUsdtFormatted} USDT)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Disclaimer */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <p>
          <strong>Seamless Redirect Notice:</strong> Single page-level CAPTCHA verification cleared. Clicking any survey or instant task card opens immediately. Confirmed completions credit your Reward River Points &amp; USDT balance automatically.
        </p>
      </div>
    </div>
  );
};
