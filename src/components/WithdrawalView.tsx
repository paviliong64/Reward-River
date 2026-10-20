import React, { useState } from 'react';
import { User, UserBalances, UsdtQuote, Withdrawal } from '../types';
import {
  validateUsdtAddress,
  calculateUsdtPayout,
  usdCentsToUsdt,
  UsdtNetwork
} from '../utils/usdt';
import {
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Info,
  RefreshCw
} from 'lucide-react';

interface WithdrawalViewProps {
  user: User;
  balances: UserBalances | null;
  usdtQuote: UsdtQuote | null;
  withdrawals: Withdrawal[];
  onRefreshQuote: () => void;
  onSubmitWithdrawal: (usdtAddress: string, network: UsdtNetwork, amountCents: number) => Promise<{ success: boolean; error?: string }>;
  onVerifyEmail: () => void;
}

export const WithdrawalView: React.FC<WithdrawalViewProps> = ({
  user,
  balances,
  withdrawals,
  onRefreshQuote,
  onSubmitWithdrawal,
  onVerifyEmail
}) => {
  const [usdtAddress, setUsdtAddress] = useState('');
  const [network, setNetwork] = useState<UsdtNetwork>('TRC20');
  const [amountUsd, setAmountUsd] = useState('5.00');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const availableCents = balances?.availableCents ?? 0;
  const availableUsdt = usdCentsToUsdt(availableCents).toFixed(2);

  // Fee: $1.00 for TRC20, $2.50 for ERC20
  const feeCents = network === 'TRC20' ? 100 : 250;
  const amountCents = Math.round((parseFloat(amountUsd) || 0) * 100);

  const addressValidation = validateUsdtAddress(usdtAddress, network);
  const payoutCalc = calculateUsdtPayout(amountCents, network, feeCents);

  const handleSetMax = () => {
    const maxDollars = (availableCents / 100).toFixed(2);
    setAmountUsd(maxDollars);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!user.emailVerified) {
      setFormError('Email verification is required before requesting USDT withdrawals.');
      return;
    }

    if (!usdtAddress) {
      setFormError('Please enter a valid USDT destination address.');
      return;
    }

    if (!addressValidation.isValid) {
      setFormError(addressValidation.error || 'Invalid USDT address format.');
      return;
    }

    if (amountCents < 500) {
      setFormError('Minimum withdrawal amount is $5.00 USDT.');
      return;
    }

    if (amountCents > availableCents) {
      setFormError(`Insufficient balance. Available: $${availableUsdt} USDT.`);
      return;
    }

    if (!payoutCalc.isViable) {
      setFormError(payoutCalc.error || 'Requested amount is too low after network fee.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmitWithdrawal(usdtAddress.trim(), network, amountCents);
      if (!result.success) {
        setFormError(result.error || 'Failed to submit withdrawal request.');
      } else {
        setSuccessMessage('USDT withdrawal request submitted successfully! Your funds are reserved and queued for review.');
        setUsdtAddress('');
        setAmountUsd('5.00');
      }
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          Withdraw Tether (USDT)
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            USDT Only • TRC-20 & ERC-20
          </span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Request on-chain USDT payouts directly to your self-custody wallet or exchange account.
        </p>
      </div>

      {/* Verification Gate Notice if not verified */}
      {!user.emailVerified && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Your email is unverified. To protect your reward funds, withdrawals are locked until your email is verified.
            </span>
          </div>
          <button
            onClick={onVerifyEmail}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors shrink-0 shadow-sm"
          >
            Verify Email
          </button>
        </div>
      )}

      {/* Main Withdrawal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Withdrawal Form Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs text-slate-500 font-medium">Available Withdrawable Balance:</span>
              <div className="text-2xl font-extrabold text-slate-900">
                ${availableUsdt}{' '}
                <span className="text-xs text-emerald-700 font-bold font-mono">
                  ({availableUsdt} USDT)
                </span>
              </div>
            </div>

            <button
              onClick={onRefreshQuote}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-600 font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>1:1 Pegged</span>
            </button>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Network Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                Select USDT Transfer Network
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNetwork('TRC20')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    network === 'TRC20'
                      ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-600'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">TRON (TRC-20)</span>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Low Fee
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    Fee: $1.00 USDT • Starts with T
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setNetwork('ERC20')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    network === 'ERC20'
                      ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-600'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Ethereum (ERC-20)</span>
                    <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      EVM
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    Fee: $2.50 USDT • Starts with 0x
                  </span>
                </button>
              </div>
            </div>

            {/* USDT Destination Address */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  USDT Payout Address ({network})
                </label>
                {usdtAddress && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      addressValidation.isValid
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {addressValidation.isValid
                      ? `Valid ${addressValidation.network}`
                      : 'Invalid Format'}
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={usdtAddress}
                onChange={e => setUsdtAddress(e.target.value)}
                placeholder={
                  network === 'TRC20'
                    ? 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7...'
                    : '0xdAC17F958D2ee523a2206206994597C13D831ec7...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs sm:text-sm text-slate-900"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {network === 'TRC20'
                  ? 'TRC-20 addresses begin with T and are 34 characters long.'
                  : 'ERC-20 addresses begin with 0x and are 42 characters long.'}
              </p>
            </div>

            {/* Withdrawal Amount (USD / USDT) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Withdrawal Amount (USDT)
                </label>
                <button
                  type="button"
                  onClick={handleSetMax}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800"
                >
                  Use Max (${availableUsdt})
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">₮</span>
                <input
                  type="number"
                  step="0.01"
                  min="5.00"
                  max="500.00"
                  required
                  value={amountUsd}
                  onChange={e => setAmountUsd(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-900 font-mono"
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                <span>Minimum: $5.00 USDT</span>
                <span>Maximum: $500.00 USDT</span>
              </div>
            </div>

            {/* Payout Breakdown */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Gross Amount:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {payoutCalc.grossUsdt} USDT
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Network Transfer Fee ({network}):</span>
                <span className="font-mono font-semibold text-amber-600">
                  - {payoutCalc.feeUsdt} USDT
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span className="text-sm">Estimated Net Payout:</span>
                <div className="text-right">
                  <span className="text-sm text-emerald-700 font-mono block">
                    {payoutCalc.netUsdt} USDT
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 font-normal">
                    ≈ ${payoutCalc.netUsdt} USD
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || availableCents < 500}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
            >
              {submitting ? 'Submitting Request...' : 'Submit USDT Withdrawal Request'}
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Security & Withdrawal Policy Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>USDT Withdrawal Policies</span>
            </h3>

            <ul className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Stablecoin USDT:</strong> Withdrawals are processed exclusively in Tether USD (USDT).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Network Match Verification:</strong> Double-check that your wallet supports the chosen network (TRC-20 or ERC-20).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Atomic Balance Reservation:</strong> Requested amounts are held securely in reserved status to prevent double-spending.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>No Volatility Risk:</strong> 1 USDT = $1.00 USD. Your rewards never decrease due to crypto market drops.
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-xs text-emerald-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Info className="w-3.5 h-3.5 text-emerald-600" />
              <span>TRC-20 Recommended</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              TRC-20 (TRON) transactions confirm within minutes and carry a low $1.00 flat fee.
            </p>
          </div>
        </div>
      </div>

      {/* Withdrawal History Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Your USDT Withdrawal History</h3>

        {withdrawals.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <span>No withdrawal requests yet. Your requested USDT payouts will appear here.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Network</th>
                  <th className="py-3 px-3">Destination Address</th>
                  <th className="py-3 px-3">Gross Amount</th>
                  <th className="py-3 px-3">Net Payout</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Transaction / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {withdrawals.map(w => {
                  const statusColors: Record<string, string> = {
                    requested: 'bg-amber-50 text-amber-700 border-amber-200',
                    under_review: 'bg-sky-50 text-sky-700 border-sky-200',
                    approved: 'bg-blue-50 text-blue-700 border-blue-200',
                    processing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    rejected: 'bg-red-50 text-red-700 border-red-200',
                    failed: 'bg-red-50 text-red-700 border-red-200',
                    cancelled: 'bg-slate-100 text-slate-700 border-slate-200'
                  };

                  const explorerBase = w.network === 'TRC20'
                    ? 'https://tronscan.org/#/transaction/'
                    : 'https://etherscan.io/tx/';

                  return (
                    <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 text-slate-600">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px]">
                          {w.network}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-800">
                        {w.usdtAddress.slice(0, 10)}...{w.usdtAddress.slice(-6)}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        ${(w.amountCents / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-mono text-emerald-700 font-bold">
                        {w.netUsdt} USDT
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            statusColors[w.status] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {w.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {w.txHash ? (
                          <a
                            href={`${explorerBase}${w.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:underline flex items-center gap-1 font-mono text-[11px]"
                          >
                            <span>{w.txHash.slice(0, 8)}...</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {w.reviewNotes || 'Pending settlement review'}
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
