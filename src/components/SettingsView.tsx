import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import {
  ShieldCheck,
  User as UserIcon,
  CheckCircle2,
  KeyRound,
  Globe,
  ExternalLink,
  Users
} from 'lucide-react';
import { formatKarachiDateTime } from '../utils/adminStats';

interface SettingsViewProps {
  user: User;
  token?: string;
  onVerifyEmail: () => void;
  onPasswordChange: (currentPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  token,
  onPasswordChange
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [teamInfo, setTeamInfo] = useState<{
    teamSystemEnabled: boolean;
    canJoinTeam: boolean;
    membership: {
      teamId: string;
      teamName: string;
      teamCode: string;
      managerName: string;
      managerEmail: string;
      joinedAt: string;
      consentAcceptedAt: string;
    } | null;
  } | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const [joinLookup, setJoinLookup] = useState<{
    checking: boolean;
    found: boolean;
    teamName?: string;
    message?: string;
  }>({ checking: false, found: false });
  const [joinConsent, setJoinConsent] = useState(false);
  const [joiningTeam, setJoiningTeam] = useState(false);
  const [joinNotice, setJoinNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const effectiveToken = token || localStorage.getItem('rr_auth_token') || '';

  const fetchUserTeam = useCallback(async () => {
    if (!effectiveToken) return;
    try {
      const res = await fetch('/api/user/team', {
        headers: { Authorization: `Bearer ${effectiveToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeamInfo(data);
      }
    } catch {
      // ignore
    }
  }, [effectiveToken]);

  useEffect(() => {
    fetchUserTeam();
  }, [fetchUserTeam]);

  useEffect(() => {
    const clean = joinCode.trim().toUpperCase();
    if (!clean) {
      setJoinLookup({ checking: false, found: false });
      return;
    }
    let cancelled = false;
    setJoinLookup({ checking: true, found: false });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/teams/lookup?code=${encodeURIComponent(clean)}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data && data.found && data.team) {
          setJoinLookup({
            checking: false,
            found: true,
            teamName: data.team.teamName
          });
        } else {
          setJoinLookup({
            checking: false,
            found: false,
            message: data?.error || 'Invalid or inactive team code.'
          });
        }
      } catch {
        if (!cancelled) {
          setJoinLookup({ checking: false, found: false, message: 'Failed to look up team code.' });
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [joinCode]);

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinNotice(null);
    if (!joinCode.trim()) return;
    if (!joinConsent) {
      setJoinNotice({
        type: 'error',
        text: 'Please accept the team manager visibility consent checkbox before joining.'
      });
      return;
    }
    setJoiningTeam(true);
    try {
      const res = await fetch('/api/teams/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({
          teamCode: joinCode.trim().toUpperCase(),
          consentAccepted: joinConsent
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setJoinNotice({ type: 'error', text: data?.error || 'Could not join team.' });
      } else {
        setJoinNotice({
          type: 'success',
          text: `Successfully joined team "${data.membership?.teamName}" (${data.membership?.teamCode})!`
        });
        setJoinCode('');
        setJoinConsent(false);
        fetchUserTeam();
      }
    } catch {
      setJoinNotice({ type: 'error', text: 'Network error while joining team.' });
    } finally {
      setJoiningTeam(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters long.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await onPasswordChange(currentPassword, newPassword);
      if (!res.success) {
        setPasswordError(res.error || 'Failed to update password.');
      } else {
        setPasswordSuccess('Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
      }
    } catch {
      setPasswordError('Failed to change password. Please check your credentials.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Account Settings & Security
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your profile identity, team membership, and account credentials.
        </p>
      </div>

      {/* Account Profile Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-sky-600" />
          <span>Profile Overview</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-semibold block text-[11px]">Email Address</span>
            <span className="font-bold text-slate-900 text-sm">{user.email}</span>
            <div className="pt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Active Account
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-semibold block text-[11px]">Username / Display Name</span>
            <span className="font-bold text-slate-900 text-sm">{user.displayName}</span>
            <p className="text-[11px] text-slate-400 pt-2">
              Role: <strong className="text-slate-700 uppercase">{user.role}</strong> • ID: <code className="font-mono">{user.id}</code>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-semibold block text-[11px]">Registered Date (Asia/Karachi)</span>
            <span className="font-semibold text-slate-800 font-mono">
              {formatKarachiDateTime(user.createdAt)}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <span className="text-slate-400 font-semibold block text-[11px]">Anonymous Survey Session ID</span>
            <span className="font-mono text-slate-700 font-semibold">
              {user.externalOpaqueId || user.id}
            </span>
            <p className="text-[10px] text-slate-400 pt-1">
              Used strictly for anonymous CPX Research survey session tracking. Your email and name are never shared with survey providers.
            </p>
          </div>
        </div>
      </div>

      {/* Team Membership Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-600" />
          <span>Team Membership</span>
        </h3>

        {teamInfo?.membership ? (
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase block">Active Team Member</span>
                <span className="text-base font-black text-slate-900">
                  {teamInfo.membership.teamName}{' '}
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-xs">
                    {teamInfo.membership.teamCode}
                  </span>
                </span>
              </div>
              <div className="text-right text-[11px] text-slate-600 font-mono">
                Joined: {formatKarachiDateTime(teamInfo.membership.joinedAt)} PKT
              </div>
            </div>
            <p className="text-[11px] text-slate-600">
              Team Manager: <strong>{teamInfo.membership.managerName}</strong> ({teamInfo.membership.managerEmail}) • Team membership is permanent once joined and can only be changed by an administrator.
            </p>
          </div>
        ) : teamInfo?.canJoinTeam ? (
          <form onSubmit={handleJoinTeam} className="space-y-3 max-w-lg">
            <p className="text-xs text-slate-600">
              Have a team invite code from a Reward River Team Manager? Enter it below to join their team. You can join a team once.
            </p>

            {joinNotice && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  joinNotice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {joinNotice.text}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Team Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-8 character code (e.g. RVR7K9M2)"
                maxLength={12}
                className="w-full px-3 py-2 text-xs font-mono uppercase rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {joinCode.trim() && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                {joinLookup.checking ? (
                  <p className="text-slate-500 font-semibold">Looking up team...</p>
                ) : joinLookup.found ? (
                  <>
                    <p className="font-extrabold text-emerald-700">
                      You are joining: {joinLookup.teamName}
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-700 font-medium">
                      <input
                        type="checkbox"
                        checked={joinConsent}
                        onChange={(e) => setJoinConsent(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-emerald-600"
                      />
                      <span>
                        Your team manager will be able to see your email, survey activity and points.
                      </span>
                    </label>
                  </>
                ) : (
                  <p className="text-rose-600 font-semibold">
                    {joinLookup.message || 'Invalid or inactive team code.'}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={joiningTeam || !joinLookup.found || !joinConsent}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {joiningTeam ? 'Joining Team...' : 'Join Team'}
            </button>
          </form>
        ) : (
          <p className="text-xs text-slate-500">
            {user.role === 'manager'
              ? 'You are an appointed Team Manager. Manage your teams and view member progress in the Manager Portal.'
              : 'You are not currently assigned to a team.'}
          </p>
        )}
      </div>

      {/* Password Management */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-sky-600" />
          <span>Change Password</span>
        </h3>

        {passwordError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            {passwordError}
          </div>
        )}

        {passwordSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            {passwordSuccess}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password (Single Password)
            </label>
            <input
              type="text"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <button
            type="submit"
            disabled={passwordLoading}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
          >
            {passwordLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Official Support & Contact */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-600" />
          <span>Official Contact & Support Partner</span>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          Reward River is proudly developed and supported by <strong>www.injazify.com</strong>. For any support inquiries, platform assistance, or corporate partnerships, please contact us at our official portal.
        </p>
        <div className="pt-1">
          <a
            href="https://www.injazify.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <span>Visit www.injazify.com</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Security Best Practices Reminder */}
      <div className="p-5 rounded-2xl bg-sky-50/70 border border-sky-100 flex items-start gap-3 text-xs text-sky-900">
        <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold">Zero-Seed-Phrase Security Principle</h4>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            Reward River never asks for your private key, seed phrase, or wallet passwords. All USDT payouts are sent directly to the public USDT destination address (TRC-20 or ERC-20) you specify. Never share your private keys or seed phrase with anyone.
          </p>
        </div>
      </div>
    </div>
  );
};
