import React from 'react';
import { User, UserBalances, UsdtQuote, LedgerEntry, Withdrawal } from '../types';
import { usdCentsToUsdt } from '../utils/usdt';
import {
  Coins,
  ArrowUpRight,
  ClipboardList,
  Clock,
  TrendingUp,
  CheckCircle2,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { RiverLoader } from './RiverLoader';

interface UserDashboardProps {
  user: User;
  balances: UserBalances | null;
  usdtQuote: UsdtQuote | null;
  pointsPerUsdt?: number;
  userSharePercent?: number;
  recentLedger: LedgerEntry[];
  recentWithdrawals: Withdrawal[];
  onSelectTab?: (tab: string) => void;
  onNavigateTab?: (tab: string) => void;
  onVerifyEmail: () => void;
  surveys?: any[];
  surveysLoading?: boolean;
  onStartSurvey?: (survey: any) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  user,
  balances,
  pointsPerUsdt = 10000,
  userSharePercent = 40,
  recentLedger,
  onSelectTab,
  onNavigateTab,
  surveys = [],
  surveysLoading = false,
  onStartSurvey
}) => {
  const navigate = onSelectTab || onNavigateTab || (() => {});
  const availableCents = balances?.availableCents ?? 0;
  const pendingCents = balances?.pendingCents ?? 0;
  const totalWithdrawnCents = balances?.totalWithdrawnCents ?? 0;

  const safeShare = Math.max(1, userSharePercent);
  const centsToPts = (c: number) => Math.round((Math.max(0, c) / safeShare) * pointsPerUsdt);

  const availablePoints = balances?.availablePoints ?? centsToPts(availableCents);
  const pendingPoints = balances?.pendingPoints ?? centsToPts(pendingCents);
  const totalWithdrawnPoints = centsToPts(totalWithdrawnCents);

  const availableUsdt = usdCentsToUsdt(availableCents).toFixed(2);
  const pendingUsdt = usdCentsToUsdt(pendingCents).toFixed(2);
  const totalWithdrawnUsdt = usdCentsToUsdt(totalWithdrawnCents).toFixed(2);
  const userUsdtPer10k = (safeShare / 100).toFixed(2);

  return (
    <div className="space-y-6 animate-fadeIn pb-8 max-w-7xl w-full mx-auto">
      {/* Top Welcome & Rate Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Welcome back, <span className="text-sky-600">{user.displayName || user.username || user.email.split('@')[0]}</span>!
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete surveys &amp; tasks to earn points and withdraw in USDT.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold self-start sm:self-auto font-mono">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>{pointsPerUsdt.toLocaleString('en-US')} Pts = ${userUsdtPer10k} USDT</span>
        </div>
      </div>

      {/* Main Balance Overview Card (Clean, Simple, Themed) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Available Balance Card */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Available Balance
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Ready to Withdraw
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-mono">
                {availablePoints.toLocaleString('en-US')}
              </span>
              <span className="text-sm font-bold text-slate-400">Points</span>
            </div>

            <div className="flex items-center gap-2 mt-1.5 text-emerald-700 font-mono text-base font-bold">
              <span>≈ ${availableUsdt} USDT</span>
              <span className="text-xs text-slate-400 font-sans font-normal">(1:1 USD peg)</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-slate-100">
            <button
              onClick={() => navigate('surveys')}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Start Earning (Surveys &amp; Tasks)</span>
            </button>
            <button
              onClick={() => navigate('withdraw')}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Withdraw USDT</span>
            </button>
          </div>
        </div>

        {/* Secondary Stats: Pending & Withdrawn */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold">Pending Rewards</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {pendingPoints.toLocaleString('en-US')} <span className="text-xs text-slate-400 font-sans">Pts</span>
            </div>
            <p className="text-xs text-amber-600 font-semibold font-mono mt-0.5">
              ≈ ${pendingUsdt} USDT
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold">Total Paid Out</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 font-mono">
              {totalWithdrawnPoints.toLocaleString('en-US')} <span className="text-xs text-slate-400 font-sans">Pts</span>
            </div>
            <p className="text-xs text-emerald-700 font-semibold font-mono mt-0.5">
              ≈ ${totalWithdrawnUsdt} USDT
            </p>
          </div>
        </div>
      </div>

      {/* Available Surveys Quick Preview (Simple & Direct) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span>Available Surveys &amp; Tasks</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pick a survey to start earning points right away
            </p>
          </div>
          <button
            onClick={() => navigate('surveys')}
            className="text-xs font-bold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {surveysLoading ? (
          <RiverLoader size="sm" label="Loading available surveys..." />
        ) : surveys && surveys.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {surveys.slice(0, 3).map((s, idx) => (
              <div
                key={s.id || idx}
                className="p-4 rounded-xl border border-slate-200 hover:border-sky-300 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between bg-white"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
                      +{(s.userPoints || 1000).toLocaleString('en-US')} Pts
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {s.loiMinutes || 5} mins
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                    {s.title || `Research Survey #${idx + 1}`}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ≈ ${((s.userPoints || 1000) / pointsPerUsdt * (safeShare / 100)).toFixed(2)} USDT
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => (onStartSurvey ? onStartSurvey(s) : navigate('surveys'))}
                  className="mt-3 w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all text-center cursor-pointer"
                >
                  Start Survey
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
            <ClipboardList className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
            <p className="text-xs font-medium text-slate-600">Surveys &amp; Tasks are ready!</p>
            <button
              onClick={() => navigate('surveys')}
              className="mt-2 text-xs font-bold text-sky-600 hover:underline cursor-pointer"
            >
              Click here to open survey wall &rarr;
            </button>
          </div>
        )}
      </div>

      {/* Recent Earnings History (Clean, Simple Table/List) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Earnings History</h2>
            <p className="text-xs text-slate-500 mt-0.5">Your recent rewards and credits</p>
          </div>
          <button
            onClick={() => navigate('transactions')}
            className="text-xs font-bold text-sky-600 hover:text-sky-700 inline-flex items-center gap-1 cursor-pointer"
          >
            <span>View Full Ledger</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentLedger.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Coins className="w-7 h-7 mx-auto mb-2 text-slate-300" />
            <span>No activity yet. Complete a survey to see your points credited here!</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentLedger.slice(0, 5).map(entry => {
              const entryPoints = entry.points ?? centsToPts(entry.amountCents);
              const isCredit = entry.entryType === 'credit';
              return (
                <div key={entry.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{entry.description}</p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span
                      className={`text-xs font-bold block ${
                        isCredit ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isCredit ? '+' : '-'}{entryPoints.toLocaleString('en-US')} Pts
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      ≈ ${(entry.amountCents / 100).toFixed(2)} USDT
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
