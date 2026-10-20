import React, { useState } from 'react';
import { Survey, UsdtQuote, CpxConfigStatus } from '../types';
import { usdCentsToUsdt } from '../utils/usdt';
import {
  ClipboardList,
  Clock,
  Star,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';

interface SurveysViewProps {
  surveys: Survey[];
  loading: boolean;
  error: string | null;
  cpxStatus: CpxConfigStatus | null;
  usdtQuote: UsdtQuote | null;
  onRefresh: () => void;
  onStartSurvey: (survey: Survey) => void;
}

export const SurveysView: React.FC<SurveysViewProps> = ({
  surveys,
  loading,
  error,
  cpxStatus,
  onRefresh,
  onStartSurvey
}) => {
  const [filter, setFilter] = useState<'all' | 'quick' | 'highest'>('all');

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

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Available Surveys
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Reward River Survey Stream • USDT Payouts
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Participate in research studies and earn confirmed USDT stablecoin rewards.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center rounded-xl bg-white border border-slate-200 p-1 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === 'all' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Recommended
            </button>
            <button
              onClick={() => setFilter('quick')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === 'quick' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quickest
            </button>
            <button
              onClick={() => setFilter('highest')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === 'highest' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Highest Reward
            </button>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50 transition-colors"
            title="Refresh Surveys"
            aria-label="Refresh Surveys"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Integration Status Notice */}
      {cpxStatus && !cpxStatus.isConfigured && (
        <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-100 text-xs text-sky-900 flex items-start gap-3">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Survey Feed Status: Reward River Live Stream</p>
            <p className="text-slate-600 leading-relaxed">
              Surveys are synchronized continuously. Complete qualified surveys to receive real-time USDT stablecoin credits directly to your Reward River balance.
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={onRefresh}
            className="font-semibold underline hover:text-red-900"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 animate-pulse space-y-4">
              <div className="flex justify-between items-start">
                <div className="h-5 w-24 bg-slate-200 rounded-md"></div>
                <div className="h-5 w-16 bg-slate-200 rounded-md"></div>
              </div>
              <div className="h-8 w-32 bg-slate-200 rounded-md"></div>
              <div className="h-10 w-full bg-slate-100 rounded-xl"></div>
            </div>
          ))}
        </div>
      ) : filteredSurveys.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 max-w-lg mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">At this moment no surveys available for your profile</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Market research studies depend on your demographic profile, country, and sponsor quota limits. Check back in a few hours as new research inventories are refreshed regularly.
          </p>
          <button
            onClick={onRefresh}
            className="mt-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Check For Available Surveys
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSurveys.map(survey => {
            const usdt = usdCentsToUsdt(survey.rewardCents).toFixed(2);
            return (
              <div
                key={survey.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between relative group"
              >
                {survey.isTop && (
                  <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Top Pick
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-sky-600" />
                      <span>{survey.loiMinutes} mins</span>
                    </div>

                    <div className="flex items-center gap-1 text-amber-500 font-semibold">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{survey.ratingAvg.toFixed(1)}</span>
                      {survey.ratingCount > 0 && (
                        <span className="text-slate-400 font-normal">({survey.ratingCount})</span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-1 group-hover:text-emerald-700 transition-colors">
                    Consumer Opinion Survey #{survey.id}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                    Research study by verified sponsor. Answer questions to completion to claim your reward.
                  </p>

                  <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Estimated Reward
                      </span>
                      <span className="text-lg font-extrabold text-slate-900">
                        {survey.rewardUsdFormatted}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        USDT Value
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-700">
                        {usdt} USDT
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onStartSurvey(survey)}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 group-hover:shadow"
                >
                  <span>Start Survey</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer Card */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p>
          <strong>Participation Note:</strong> When you complete a survey session, your responses are verified by the research sponsor. Approved completions automatically trigger verified crediting to your Reward River balance in USDT.
        </p>
      </div>
    </div>
  );
};
