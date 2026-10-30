import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Copy,
  Check,
  Search,
  RefreshCw,
  AlertCircle,
  Eye,
  X,
  Plus,
  Share2,
  Award,
  Calendar,
  Activity,
  ShieldCheck,
  Layers,
  TrendingUp
} from 'lucide-react';
import { formatKarachiDateTime } from '../utils/adminStats';

interface ManagerPortalProps {
  token: string;
}

interface ManagerTeamSummary {
  id: string;
  teamName: string;
  teamCode: string;
  isActive: boolean;
  createdAt: string;
  memberCount: number;
  teamPoints: number;
}

interface ManagerMemberRow {
  userId: string;
  displayName: string;
  email: string;
  teamId: string;
  teamName: string;
  teamCode: string;
  joinedAt: string;
  joinedAtKarachi: string;
  lastActiveAt: string;
  lastActiveKarachi: string;
  surveysCompleted: number;
  totalPoints: number;
  periodPoints: number;
}

interface ManagerDashboardResponse {
  manager: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
  summary: {
    totalTeams: number;
    activeTeams: number;
    totalMembers: number;
    activeMembersToday: number;
    combinedTeamPoints: number;
    managerPersonalSurveyPoints: number;
    managerTeamBonusPoints: number;
  };
  teams: ManagerTeamSummary[];
  members: ManagerMemberRow[];
  permissions: {
    teamSystemEnabled: boolean;
    managersCanCreateTeams: boolean;
    maxTeamsPerManager: number;
  };
}

interface MemberDetailResponse {
  member: {
    id: string;
    displayName: string;
    email: string;
    createdAt: string;
    createdAtKarachi: string;
    lastActiveAt: string;
    lastActiveKarachi: string;
    teamId: string;
    teamName: string;
    teamCode: string;
    joinedTeamAt: string;
    joinedTeamAtKarachi: string;
    consentAcceptedAt: string;
  };
  summary: {
    totalPoints: number;
    completedSurveys: number;
    reversedSurveys: number;
  };
  completions: {
    id: string;
    transId: string;
    offerId: string;
    title: string;
    status: string;
    pointsAwarded: number;
    amountUsd: number;
    createdAt: string;
    createdAtKarachi: string;
  }[];
  ledger: {
    id: string;
    pointsDelta: number;
    reason: string;
    note: string;
    createdAt: string;
    createdAtKarachi: string;
  }[];
  activityChart: {
    dateKey: string;
    points: number;
    completions: number;
  }[];
}

export const ManagerPortal: React.FC<ManagerPortalProps> = ({ token }) => {
  const [data, setData] = useState<ManagerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'custom' | 'all'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'points' | 'surveys' | 'joinedAt'>('points');

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState<string>('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [createTeamNotice, setCreateTeamNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberDetail, setMemberDetail] = useState<MemberDetailResponse | null>(null);
  const [memberDetailLoading, setMemberDetailLoading] = useState(false);
  const [memberDetailError, setMemberDetailError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        teamId: selectedTeamId,
        dateRange,
        search: searchQuery,
        sortBy
      });
      if (dateRange === 'custom') {
        if (customStartDate) params.set('startDate', customStartDate);
        if (customEndDate) params.set('endDate', customEndDate);
      }
      const res = await fetch(`/api/manager/dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || `Failed to load manager dashboard (${res.status})`);
      } else {
        setData(json);
      }
    } catch {
      setError('Network error while loading manager dashboard.');
    } finally {
      setLoading(false);
    }
  }, [token, selectedTeamId, dateRange, customStartDate, customEndDate, searchQuery, sortBy]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleCopyInviteLink = (teamCode: string) => {
    const url = `${window.location.origin}/signup?team=${encodeURIComponent(teamCode)}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedCode(teamCode);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    setCreateTeamNotice(null);
    try {
      const res = await fetch('/api/manager/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ teamName: newTeamName.trim() })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setCreateTeamNotice({ type: 'error', text: json?.error || 'Could not create team.' });
      } else {
        setCreateTeamNotice({ type: 'success', text: `Created team "${json.team?.teamName}" (${json.team?.teamCode})` });
        setNewTeamName('');
        fetchDashboard();
      }
    } catch {
      setCreateTeamNotice({ type: 'error', text: 'Network error while creating team.' });
    } finally {
      setCreatingTeam(false);
    }
  };

  const openMemberDetail = async (userId: string) => {
    setSelectedMemberId(userId);
    setMemberDetail(null);
    setMemberDetailError(null);
    setMemberDetailLoading(true);
    try {
      const res = await fetch(`/api/manager/members/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMemberDetailError(json?.error || 'Failed to load member details.');
      } else {
        setMemberDetail(json);
      }
    } catch {
      setMemberDetailError('Network error while loading member details.');
    } finally {
      setMemberDetailLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto py-16 px-4 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">Loading real-time Manager Portal (Asia/Karachi)...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-sm font-black">Unable to load Manager Portal</h3>
            <p className="text-xs">{error}</p>
            <button
              type="button"
              onClick={fetchDashboard}
              className="px-3.5 py-1.5 rounded-xl bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const teams = data?.teams || [];
  const members = data?.members || [];
  const primaryTeam = teams[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4 px-2 sm:px-4 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-black uppercase tracking-wider">
              Team Manager Portal (Read-Only)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-bold">
              TZ: Asia/Karachi (PKT)
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {data?.manager?.displayName || 'Manager'} — Teams & Member Activity
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track real survey completions and verified points across your assigned teams. Team points strictly reflect member survey earnings and exclude manager personal surveys or bonuses.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDashboard}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-extrabold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Live Data</span>
        </button>
      </div>

      {/* Combined Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Managed Teams</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {summary?.totalTeams ?? 0}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            {summary?.activeTeams ?? 0} active teams
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Total Team Members</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            {summary?.totalMembers ?? 0}
          </div>
          <div className="text-[11px] text-sky-600 font-semibold mt-1">
            {summary?.activeMembersToday ?? 0} active today (PKT)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Combined Member Points</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {(summary?.combinedTeamPoints ?? 0).toLocaleString('en-US')} Pts
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Member ledger sum ({dateRange === 'all' ? 'All Time' : dateRange.toUpperCase()})
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
            <span>Manager Own / Bonus Pts</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-2 font-mono">
            Own: {(summary?.managerPersonalSurveyPoints ?? 0).toLocaleString('en-US')} Pts
          </div>
          <div className="text-[11px] text-indigo-600 font-semibold mt-1 font-mono">
            Team Bonus: {(summary?.managerTeamBonusPoints ?? 0).toLocaleString('en-US')} Pts (Separated)
          </div>
        </div>
      </div>

      {/* Manager's Teams List & Invite Links */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Your Teams & Invite Links</h2>
            <p className="text-xs text-slate-500">
              Share your team invite link so new members automatically join your team upon signup.
            </p>
          </div>

          {data?.permissions?.managersCanCreateTeams && (
            <form onSubmit={handleCreateTeam} className="flex items-center gap-2">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="New team name..."
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              />
              <button
                type="submit"
                disabled={creatingTeam || !newTeamName.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Team</span>
              </button>
            </form>
          )}
        </div>

        {createTeamNotice && (
          <div
            className={`p-3 rounded-xl text-xs font-bold ${
              createTeamNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {createTeamNotice.text}
          </div>
        )}

        {teams.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-1">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No teams assigned yet</p>
            <p className="text-xs text-slate-500">
              Ask the platform administrator to create or assign a team to your manager account.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((team) => {
              const inviteUrl = `${window.location.origin}/signup?team=${encodeURIComponent(team.teamCode)}`;
              const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
                `Join my Reward River team "${team.teamName}" (Code: ${team.teamCode}) to earn survey rewards: ${inviteUrl}`
              )}`;
              return (
                <div
                  key={team.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-white">{team.teamName}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[11px] font-bold">
                          {team.teamCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            team.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {team.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3 font-semibold">
                        <span>{team.memberCount} Members</span>
                        <span>•</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                          {team.teamPoints.toLocaleString('en-US')} Pts
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700">
                    <div className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">
                      {inviteUrl}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyInviteLink(team.teamCode)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                    >
                      {copiedCode === team.teamCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5b] text-white text-xs font-extrabold"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share on WhatsApp</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter Bar & Members Table */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              aria-label="Filter by team"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              <option value="all">All Teams ({teams.length})</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.teamName} ({t.teamCode})
                </option>
              ))}
            </select>

            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              {(['all', 'today', '7d', '30d', 'custom'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRange(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    dateRange === r
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {r === 'all' ? 'All Time' : r === 'today' ? 'Today' : r.toUpperCase()}
                </button>
              ))}
            </div>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member name or email..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'points' | 'surveys' | 'joinedAt')}
              aria-label="Sort members by"
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              <option value="points">Sort: Highest Points</option>
              <option value="surveys">Sort: Most Surveys</option>
              <option value="joinedAt">Sort: Newest Joined</option>
            </select>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-3">
            <Users className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="text-sm font-black text-slate-800 dark:text-slate-100">
              No members yet. Share your link to grow your team.
            </p>
            {primaryTeam && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyInviteLink(primaryTeam.teamCode)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Invite Link ({primaryTeam.teamCode})</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold text-slate-400 uppercase">
                  <th className="py-3 px-3">Member</th>
                  <th className="py-3 px-3">Team</th>
                  <th className="py-3 px-3">Joined (PKT)</th>
                  <th className="py-3 px-3">Last Active (PKT)</th>
                  <th className="py-3 px-3 text-right">Surveys</th>
                  <th className="py-3 px-3 text-right">Points ({dateRange.toUpperCase()})</th>
                  <th className="py-3 px-3 text-right">Total Points</th>
                  <th className="py-3 px-3 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {members.map((m) => (
                  <tr
                    key={m.userId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">{m.displayName}</div>
                      <div className="text-[11px] text-slate-500">{m.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{m.teamName}</span>
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold">
                        {m.teamCode}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {m.joinedAtKarachi}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {m.lastActiveKarachi}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      {m.surveysCompleted}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {m.periodPoints.toLocaleString('en-US')} Pts
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                      {m.totalPoints.toLocaleString('en-US')} Pts
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => openMemberDetail(m.userId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Read-Only Member Detail Modal */}
      {selectedMemberId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                  Team Member Read-Only Detail
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  {memberDetail?.member?.displayName || 'Loading Member...'}
                </h3>
                {memberDetail?.member && (
                  <p className="text-xs text-slate-500">
                    {memberDetail.member.email} • Team: <strong>{memberDetail.member.teamName}</strong> ({memberDetail.member.teamCode})
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {memberDetailLoading && (
              <div className="py-12 text-center text-xs font-bold text-slate-500">
                Loading member completions and ledger...
              </div>
            )}

            {memberDetailError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {memberDetailError}
              </div>
            )}

            {memberDetail?.member && memberDetail?.summary && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Total Ledger Points</span>
                    <div className="text-xl font-black text-emerald-600 font-mono mt-1">
                      {(memberDetail.summary.totalPoints || 0).toLocaleString('en-US')} Pts
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Completed Surveys</span>
                    <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
                      {memberDetail.summary.completedSurveys ?? 0}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Joined Team (PKT)</span>
                    <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-1.5">
                      {memberDetail.member.joinedTeamAtKarachi || memberDetail.member.joinedTeamAt}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Consent Recorded</span>
                    </div>
                  </div>
                </div>

                {/* 14-Day Activity Chart */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Last 14 Days Activity (Asia/Karachi)</span>
                  </h4>
                  <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 pt-2">
                    {(memberDetail.activityChart || []).map((day) => (
                      <div
                        key={day.dateKey}
                        className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center"
                        title={`${day.dateKey}: ${day.points} Pts (${day.completions} surveys)`}
                      >
                        <div className="text-[10px] font-mono text-slate-400">{day.dateKey.slice(5)}</div>
                        <div className="text-xs font-mono font-black text-emerald-600 mt-1">
                          {day.points > 0 ? `+${day.points}` : '0'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Completed Surveys */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-sky-600" />
                    <span>Survey Completions ({memberDetail.completions.length})</span>
                  </h4>
                  {memberDetail.completions.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">No survey completions yet.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-52 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase">
                          <tr>
                            <th className="py-2 px-3">Date (PKT)</th>
                            <th className="py-2 px-3">Trans ID</th>
                            <th className="py-2 px-3">Offer ID</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {memberDetail.completions.map((c) => (
                            <tr key={c.id}>
                              <td className="py-2 px-3 font-mono text-[11px]">{c.createdAtKarachi}</td>
                              <td className="py-2 px-3 font-mono text-[11px]">{c.transId}</td>
                              <td className="py-2 px-3 font-mono text-[11px]">{c.offerId}</td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    c.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {c.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold">
                                {c.pointsAwarded.toLocaleString('en-US')} Pts
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Points Ledger */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase">
                    Points Ledger ({memberDetail.ledger.length})
                  </h4>
                  {memberDetail.ledger.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">No ledger entries yet.</p>
                  ) : (
                    <div className="overflow-x-auto max-h-52 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase">
                          <tr>
                            <th className="py-2 px-3">Time (PKT)</th>
                            <th className="py-2 px-3">Reason</th>
                            <th className="py-2 px-3">Note</th>
                            <th className="py-2 px-3 text-right">Points Delta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {memberDetail.ledger.map((l) => (
                            <tr key={l.id}>
                              <td className="py-2 px-3 font-mono text-[11px]">
                                {l.createdAtKarachi || formatKarachiDateTime(l.createdAt)}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px]">{l.reason}</td>
                              <td className="py-2 px-3 text-[11px] text-slate-600 dark:text-slate-400">{l.note}</td>
                              <td
                                className={`py-2 px-3 text-right font-mono font-bold ${
                                  l.pointsDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {l.pointsDelta >= 0 ? `+${l.pointsDelta}` : l.pointsDelta} Pts
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
