import React, { useState } from 'react';
import { User, UserBalances, UsdtQuote, Withdrawal } from '../types';
import {
  calculateUsdtPayout,
  UsdtNetwork
} from '../utils/usdt';
import {
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Coins,
  Wallet,
  ArrowLeft
} from 'lucide-react';

interface WithdrawalViewProps {
  user: User;
  balances: UserBalances | null;
  usdtQuote: UsdtQuote | null;
  pointsPerUsdt?: number;
  userSharePercent?: number;
  withdrawals: Withdrawal[];
  onRefresh?: () => void;
  onRefreshQuote?: () => void;
  onBackToSurveys?: () => void;
  onSubmitWithdrawal: (usdtAddress: string, network: UsdtNetwork, amountCents: number) => Promise<{ success: boolean; error?: string }>;
  onVerifyEmail?: () => void;
}

export const WithdrawalView: React.FC<WithdrawalViewProps> = ({
  balances,
  withdrawals,
  onRefresh,
  onRefreshQuote,
  onBackToSurveys,
  onSubmitWithdrawal
}) => {
  const [usdtAddress, setUsdtAddress] = useState('');
  const [network, setNetwork] = useState<UsdtNetwork>('TRC20');
  const [amountUsd, setAmountUsd] = useState('25.00');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Plan Economics:
  // 10,000 Points = $1.00 USD (100 Points = $0.01 = 1 cent)
  // Minimum Withdrawal = $25.00 USD = 250,000 Points
  const minWithdrawPoints = 250000;
  const maxWithdrawPoints = 5000000;

  const availablePoints = balances?.availablePoints ?? (balances?.availableCents ? balances.availableCents * 100 : 0);
  const availableCents = Math.floor(availablePoints / 100);
  const availableUsd = (availablePoints / 10000).toFixed(2);
  const totalEarnedPoints = balances?.totalEarnedPoints ?? availablePoints;
  const totalWithdrawnPoints = balances?.totalWithdrawnPoints ?? 0;

  const progressPercent = Math.min(100, Math.round((availablePoints / minWithdrawPoints) * 100));
  const pointsRemainingForMin = Math.max(0, minWithdrawPoints - availablePoints);

  // Fee: $1.00 for TRC20, $2.50 for ERC20
  const feeCents = network === 'TRC20' ? 100 : 250;
  const amountCents = Math.round((parseFloat(amountUsd) || 0) * 100);
  const requestedPoints = Math.max(0, amountCents * 100); // 100 Points = 1 cent ($1 = 10,000 Points)
  const payoutCalc = calculateUsdtPayout(amountCents, network, feeCents);

  const handleSetMax = () => {
    if (availableCents >= 2500) {
      setAmountUsd((availableCents / 100).toFixed(2));
    } else {
      setAmountUsd('25.00');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const cleanAddr = usdtAddress.trim();
    if (!cleanAddr || cleanAddr.length < 6) {
      setFormError('Please enter your valid USDT wallet address (TRC-20 or ERC-20).');
      return;
    }

    if (amountCents < 2500) {
      setFormError('Minimum withdrawal is $25.00 USD (250,000 Points).');
      return;
    }

    if (amountCents > availableCents) {
      setFormError(
        `Insufficient balance. You currently have ${availablePoints.toLocaleString('en-US')} Points ($${availableUsd} USD), and minimum withdrawal is 250,000 Points ($25.00 USD).`
      );
      return;
    }

    if (!payoutCalc.isViable) {
      setFormError(payoutCalc.error || 'Requested amount is too low after network fee.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmitWithdrawal(cleanAddr, network, amountCents);
      if (!result.success) {
        setFormError(result.error || 'Failed to submit withdrawal request.');
      } else {
        setSuccessMessage(
          `Your withdrawal request for $${(amountCents / 100).toFixed(2)} USD (${requestedPoints.toLocaleString('en-US')} Points) has been sent to the Admin Portal for payout!`
        );
        setUsdtAddress('');
        setAmountUsd('25.00');
      }
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Summary Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-[#D9EFE3] dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Available Points</span>
            <Coins className="w-4 h-4 text-[#079B55]" />
          </div>
          <div className="text-2xl font-black text-[#192F40] dark:text-white font-mono mt-1">
            {availablePoints.toLocaleString('en-US')} <span className="text-sm font-sans text-slate-400">Pts</span>
          </div>
          <div className="text-xs font-bold text-[#079B55] dark:text-emerald-400 mt-1">
            Cash Value: ${availableUsd} USD
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-[#D9EFE3] dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Minimum Withdrawal</span>
            <Wallet className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-[#192F40] dark:text-white font-mono mt-1">
            $25.00 <span className="text-sm font-sans text-slate-400">USD</span>
          </div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
            Requires 250,000 Points
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-[#D9EFE3] dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Goal Progress ($25.00)</span>
            <span className="text-xs font-black text-[#079B55] font-mono">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-3">
            <div
              className="h-full bg-[#079B55] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
            {pointsRemainingForMin > 0
              ? `${pointsRemainingForMin.toLocaleString('en-US')} more Points needed to unlock $25.00 withdrawal`
              : 'Minimum reached! You can submit a withdrawal request now.'}
          </div>
        </div>
      </div>

      {/* Main Withdrawal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Withdrawal Form Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-[#D9EFE3] dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-[#192F40] dark:text-white">
                Request Withdrawal
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When you submit this request, it goes directly to the Admin Portal for fast verification and payout.
              </p>
            </div>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 font-semibold flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Network Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                1. Choose Payout Network
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNetwork('TRC20')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    network === 'TRC20'
                      ? 'border-[#079B55] bg-[#F0FBF5] dark:bg-emerald-950/40 text-slate-900 dark:text-white ring-1 ring-[#079B55]'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs">USDT (TRC-20)</span>
                    <span className="text-[10px] uppercase font-bold text-[#079B55] bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                      Recommended
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    TRON Network • $1.00 Fee
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setNetwork('ERC20')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    network === 'ERC20'
                      ? 'border-[#079B55] bg-[#F0FBF5] dark:bg-emerald-950/40 text-slate-900 dark:text-white ring-1 ring-[#079B55]'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs">USDT (ERC-20)</span>
                    <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      Ethereum
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    ERC-20 Network • $2.50 Fee
                  </span>
                </button>
              </div>
            </div>

            {/* USDT Destination Address */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                2. Your {network} Wallet Address
              </label>
              <input
                type="text"
                required
                value={usdtAddress}
                onChange={e => setUsdtAddress(e.target.value)}
                placeholder={
                  network === 'TRC20'
                    ? 'Enter your TRC-20 USDT Wallet Address (starts with T...)'
                    : 'Enter your ERC-20 USDT Wallet Address (starts with 0x...)'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#079B55] font-mono text-xs sm:text-sm text-slate-900 dark:text-white"
              />
            </div>

            {/* Withdrawal Amount (USD / USDT) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  3. Amount to Withdraw in USD ({requestedPoints.toLocaleString('en-US')} Points)
                </label>
                <button
                  type="button"
                  onClick={handleSetMax}
                  className="text-[11px] font-extrabold text-[#079B55] hover:underline cursor-pointer"
                >
                  Withdraw Full Balance (${availableUsd})
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="25.00"
                  max="500.00"
                  required
                  value={amountUsd}
                  onChange={e => setAmountUsd(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#079B55] text-sm font-bold text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                <span>Minimum: $25.00 USD ({minWithdrawPoints.toLocaleString('en-US')} Points)</span>
                <span>Maximum: $500.00 USD ({maxWithdrawPoints.toLocaleString('en-US')} Points)</span>
              </div>
            </div>

            {/* Payout Breakdown */}
            <div className="bg-[#F0FBF5]/70 dark:bg-slate-800/70 rounded-xl p-4 border border-[#D9EFE3] dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Points to Redeem (10,000 Pts = $1.00):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {requestedPoints.toLocaleString('en-US')} Pts
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Withdrawal Amount:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ${payoutCalc.grossUsdt} USD
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Network Fee ({network}):</span>
                <span className="font-mono font-semibold text-amber-600">
                  - ${payoutCalc.feeUsdt} USD
                </span>
              </div>
              <div className="pt-2 border-t border-[#D9EFE3] dark:border-slate-700 flex justify-between font-extrabold text-slate-900 dark:text-white">
                <span className="text-sm">You Receive (Net Payout):</span>
                <span className="text-sm text-[#079B55] dark:text-emerald-400 font-mono">
                  ${payoutCalc.netUsdt} USDT
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#079B55] hover:bg-[#058246] disabled:opacity-50 text-white font-extrabold text-sm shadow-sm hover:shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending Request to Admin...</span>
                </>
              ) : (
                <>
                  <span>Withdrawal Request</span>
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Simple How It Works Sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-[#D9EFE3] dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#079B55]" />
              <span>How Withdrawals Work</span>
            </h3>

            <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#079B55] shrink-0 mt-0.5" />
                <span>
                  <strong>100% Full Survey Points:</strong> Every survey you complete adds full Points to your account (e.g., 2,000 Pts survey = +2,000 Pts).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#079B55] shrink-0 mt-0.5" />
                <span>
                  <strong>Fixed Redemption Rate:</strong> <strong>10,000 Points = $1.00 USD</strong> (2,000 Points = $0.20 USD).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#079B55] shrink-0 mt-0.5" />
                <span>
                  <strong>$25.00 Minimum Withdrawal:</strong> Once your balance reaches <strong>250,000 Points ($25.00 USD)</strong>, submit your wallet address here.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#079B55] shrink-0 mt-0.5" />
                <span>
                  <strong>Direct Admin Payout:</strong> Your request appears immediately in the Admin Portal and is paid directly to your wallet.
                </span>
              </li>
            </ul>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Total Earned Points:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{totalEarnedPoints.toLocaleString('en-US')} Pts</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Total Withdrawn Points:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{totalWithdrawnPoints.toLocaleString('en-US')} Pts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Withdrawal History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-[#D9EFE3] dark:border-slate-800 shadow-sm">
        <h3 className="text-base font-extrabold text-[#192F40] dark:text-white mb-4">
          Your Withdrawal Requests ({withdrawals.length})
        </h3>

        {withdrawals.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <span>No withdrawal requests yet. Once you submit a request, its live status will appear here.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Points Redeemed</th>
                  <th className="py-3 px-3">USD Amount</th>
                  <th className="py-3 px-3">Net Payout</th>
                  <th className="py-3 px-3">Network &amp; Wallet</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Admin Notes / TxHash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {withdrawals.map(w => {
                  const statusColors: Record<string, string> = {
                    requested: 'bg-amber-50 text-amber-700 border-amber-200',
                    under_review: 'bg-amber-50 text-amber-700 border-amber-200',
                    approved: 'bg-blue-50 text-blue-700 border-blue-200',
                    processing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    rejected: 'bg-red-50 text-red-700 border-red-200',
                    failed: 'bg-red-50 text-red-700 border-red-200',
                    cancelled: 'bg-slate-100 text-slate-700 border-slate-200'
                  };

                  const ptsRedeemed = Math.round(w.amountCents * 100);
                  const explorerBase = w.network === 'TRC20'
                    ? 'https://tronscan.org/#/transaction/'
                    : 'https://etherscan.io/tx/';

                  return (
                    <tr key={w.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {new Date(w.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-[#079B55] dark:text-emerald-400">
                        {ptsRedeemed.toLocaleString('en-US')} Pts
                      </td>
                      <td className="py-3 px-3 font-bold font-mono text-slate-900 dark:text-white">
                        ${(w.amountCents / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                        ${w.netUsdt} USDT
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-800 dark:text-slate-200">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold mr-1.5">
                          {w.network}
                        </span>
                        {w.usdtAddress}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            statusColors[w.status] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {w.status === 'under_review' ? 'Pending Admin Review' : w.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                        {w.txHash ? (
                          <a
                            href={`${explorerBase}${w.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                          >
                            <span>{w.txHash}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {w.reviewNotes || 'Sent to Admin Portal'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
