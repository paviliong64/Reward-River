import React, { useState, useEffect } from 'react';
import { User, Withdrawal, SystemSettings } from '../types';
import {
  ShieldCheck,
  RefreshCw,
  Send,
  ExternalLink
} from 'lucide-react';

interface AdminViewProps {
  user?: User;
  adminUser?: User;
  cpxStatus?: any;
  onRefreshAll?: () => void;
  onDataChanged?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ user, adminUser, onRefreshAll, onDataChanged }) => {
  const activeUser = user || adminUser;
  const triggerRefresh = onRefreshAll || onDataChanged || (() => {});
  const [activeSubTab, setActiveSubTab] = useState<'withdrawals' | 'cpx_tester' | 'settings' | 'audit_logs'>('withdrawals');
  const [overview, setOverview] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal for marking as paid with TxHash
  const [payoutModal, setPayoutModal] = useState<{ id: string; txHash: string; notes: string } | null>(null);

  // CPX Postback simulator state
  const [testAmountCents, setTestAmountCents] = useState(150);
  const [testOfferId, setTestOfferId] = useState('offer_101');
  const [testStatus, setTestStatus] = useState<number>(1);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [ovRes, wRes, sRes, lRes] = await Promise.all([
        fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}` } }),
        fetch('/api/admin/withdrawals', { headers: { Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}` } }),
        fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}` } }),
        fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}` } })
      ]);

      if (ovRes.ok) setOverview(await ovRes.json());
      if (wRes.ok) {
        const data = await wRes.json();
        setWithdrawals(data.withdrawals || []);
      }
      if (sRes.ok) setSettings(await sRes.json());
      if (lRes.ok) {
        const data = await lRes.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleReviewAction = async (id: string, action: string, notes?: string, txHash?: string) => {
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}`
        },
        body: JSON.stringify({ action, notes, txHash })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage({ text: data.error || 'Review action failed.', type: 'error' });
      } else {
        setActionMessage({ text: `Withdrawal updated to ${action}.`, type: 'success' });
        setPayoutModal(null);
        fetchAdminData();
        triggerRefresh();
      }
    } catch {
      setActionMessage({ text: 'Network communication failed.', type: 'error' });
    }
  };

  const handleSimulateCpxPostback = async () => {
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/test-cpx-postback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}`
        },
        body: JSON.stringify({
          targetUserId: activeUser?.id || '',
          rewardCents: testAmountCents,
          offerId: testOfferId,
          status: testStatus
        })
      });
      const data = await res.json();
      setTestResult(data);
      fetchAdminData();
      triggerRefresh();
    } catch {
      setTestResult({ error: 'Failed to simulate postback' });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rr_auth_token')}`
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setActionMessage({ text: 'System settings updated successfully.', type: 'success' });
        fetchAdminData();
      }
    } catch {
      setActionMessage({ text: 'Failed to save settings.', type: 'error' });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <span>Reward River Administration</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
              Super Admin
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit rewards ledger, process pending USDT withdrawals, test postback webhooks, and manage risk controls.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="font-bold underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Users</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{overview.totalUsers}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Credited</span>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              ${(overview.totalRewardsCreditedCents / 100).toFixed(2)}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Pending Withdrawals</span>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">
              {overview.pendingWithdrawalCount}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Settled USDT Paid</span>
            <div className="text-2xl font-extrabold text-emerald-700 font-mono mt-1">
              ${overview.paidWithdrawalTotalUsdt || '0.00'} USDT
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-2 text-xs">
        <button
          onClick={() => setActiveSubTab('withdrawals')}
          className={`px-4 py-2 rounded-xl font-bold transition-colors ${
            activeSubTab === 'withdrawals'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Withdrawal Review Queue ({withdrawals.filter(w => ['requested', 'under_review'].includes(w.status)).length})
        </button>
        <button
          onClick={() => setActiveSubTab('cpx_tester')}
          className={`px-4 py-2 rounded-xl font-bold transition-colors ${
            activeSubTab === 'cpx_tester'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Survey Postback & Webhook Tester
        </button>
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-xl font-bold transition-colors ${
            activeSubTab === 'settings'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Platform Settings
        </button>
        <button
          onClick={() => setActiveSubTab('audit_logs')}
          className={`px-4 py-2 rounded-xl font-bold transition-colors ${
            activeSubTab === 'audit_logs'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Audit Logs
        </button>
      </div>

      {/* Sub-Tab 1: Withdrawal Review Queue */}
      {activeSubTab === 'withdrawals' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Pending USDT Withdrawal Review
          </h3>
          <p className="text-xs text-slate-500">
            The administrator must verify compliance and record an on-chain transaction hash before marking any request as Paid.
          </p>

          {withdrawals.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No withdrawal requests recorded in the system.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">User Email</th>
                    <th className="py-3 px-3">Network</th>
                    <th className="py-3 px-3">USDT Address</th>
                    <th className="py-3 px-3">Net Payout</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Review Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {withdrawals.map(w => (
                    <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 text-slate-600">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{w.userEmail}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border text-[10px] font-bold">
                          {w.network}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                        {w.usdtAddress.slice(0, 10)}...{w.usdtAddress.slice(-6)}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                        {w.netUsdt} USDT
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {w.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {['requested', 'under_review'].includes(w.status) && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleReviewAction(w.id, 'approve', 'Approved by administrator.')}
                              className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-[11px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setPayoutModal({ id: w.id, txHash: '', notes: '' })}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px]"
                            >
                              Mark Paid
                            </button>
                            <button
                              onClick={() => handleReviewAction(w.id, 'reject', 'Rejected: insufficient survey verification.')}
                              className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-bold text-[11px]"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {w.status === 'approved' && (
                          <button
                            onClick={() => setPayoutModal({ id: w.id, txHash: '', notes: '' })}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-500"
                          >
                            Enter TxID & Mark Paid
                          </button>
                        )}
                        {w.status === 'paid' && (
                          <span className="text-[11px] text-emerald-700 font-bold font-mono">
                            Tx: {w.txHash?.slice(0, 8)}...
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: CPX Postback Tester */}
      {activeSubTab === 'cpx_tester' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Survey Postback Webhook Simulation & Testing Tool
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulate server-to-server postbacks received when a survey is finished. Test signature generation, idempotency checks, and ledger crediting in USDT.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reward Amount (USD Cents)
              </label>
              <input
                type="number"
                value={testAmountCents}
                onChange={e => setTestAmountCents(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm"
              />
              <span className="text-[11px] text-emerald-700 font-bold mt-1 block">
                {(testAmountCents / 100).toFixed(2)} USDT
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Survey Offer ID
              </label>
              <input
                type="text"
                value={testOfferId}
                onChange={e => setTestOfferId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Callback Event Type
              </label>
              <select
                value={testStatus}
                onChange={e => setTestStatus(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
              >
                <option value={1}>Status 1: Completed Survey (Credit)</option>
                <option value={2}>Status 2: Cancelled / Reversed (Chargeback)</option>
                <option value={3}>Status 3: Alternative Chargeback / Reversal</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSimulateCpxPostback}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all inline-flex items-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            Dispatch Simulated Survey Callback
          </button>

          {testResult && (
            <div className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto space-y-1">
              <span className="text-emerald-400 font-bold block mb-1">
                // Server Ledger Response:
              </span>
              <pre>{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: System Settings */}
      {activeSubTab === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900">
            USDT Platform Limits & Network Fees
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Minimum Withdrawal (Cents)
              </label>
              <input
                type="number"
                value={settings.minWithdrawalCents}
                onChange={e => setSettings({ ...settings, minWithdrawalCents: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                ${(settings.minWithdrawalCents / 100).toFixed(2)} USDT
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Maximum Withdrawal (Cents)
              </label>
              <input
                type="number"
                value={settings.maxWithdrawalCents}
                onChange={e => setSettings({ ...settings, maxWithdrawalCents: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                ${(settings.maxWithdrawalCents / 100).toFixed(2)} USDT
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                TRC-20 Network Fee (Cents)
              </label>
              <input
                type="number"
                value={settings.feeCentsTrc20}
                onChange={e => setSettings({ ...settings, feeCentsTrc20: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm"
              />
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                ${(settings.feeCentsTrc20 / 100).toFixed(2)} USDT
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                ERC-20 Network Fee (Cents)
              </label>
              <input
                type="number"
                value={settings.feeCentsErc20}
                onChange={e => setSettings({ ...settings, feeCentsErc20: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm"
              />
              <span className="text-[11px] text-slate-600 font-semibold mt-1 block">
                ${(settings.feeCentsErc20 / 100).toFixed(2)} USDT
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-colors"
          >
            Save USDT Settings
          </button>
        </form>
      )}

      {/* Sub-Tab 4: Audit Logs */}
      {activeSubTab === 'audit_logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            Administrative Audit Trail
          </h3>
          <p className="text-xs text-slate-500">
            Immutable log of all administrative actions, risk approvals, and system changes.
          </p>

          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.map(log => (
              <div key={log.id} className="py-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{log.action}</span>
                    <span className="text-[11px] text-slate-500">by {log.adminEmail}</span>
                  </div>
                  <p className="text-slate-600 mt-0.5">{log.details}</p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Mark Paid with TxHash */}
      {payoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-slate-900">
              Record On-Chain USDT Settlement
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              To mark this withdrawal as Paid, provide the broadcasted transaction hash (TxID). The user will be able to verify this on TRONSCAN or Etherscan.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                On-Chain Transaction Hash (TxID)
              </label>
              <input
                type="text"
                required
                value={payoutModal.txHash}
                onChange={e => setPayoutModal({ ...payoutModal, txHash: e.target.value })}
                placeholder="0x... or TRON 64-char transaction hash"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Settlement Notes (Optional)
              </label>
              <input
                type="text"
                value={payoutModal.notes}
                onChange={e => setPayoutModal({ ...payoutModal, notes: e.target.value })}
                placeholder="Confirmed on TRC-20 batch #4120"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayoutModal(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReviewAction(payoutModal.id, 'mark_paid', payoutModal.notes, payoutModal.txHash)}
                disabled={!payoutModal.txHash}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Confirm Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
