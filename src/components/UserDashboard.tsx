import React from 'react';
import { User, UserBalances, UsdtQuote, LedgerEntry, Withdrawal } from '../types';
import { usdCentsToUsdt } from '../utils/usdt';
import {
  Coins,
  ArrowUpRight,
  ClipboardList,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';

interface UserDashboardProps {
  user: User;
  balances: UserBalances | null;
  usdtQuote: UsdtQuote | null;
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
  usdtQuote,
  recentLedger,
  recentWithdrawals,
  onSelectTab,
  onNavigateTab,
  onVerifyEmail,
  surveys,
  surveysLoading,
  onStartSurvey
}) => {
  const navigate = onSelectTab || onNavigateTab || (() => {});
  const availableCents = balances?.availableCents ?? 0;
  const pendingCents = balances?.pendingCents ?? 0;
  const totalEarnedCents = balances?.totalEarnedCents ?? 0;
  const totalWithdrawnCents = balances?.totalWithdrawnCents ?? 0;

  const availableUsdt = usdCentsToUsdt(availableCents).toFixed(2);
  const pendingUsdt = usdCentsToUsdt(pendingCents).toFixed(2);

  const completedSurveysCount = recentLedger.filter(
    l => l.status === 'confirmed' && l.entryType === 'credit'
  ).length;

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* Welcome & Balance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Main Available Balance Card (Featured) */}
        <div className="md:col-span-2 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
              Available Withdrawable Balance
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Withdrawable
            </span>
          </div>

          <div className="my-4">
            <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              ${(availableCents / 100).toFixed(2)}
              <span className="text-base text-slate-400 font-normal ml-2">USD</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-emerald-400 font-mono text-sm font-semibold">
              <span className="text-emerald-500 font-bold">₮</span>
              <span>≈ {availableUsdt} USDT</span>
              <span className="text-slate-400 text-xs font-sans">
                (Pegged 1:1 USD)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => navigate('withdraw')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              Withdraw USDT
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigate('surveys')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              Earn More
              <ClipboardList className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Pending Rewards Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Pending Rewards</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              ${(pendingCents / 100).toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              ≈ {pendingUsdt} USDT
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
            Awaiting final survey sponsor validation.
          </p>
        </div>

        {/* Lifetime Confirmed & Paid Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Total Confirmed</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              ${(totalEarnedCents / 100).toFixed(2)}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
              <span>Paid Out:</span>
              <span className="font-semibold text-slate-700">${(totalWithdrawnCents / 100).toFixed(2)} USDT</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-4 border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>Surveys Completed:</span>
            <span className="font-bold text-slate-900">{completedSurveysCount}</span>
          </div>
        </div>
      </div>

      {/* Primary Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('surveys')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3 group-hover:bg-sky-600 group-hover:text-white transition-colors">
            <ClipboardList className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 mb-1">Find Surveys</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Explore live Reward River surveys tailored to your demographic.
          </p>
        </button>

        <button
          onClick={() => navigate('withdraw')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 mb-1">Withdraw USDT</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Convert balance into on-chain USDT dispatched directly to your wallet.
          </p>
        </button>

        <button
          onClick={() => navigate('transactions')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-3 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
            <Receipt className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 mb-1">Transaction Ledger</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Audit your complete immutable rewards and withdrawal history.
          </p>
        </button>

        <button
          onClick={() => navigate('settings')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mb-3 group-hover:bg-slate-700 group-hover:text-white transition-colors">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 mb-1">Account Security</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Manage your verified email, display preferences, and password.
          </p>
        </button>
      </div>

      {/* Live Market Rate & Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live USDT Feed Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                ₮
              </div>
              <h3 className="text-sm font-bold text-slate-900">USDT Stablecoin Rate</h3>
            </div>
            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              1:1 Pegged
            </span>
          </div>

          <div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              $1.00 USD
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
              <span>1 USD = 1 USDT</span>
              <span>TRC-20 & ERC-20</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600 space-y-1.5 border border-slate-100">
            <div className="flex justify-between font-medium">
              <span>TRON (TRC-20) Fee:</span>
              <span className="font-mono font-bold text-emerald-700">$1.00 USDT</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Ethereum (ERC-20) Fee:</span>
              <span className="font-mono font-bold text-slate-700">$2.50 USDT</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Min Payout:</span>
              <span className="font-mono font-bold text-slate-800">$5.00 USDT</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            USDT is pegged 1:1 to the US Dollar. Zero market volatility risk while participating in surveys.
          </p>
        </div>

        {/* Recent Ledger Activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Recent Account Activity</h3>
            <button
              onClick={() => navigate('transactions')}
              className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
            >
              View Full Ledger
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {recentLedger.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <span>No transactions yet. Complete your first survey to begin earning!</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLedger.slice(0, 5).map(entry => (
                <div key={entry.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        entry.entryType === 'credit'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {entry.entryType === 'credit' ? '+' : '-'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{entry.description}</p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(entry.createdAt).toLocaleDateString()} at{' '}
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold ${
                        entry.entryType === 'credit' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {entry.entryType === 'credit' ? '+' : '-'}${ (entry.amountCents / 100).toFixed(2) } USDT
                    </span>
                    <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                      {entry.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
