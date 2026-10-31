import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  Play,
  Copy,
  Check,
  ShieldAlert,
  Search,
  DollarSign,
  Coins,
  TrendingUp,
  Sliders,
  Ban,
  Unlock
} from 'lucide-react';
import { OfferwallTransaction, AdminUserDetail, SystemSettings } from '../types';

interface AdminTimewallTabProps {
  token: string;
  users: AdminUserDetail[];
  settings: SystemSettings | null;
  onRefreshGlobal: () => void;
}

interface TimewallTotals {
  totalCount: number;
  creditedCount: number;
  reversedCount: number;
  needsReviewCount: number;
  blockedCount: number;
  grossRevenueUsd: string;
  reversedRevenueUsd: string;
  userPayoutUsd: string;
  platformMarginUsd: string;
  totalCoinsPaid: number;
  totalCoinsReversed: number;
}

interface TimewallConfigStatus {
  oidConfigured: boolean;
  apiKeyConfigured?: boolean;
  apiKeyMasked?: string;
  secretConfigured: boolean;
  secretMasked?: string;
  oid: string;
  placementUrlTemplate: string;
  allowedIps: string[];
  coinsPerUsd: number;
  allowDecimals: boolean;
  creditTypes: string[];
  reversalTypes: string[];
  negativeBalanceMode: 'allow' | 'flag_account';
  maxSingleRevenueUsd: string;
  trustedProxies: string[];
  postbackUrlTemplate: string;
}

export const AdminTimewallTab: React.FC<AdminTimewallTabProps> = ({
  token,
  users,
  settings,
  onRefreshGlobal
}) => {
  const [transactions, setTransactions] = useState<OfferwallTransaction[]>([]);
  const [totals, setTotals] = useState<TimewallTotals>({
    totalCount: 0,
    creditedCount: 0,
    reversedCount: 0,
    needsReviewCount: 0,
    blockedCount: 0,
    grossRevenueUsd: '0.0000',
    reversedRevenueUsd: '0.0000',
    userPayoutUsd: '0.0000',
    platformMarginUsd: '0.0000',
    totalCoinsPaid: 0,
    totalCoinsReversed: 0
  });
  const [configStatus, setConfigStatus] = useState<TimewallConfigStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [userFilter, setUserFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Raw payload viewer modal
  const [selectedTx, setSelectedTx] = useState<OfferwallTransaction | null>(null);

  // Config editor state
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [oidInput, setOidInput] = useState<string>(settings?.timewallOid || 'bbaca457a255e3e2');
  const [placementUrlInput, setPlacementUrlInput] = useState<string>(
    settings?.timewallPlacementUrl || 'https://timewall.io/users/login?oid={oid}&uid={userid}'
  );
  const [apiKeyInput, setApiKeyInput] = useState<string>(settings?.timewallApiKey || '');
  const [secretInput, setSecretInput] = useState<string>(settings?.timewallSecret || '');
  const [allowedIpsInput, setAllowedIpsInput] = useState<string>(
    settings?.timewallAllowedIps || '18.156.132.55,51.81.120.73,142.111.248.18'
  );
  const [coinsPerUsdInput, setCoinsPerUsdInput] = useState<number>(
    settings?.timewallCoinsPerUsd || 10000
  );
  const [creditTypesInput, setCreditTypesInput] = useState<string>(
    settings?.timewallCreditTypes || ''
  );
  const [reversalTypesInput, setReversalTypesInput] = useState<string>(
    settings?.timewallReversalTypes || 'chargeback,reversal,cancel,deduct,2'
  );
  const [negBalanceMode, setNegBalanceMode] = useState<'allow' | 'flag_account'>(
    settings?.timewallNegativeBalanceMode || 'allow'
  );
  const [maxSingleRevInput, setMaxSingleRevInput] = useState<string>(
    settings?.timewallMaxSingleRevenueUsd || '50.00'
  );
  const [trustedProxiesInput, setTrustedProxiesInput] = useState<string>(
    settings?.trustedProxies || 'cloudflare,vercel,127.0.0.1,::1'
  );
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Simulator state
  const [simUserId, setSimUserId] = useState<string>(users[0]?.id || 'usr_admin_rewardriver');
  const [simTxid, setSimTxid] = useState<string>(`tw_test_${Date.now()}`);
  const [simRevenue, setSimRevenue] = useState<string>('0.002');
  const [simCurrency, setSimCurrency] = useState<string>('20');
  const [simType, setSimType] = useState<string>('credit');
  const [simOfferName, setSimOfferName] = useState<string>('TimeWall Survey #402');
  const [simSourceIp, setSimSourceIp] = useState<string>('18.156.132.55');
  const [simBadHash, setSimBadHash] = useState<boolean>(false);
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simOutput, setSimOutput] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (userFilter.trim()) qs.set('user', userFilter.trim());
      if (statusFilter !== 'all') qs.set('status', statusFilter);
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);

      const res = await fetch(`/api/admin/timewall/transactions?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        if (data.totals) setTotals(data.totals);
        if (data.configStatus) {
          setConfigStatus(data.configStatus);
          if (!oidInput && data.configStatus.oid) setOidInput(data.configStatus.oid);
        }
      }
    } catch {
      setActionMsg({ type: 'error', text: 'Failed to load TimeWall transactions.' });
    } finally {
      setLoading(false);
    }
  }, [token, userFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleReviewTx = async (txId: string, action: 'approve' | 'reject') => {
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/timewall/transactions/${txId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          notes: `Admin manual ${action} via TimeWall Review Queue`
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg({ type: 'error', text: data.error || `Failed to ${action} transaction.` });
        return;
      }
      setActionMsg({
        type: 'success',
        text: `Transaction ${data.transaction?.providerTxid} ${
          action === 'approve' ? 'approved and credited to user' : 'rejected'
        }.`
      });
      fetchTransactions();
      onRefreshGlobal();
    } catch {
      setActionMsg({ type: 'error', text: 'Network error reviewing transaction.' });
    }
  };

  const handleToggleUserBlock = async (userId: string, currentlyBlocked: boolean) => {
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/offerwall-block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ blocked: !currentlyBlocked })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg({ type: 'error', text: data.error || 'Could not update user block flag.' });
        return;
      }
      setActionMsg({
        type: 'success',
        text: `User ${userId} offerwall_blocked set to ${Boolean(data.offerwallBlocked)}.`
      });
      onRefreshGlobal();
    } catch {
      setActionMsg({ type: 'error', text: 'Network error toggling user offerwall_blocked.' });
    }
  };

  const handleSaveTimewallConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...(settings || {}),
          timewallOid: oidInput.trim(),
          timewallPlacementUrl: placementUrlInput.trim(),
          ...(apiKeyInput.trim() ? { timewallApiKey: apiKeyInput.trim() } : {}),
          ...(secretInput.trim() ? { timewallSecret: secretInput.trim() } : {}),
          timewallAllowedIps: allowedIpsInput.trim(),
          timewallCoinsPerUsd: Number(coinsPerUsdInput) || 10000,
          timewallCreditTypes: creditTypesInput.trim(),
          timewallReversalTypes: reversalTypesInput.trim(),
          timewallNegativeBalanceMode: negBalanceMode,
          timewallMaxSingleRevenueUsd: maxSingleRevInput.trim(),
          trustedProxies: trustedProxiesInput.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg({ type: 'error', text: data.error || 'Failed to save TimeWall settings.' });
        return;
      }
      setActionMsg({ type: 'success', text: 'TimeWall.io configuration saved.' });
      fetchTransactions();
      onRefreshGlobal();
    } catch {
      setActionMsg({ type: 'error', text: 'Network error saving TimeWall settings.' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunSimulation = async () => {
    setSimRunning(true);
    setSimOutput(null);
    try {
      const res = await fetch('/api/admin/timewall/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userid: simUserId,
          txid: simTxid,
          revenue: simRevenue,
          currency: simCurrency,
          type: simType,
          offername: simOfferName,
          sourceIp: simSourceIp,
          useBadHash: simBadHash
        })
      });
      const data = await res.json();
      setSimOutput(JSON.stringify(data, null, 2));
      fetchTransactions();
      onRefreshGlobal();
    } catch {
      setSimOutput(JSON.stringify({ error: 'Network error running simulation' }, null, 2));
    } finally {
      setSimRunning(false);
    }
  };

  const copyPostbackUrl = () => {
    const url =
      configStatus?.postbackUrlTemplate ||
      'https://rewardriver.online/postback/timewall?userid={userID}&txid={transactionID}&revenue={revenue}&currency={currencyAmount}&hash={hash}&ip={ip}&type={type}&withdrawid={withdrawid}&reason={reason}&offername={offername}&offerdetail={offerdetail}';
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Postback URL Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              TimeWall.io Offerwall & S2S Postback Console
            </h2>
            <p className="text-xs text-slate-500">
              Audit TimeWall postbacks, review held transactions, manage user access, and configure SHA-256 & IP whitelist security
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              {showConfigPanel ? 'Hide Configuration & Simulator' : 'Configuration & QA Simulator'}
            </button>
            <button
              onClick={fetchTransactions}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Exact Postback URL to paste into TimeWall Dashboard */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              TimeWall S2S Postback URL (Paste in TimeWall Placement Settings)
            </div>
            <code className="block text-xs font-mono text-teal-800 break-all">
              {configStatus?.postbackUrlTemplate ||
                'https://rewardriver.online/postback/timewall?userid={userID}&txid={transactionID}&revenue={revenue}&currency={currencyAmount}&hash={hash}&ip={ip}&type={type}&withdrawid={withdrawid}&reason={reason}&offername={offername}&offerdetail={offerdetail}'}
            </code>
          </div>
          <button
            onClick={copyPostbackUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shrink-0 cursor-pointer"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedUrl ? 'Copied' : 'Copy URL'}
          </button>
        </div>
      </div>

      {actionMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            actionMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="underline ml-4 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Gross USD Revenue (TimeWall)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            ${totals.grossRevenueUsd}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totals.creditedCount} credited offers • Reversed: ${totals.reversedRevenueUsd}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Coins Paid to Users</span>
            <Coins className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black font-mono text-teal-700">
            {totals.totalCoinsPaid.toLocaleString('en-US')} Pts
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            User Redemption Value: ${totals.userPayoutUsd} USD
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Net Platform Margin</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700">
            +${totals.platformMarginUsd}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Rate: {(configStatus?.coinsPerUsd || 10000).toLocaleString('en-US')} Coins / $1 USD
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Needs Review Queue</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-700">
            {totals.needsReviewCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Blocked postbacks: {totals.blockedCount}
          </div>
        </div>
      </div>

      {/* Expandable Configuration & Local Postback Simulator Panel */}
      {showConfigPanel && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Form */}
          <form
            onSubmit={handleSaveTimewallConfig}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              TimeWall.io Placement & Security Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  TimeWall Placement OID (TIMEWALL_OID)
                </label>
                <input
                  type="text"
                  value={oidInput}
                  onChange={e => setOidInput(e.target.value)}
                  placeholder="bbaca457a255e3e2"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Survey API Key (TIMEWALL_API_KEY)
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder={
                    configStatus?.apiKeyConfigured
                      ? `Active (${configStatus.apiKeyMasked || 'tw_...e8f04c'})`
                      : 'Paste TimeWall API Key'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Postback Secret Key (TIMEWALL_SECRET)
                </label>
                <input
                  type="password"
                  value={secretInput}
                  onChange={e => setSecretInput(e.target.value)}
                  placeholder={
                    configStatus?.secretConfigured
                      ? `Active (${configStatus.secretMasked || '3e8f...63c3'})`
                      : 'Paste TimeWall Secret'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                iFrame Placement URL Template
              </label>
              <input
                type="text"
                value={placementUrlInput}
                onChange={e => setPlacementUrlInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Coins per $1.00 USD (TIMEWALL_COINS_PER_USD)
                </label>
                <input
                  type="number"
                  value={coinsPerUsdInput}
                  onChange={e => setCoinsPerUsdInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Single Revenue USD Before Hold
                </label>
                <input
                  type="text"
                  value={maxSingleRevInput}
                  onChange={e => setMaxSingleRevInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Whitelisted Server IPs (TIMEWALL_ALLOWED_IPS)
              </label>
              <input
                type="text"
                value={allowedIpsInput}
                onChange={e => setAllowedIpsInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Credit Types (empty = accept non-reversal)
                </label>
                <input
                  type="text"
                  value={creditTypesInput}
                  onChange={e => setCreditTypesInput(e.target.value)}
                  placeholder="credit,1"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reversal Types
                </label>
                <input
                  type="text"
                  value={reversalTypesInput}
                  onChange={e => setReversalTypesInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reversal Negative Balance Policy
                </label>
                <select
                  value={negBalanceMode}
                  onChange={e => setNegBalanceMode(e.target.value as 'allow' | 'flag_account')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                >
                  <option value="allow">Allow Negative Balance</option>
                  <option value="flag_account">Flag & Block Account</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingConfig ? 'Saving...' : 'Save TimeWall Configuration'}
            </button>
          </form>

          {/* Local Postback Simulator */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Local TimeWall Postback Simulator (QA & Hash Tester)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target User
                </label>
                <select
                  value={simUserId}
                  onChange={e => setSimUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.email} ({u.id})
                    </option>
                  ))}
                  <option value="usr_unknown_999">Unknown User (usr_unknown_999)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transaction ID (txid)
                </label>
                <input
                  type="text"
                  value={simTxid}
                  onChange={e => setSimTxid(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Raw Revenue String (USD)
                </label>
                <input
                  type="text"
                  value={simRevenue}
                  onChange={e => {
                    const rev = e.target.value;
                    setSimRevenue(rev);
                    const num = Number(rev);
                    if (!isNaN(num)) {
                      setSimCurrency(String(Math.round(num * (configStatus?.coinsPerUsd || 10000))));
                    }
                  }}
                  placeholder="0.002 or 0.50"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Currency (Coins)
                </label>
                <input
                  type="text"
                  value={simCurrency}
                  onChange={e => setSimCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type (credit / reversal)
                </label>
                <input
                  type="text"
                  value={simType}
                  onChange={e => setSimType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Simulated Source IP
                </label>
                <input
                  type="text"
                  value={simSourceIp}
                  onChange={e => setSimSourceIp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simBadHash}
                    onChange={e => setSimBadHash(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Send Invalid SHA-256 Hash (Test 403 Reject)
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={simRunning}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {simRunning ? 'Running...' : 'Fire Simulated Postback'}
              </button>
              <button
                type="button"
                onClick={() => setSimTxid(`tw_test_${Date.now()}`)}
                className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
              >
                New Unique txid
              </button>
            </div>

            {simOutput && (
              <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 text-[11px] font-mono overflow-x-auto max-h-48">
                {simOutput}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* User Offerwall Access Block Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          User Offerwall Access Control (users.offerwall_blocked)
        </div>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
          {users.map(u => {
            const isBlocked = Boolean(u.offerwallBlocked);
            return (
              <div
                key={u.id}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
                  isBlocked
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <span className="font-medium">{u.email}</span>
                <button
                  onClick={() => handleToggleUserBlock(u.id, isBlocked)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer ${
                    isBlocked
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                  }`}
                >
                  {isBlocked ? (
                    <>
                      <Unlock className="w-3 h-3" /> Unblock
                    </>
                  ) : (
                    <>
                      <Ban className="w-3 h-3" /> Block
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters & Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              placeholder="Filter by user ID, email, txid, or offer name..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="needs_review">Needs Review ({totals.needsReviewCount})</option>
            <option value="credited">Credited ({totals.creditedCount})</option>
            <option value="reversed">Reversed ({totals.reversedCount})</option>
            <option value="blocked">Blocked ({totals.blockedCount})</option>
            <option value="rejected">Rejected</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
            title="From Date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
            title="To Date"
          />
        </div>

        {transactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No TimeWall transactions match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Offer & txid</th>
                  <th className="py-3 px-4 text-right">Revenue (Raw / USD)</th>
                  <th className="py-3 px-4 text-right">Coins</th>
                  <th className="py-3 px-4">Type / Flags</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {tx.createdAtKarachi || new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {tx.userEmail || tx.userId || 'Unknown'}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {tx.userId} • IP: {tx.userIp || 'n/a'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{tx.offerName}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        txid: {tx.providerTxid}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      <div className="font-bold text-slate-900">${tx.revenueRaw}</div>
                      <div className="text-[10px] text-slate-400">dec: {tx.revenueUsd}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {tx.status === 'reversed' ? (
                        <span className="text-red-600">-{tx.coinsInt.toLocaleString('en-US')}</span>
                      ) : (
                        <span className="text-teal-700">+{tx.coinsInt.toLocaleString('en-US')}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-[11px] text-slate-700">
                        type: {tx.type || 'default'}
                      </div>
                      {tx.fraudFlags && tx.fraudFlags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tx.fraudFlags.map((flag, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-mono"
                            >
                              <ShieldAlert className="w-2.5 h-2.5" />
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                      {tx.reason && (
                        <div className="text-[11px] text-amber-700 mt-0.5 max-w-xs truncate" title={tx.reason}>
                          {tx.reason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          tx.status === 'credited'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : tx.status === 'needs_review'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : tx.status === 'reversed'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      {tx.status === 'needs_review' && (
                        <>
                          <button
                            onClick={() => handleReviewTx(tx.id, 'approve')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 cursor-pointer"
                            title="Approve and credit coins to user"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewTx(tx.id, 'reject')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 cursor-pointer"
                            title="Reject transaction"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold hover:bg-slate-200 cursor-pointer"
                        title="View Raw Query Payload"
                      >
                        <Eye className="w-3 h-3" />
                        Raw
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Raw Payload Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  TimeWall Transaction Raw Payload
                </h3>
                <p className="text-xs font-mono text-slate-500">
                  txid: {selectedTx.providerTxid} • status: {selectedTx.status}
                </p>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50">
                <span className="text-slate-500 block">Source IP (TimeWall):</span>
                <span className="font-mono font-semibold">{selectedTx.sourceIp}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50">
                <span className="text-slate-500 block">End-User IP:</span>
                <span className="font-mono font-semibold">{selectedTx.userIp || 'n/a'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50">
                <span className="text-slate-500 block">Revenue Raw / Decimal(12,6):</span>
                <span className="font-mono font-semibold">
                  "{selectedTx.revenueRaw}" / {selectedTx.revenueUsd}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50">
                <span className="text-slate-500 block">Withdraw ID / Reason:</span>
                <span className="font-mono font-semibold">
                  {selectedTx.withdrawid || 'none'} / {selectedTx.reason || 'none'}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">
                raw_query (JSON, hash masked):
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-900 text-emerald-300 text-xs font-mono overflow-x-auto max-h-64">
                {JSON.stringify(selectedTx.rawQuery, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
