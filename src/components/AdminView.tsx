import React, { useState, useEffect } from 'react';
import { User, Withdrawal, SystemSettings, AdminUserDetail } from '../types';
import {
  ShieldCheck,
  RefreshCw,
  Send,
  ExternalLink,
  Users,
  Search,
  MessageSquare,
  CheckCircle2,
  Eye,
  X,
  Globe,
  Calendar,
  DollarSign,
  Award,
  Filter
} from 'lucide-react';

interface AdminViewProps {
  user?: User;
  adminUser?: User;
  cpxStatus?: any;
  onRefreshAll?: () => void;
  onDataChanged?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ user, adminUser, onRefreshAll, onDataChanged }) => {
  const triggerRefresh = onRefreshAll || onDataChanged || (() => {});
  const [activeSubTab, setActiveSubTab] = useState<'withdrawals' | 'users' | 'cpx_tester' | 'settings' | 'audit_logs'>('withdrawals');
  const [overview, setOverview] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [usersList, setUsersList] = useState<AdminUserDetail[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // User search and user detail modal
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null);

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
      const token = localStorage.getItem('rr_auth_token');
      const [ovRes, wRes, sRes, lRes, uRes] = await Promise.all([
        fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/withdrawals', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
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
      if (uRes.ok) {
        const data = await uRes.json();
        setUsersList(data.users || []);
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
          amountCents: testAmountCents,
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
    setActionMessage(null);
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
      } else {
        setActionMessage({ text: 'Failed to save settings.', type: 'error' });
      }
    } catch {
      setActionMessage({ text: 'Failed to update platform settings.', type: 'error' });
    }
  };

  // Filtered users for User Directory
  const filteredUsers = usersList.filter(u => {
    const q = userSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.whatsappNumber?.toLowerCase().includes(q) ||
      u.phoneNumber?.toLowerCase().includes(q) ||
      u.externalOpaqueId?.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <span>Reward River Administration</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
              Super Admin
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit rewards ledger, manage registered users, process pending USDT withdrawals, test postbacks, and set risk controls.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors shrink-0"
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
          <button
            onClick={() => setActiveSubTab('users')}
            className={`bg-white rounded-2xl p-4 border text-left transition-all group cursor-pointer ${
              activeSubTab === 'users'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                : 'border-slate-200 hover:border-emerald-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Users</span>
              <Users className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{overview.totalUsers}</div>
            <div className="text-[10px] font-semibold text-emerald-600 mt-1 flex items-center gap-0.5">
              <span>View user directory</span>
              <span>→</span>
            </div>
          </button>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Credited</span>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              ${(overview.totalRewardsCreditedCents / 100).toFixed(2)}
            </div>
          </div>

          <button
            onClick={() => setActiveSubTab('withdrawals')}
            className={`bg-white rounded-2xl p-4 border text-left transition-all group cursor-pointer ${
              activeSubTab === 'withdrawals'
                ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                : 'border-slate-200 hover:border-amber-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Pending Withdrawals</span>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            </div>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">
              {overview.pendingWithdrawalCount}
            </div>
            <div className="text-[10px] font-semibold text-amber-600 mt-1">Review queue →</div>
          </button>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Settled USDT Paid</span>
            <div className="text-2xl font-extrabold text-emerald-700 font-mono mt-1">
              ${overview.paidWithdrawalTotalUsdt || '0.00'} USDT
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-2 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('withdrawals')}
          className={`px-4 py-2 rounded-xl font-bold transition-colors whitespace-nowrap ${
            activeSubTab === 'withdrawals'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Withdrawal Review Queue ({withdrawals.filter(w => ['requested', 'under_review'].includes(w.status)).length})
        </button>

        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeSubTab === 'users'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User Directory ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('cpx_tester')}
          className={`px-4 py-2 rounded-xl font-bold transition-colors whitespace-nowrap ${
            activeSubTab === 'cpx_tester'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Survey Postback & Webhook Tester
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2 rounded-xl font-bold transition-colors whitespace-nowrap ${
            activeSubTab === 'settings'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Platform Settings
        </button>

        <button
          onClick={() => setActiveSubTab('audit_logs')}
          className={`px-4 py-2 rounded-xl font-bold transition-colors whitespace-nowrap ${
            activeSubTab === 'audit_logs'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Audit Logs
        </button>
      </div>

      {/* Sub-Tab 1: Withdrawal Review Queue */}
      {activeSubTab === 'withdrawals' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Pending USDT Withdrawal Requests</h3>
            <span className="text-xs font-semibold text-slate-500">
              {withdrawals.length} Total Requests
            </span>
          </div>

          {withdrawals.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No withdrawal requests pending in the review queue.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="p-3">User Email</th>
                    <th className="p-3">Network</th>
                    <th className="p-3">USDT Address</th>
                    <th className="p-3">Requested USD</th>
                    <th className="p-3">Net USDT Payout</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {withdrawals.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-900">{req.userEmail}</td>
                      <td className="p-3 font-mono text-emerald-700 font-bold">{req.network}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-600 max-w-[150px] truncate" title={req.usdtAddress}>
                        {req.usdtAddress}
                      </td>
                      <td className="p-3 font-semibold">${(req.amountCents / 100).toFixed(2)}</td>
                      <td className="p-3 font-bold text-emerald-600 font-mono">{req.netUsdt} USDT</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                          req.status === 'under_review' ? 'bg-amber-100 text-amber-800' :
                          req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        {['requested', 'under_review'].includes(req.status) && (
                          <>
                            <button
                              onClick={() => setPayoutModal({ id: req.id, txHash: '', notes: '' })}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors text-[11px]"
                            >
                              Pay USDT
                            </button>
                            <button
                              onClick={() => handleReviewAction(req.id, 'reject', 'Rejected by risk check')}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-lg transition-colors text-[11px]"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {req.txHash && (
                          <a
                            href={req.network === 'TRC20' ? `https://tronscan.org/#/transaction/${req.txHash}` : `https://etherscan.io/tx/${req.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px]"
                          >
                            <span>TxID</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
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

      {/* Sub-Tab 2: User Directory & Accounts Analytics */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          {/* Top Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>Registered User Directory & Accounts</span>
              </h3>
              <p className="text-xs text-slate-500">
                View all registered accounts, WhatsApp contact details, Google profiles, survey participation counts, and USDT balances.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search name, email, WhatsApp, ID..."
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="p-3">User / Profile</th>
                  <th className="p-3">WhatsApp / Phone</th>
                  <th className="p-3">Auth Method</th>
                  <th className="p-3">Joined Date</th>
                  <th className="p-3">Earned / Available</th>
                  <th className="p-3">Surveys</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    const availableUsdt = (u.balances?.availableCents / 100 || 0).toFixed(2);
                    const totalEarnedUsdt = (u.balances?.totalEarnedCents / 100 || 0).toFixed(2);
                    const rawPhone = u.whatsappNumber || u.phoneNumber || '';
                    const cleanPhone = rawPhone.replace(/[^\d]/g, '');

                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        {/* User Profile Cell */}
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt={u.displayName}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 uppercase shadow-xs">
                                {u.displayName?.[0] || u.email[0]}
                              </div>
                            )}

                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{u.displayName || 'Member'}</span>
                                {u.emailVerified && (
                                  <span title="Email Verified"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /></span>
                                )}
                                {u.role === 'admin' && (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-900 text-white font-extrabold text-[9px]">
                                    ADMIN
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* WhatsApp Contact Cell */}
                        <td className="p-3">
                          {cleanPhone ? (
                            <a
                              href={`https://wa.me/${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs border border-emerald-200/80 transition-colors"
                              title="Click to open WhatsApp chat"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{rawPhone}</span>
                              <ExternalLink className="w-3 h-3 text-emerald-500" />
                            </a>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Not provided</span>
                          )}
                        </td>

                        {/* Auth Provider Cell */}
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {u.photoURL || u.provider === 'google.com' ? 'Google Auth' : 'Email/Password'}
                          </span>
                        </td>

                        {/* Joined Date Cell */}
                        <td className="p-3 text-slate-500 text-xs">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>

                        {/* Earned / Available Balance Cell */}
                        <td className="p-3 font-mono">
                          <div className="font-bold text-emerald-600 text-xs">
                            ${availableUsdt} USDT <span className="text-[10px] text-slate-400 font-sans font-normal">(Avail)</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans">
                            Total Earned: ${totalEarnedUsdt}
                          </div>
                        </td>

                        {/* Surveys Completed Cell */}
                        <td className="p-3 font-bold text-slate-800 text-center">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                            {u.completedSurveysCount || 0}
                          </span>
                        </td>

                        {/* Actions Cell */}
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedUserDetail(u)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Survey Postback Webhook Tester */}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reward Amount (Cents)
              </label>
              <input
                type="number"
                value={testAmountCents}
                onChange={e => setTestAmountCents(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Equivalent to: {(testAmountCents / 100).toFixed(2)} USDT
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
            <span>Dispatch Simulated Callback</span>
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

      {/* Sub-Tab 4: Platform Settings */}
      {activeSubTab === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 text-xs">
          <div>
            <h3 className="text-base font-bold text-slate-900">Platform & Payout Controls</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Set USDT withdrawal thresholds, network fees, and system mode.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <span className="text-[10px] text-slate-400 mt-1 block">
                Current min: ${(settings.minWithdrawalCents / 100).toFixed(2)} USD
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
              <span className="text-[10px] text-slate-400 mt-1 block">
                Current max: ${(settings.maxWithdrawalCents / 100).toFixed(2)} USD
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                TRON (TRC-20) Network Fee (Cents)
              </label>
              <input
                type="number"
                value={settings.feeCentsTrc20}
                onChange={e => setSettings({ ...settings, feeCentsTrc20: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Ethereum (ERC-20) Network Fee (Cents)
              </label>
              <input
                type="number"
                value={settings.feeCentsErc20}
                onChange={e => setSettings({ ...settings, feeCentsErc20: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-sm"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all"
            >
              Save Platform Controls
            </button>
          </div>
        </form>
      )}

      {/* Sub-Tab 5: Audit Logs */}
      {activeSubTab === 'audit_logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Administrative Audit Trail</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable log of all administrative actions, risk approvals, and system changes.
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic">
                No administrative actions recorded yet.
              </div>
            ) : (
              auditLogs.map((log: any) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
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
              ))
            )}
          </div>
        </div>
      )}

      {/* User Details Drawer Modal */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5 relative overflow-hidden">
            <button
              onClick={() => setSelectedUserDetail(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile Header */}
            <div className="flex items-center gap-4">
              {selectedUserDetail.photoURL ? (
                <img
                  src={selectedUserDetail.photoURL}
                  alt={selectedUserDetail.displayName}
                  className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-extrabold text-xl flex items-center justify-center shadow-md uppercase">
                  {selectedUserDetail.displayName?.[0] || selectedUserDetail.email[0]}
                </div>
              )}

              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{selectedUserDetail.displayName || 'Member'}</span>
                  {selectedUserDetail.emailVerified && (
                    <span title="Email Verified"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></span>
                  )}
                </h4>
                <p className="text-xs font-mono text-slate-500">{selectedUserDetail.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                    {selectedUserDetail.role.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Joined {new Date(selectedUserDetail.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* WhatsApp Contact Box */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase block">WhatsApp Contact</span>
                <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block">
                  {selectedUserDetail.whatsappNumber || selectedUserDetail.phoneNumber || 'Not provided'}
                </span>
              </div>
              {(selectedUserDetail.whatsappNumber || selectedUserDetail.phoneNumber) && (
                <a
                  href={`https://wa.me/${(selectedUserDetail.whatsappNumber || selectedUserDetail.phoneNumber || '').replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat on WhatsApp</span>
                </a>
              )}
            </div>

            {/* Stats Breakdown */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] font-semibold uppercase block">Available Balance</span>
                <span className="font-extrabold text-emerald-600 text-base font-mono">
                  ${(selectedUserDetail.balances?.availableCents / 100 || 0).toFixed(2)} USDT
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] font-semibold uppercase block">Total Earned</span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  ${(selectedUserDetail.balances?.totalEarnedCents / 100 || 0).toFixed(2)} USDT
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] font-semibold uppercase block">Total Withdrawn</span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  ${(selectedUserDetail.balances?.totalWithdrawnCents / 100 || 0).toFixed(2)} USDT
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[10px] font-semibold uppercase block">Surveys Completed</span>
                <span className="font-bold text-slate-900 text-sm">
                  {selectedUserDetail.completedSurveysCount || 0}
                </span>
              </div>
            </div>

            {/* Opaque ID */}
            <div className="p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Anonymous CPX Survey Opaque ID:</span>
              <span className="text-emerald-400 select-all block">{selectedUserDetail.externalOpaqueId}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
