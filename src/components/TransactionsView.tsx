import React, { useState } from 'react';
import { LedgerEntry, UsdtQuote } from '../types';
import { usdCentsToUsdt } from '../utils/usdt';
import { Receipt, ArrowDownLeft, ArrowUpRight, ShieldCheck, RefreshCw } from 'lucide-react';

interface TransactionsViewProps {
  entries: LedgerEntry[];
  usdtQuote: UsdtQuote | null;
  pointsPerUsdt?: number;
  userSharePercent?: number;
  onRefresh: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  entries,
  pointsPerUsdt = 10000,
  userSharePercent = 40,
  onRefresh
}) => {
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'reversal'>('all');
  const safeShare = Math.max(1, userSharePercent);

  const filtered = entries.filter(e => {
    if (filterType === 'credit') return e.entryType === 'credit';
    if (filterType === 'reversal') return e.entryType === 'reversal';
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Reward Ledger & Transactions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable, audit-ready record of all survey completions, adjustments, and USDT credits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-white border border-slate-200 p-1 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterType === 'all' ? 'bg-sky-50 text-sky-700 font-bold' : 'text-slate-600'
              }`}
            >
              All Records
            </button>
            <button
              onClick={() => setFilterType('credit')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterType === 'credit' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600'
              }`}
            >
              Credits Only
            </button>
            <button
              onClick={() => setFilterType('reversal')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filterType === 'reversal' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-600'
              }`}
            >
              Reversals
            </button>
          </div>

          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ledger Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-2">
            <Receipt className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">No Ledger Transactions Found</p>
            <p className="text-slate-400 max-w-sm mx-auto">
              Once you complete surveys on Reward River, verified survey credits will be permanently recorded here in USDT.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Provider Tx ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Points</th>
                  <th className="py-3 px-4 text-right">USDT Equivalent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(entry => {
                  const isCredit = entry.entryType === 'credit';
                  const usdt = usdCentsToUsdt(entry.amountCents).toFixed(2);
                  const pts = entry.points ?? Math.round((entry.amountCents / safeShare) * pointsPerUsdt);

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(entry.createdAt).toLocaleDateString()}{' '}
                        <span className="text-[11px] text-slate-400">
                          {new Date(entry.createdAt).toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {entry.description || `Survey Offer #${entry.cpxOfferId || 'N/A'}`}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {entry.providerTxId || 'system_manual'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCredit
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {entry.entryType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            entry.status === 'confirmed'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold text-sm font-mono ${
                          isCredit ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {isCredit ? '+' : '-'}{pts.toLocaleString('en-US')} Pts
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-bold">
                        {isCredit ? '+' : '-'}${usdt} USDT
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ledger Integrity Note */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p>
          <strong>Accounting Invariant:</strong> Reward River enforces an append-only, double-entry style financial ledger. Financial transactions are never silently deleted. In the event of a sponsor chargeback or fraudulent participation reversal, an offsetting reversal entry is recorded with full audit trail references.
        </p>
      </div>
    </div>
  );
};
