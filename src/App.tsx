/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User, UserBalances, UsdtQuote, Survey, Withdrawal, LedgerEntry, CpxConfigStatus } from './types';
import { UsdtNetwork } from './utils/usdt';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { UserDashboard } from './components/UserDashboard';
import { SurveysView } from './components/SurveysView';
import { WithdrawalView } from './components/WithdrawalView';
import { TransactionsView } from './components/TransactionsView';
import { SettingsView } from './components/SettingsView';
import { AdminView } from './components/AdminView';
import { LegalModal } from './components/LegalModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [balances, setBalances] = useState<UserBalances | null>(null);
  const [usdtQuote, setUsdtQuote] = useState<UsdtQuote | null>(null);
  const [cpxStatus, setCpxStatus] = useState<CpxConfigStatus | null>(null);

  // Tab navigation: 'landing' (if unauthed), 'dashboard', 'surveys', 'withdraw', 'transactions', 'settings', 'admin'
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signin');
  const [legalModalPage, setLegalModalPage] = useState<string | null>(null);

  // Data states
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [surveysError, setSurveysError] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  // Token helper
  const getAuthToken = () => localStorage.getItem('rr_auth_token');

  // Fetch live USDT exchange rate / peg quote
  const fetchUsdtQuote = useCallback(async () => {
    try {
      const res = await fetch('/api/usdt/price');
      if (res.ok) {
        const quote = await res.json();
        setUsdtQuote(quote);
      }
    } catch (e) {
      console.warn('Could not fetch USDT price quote:', e);
    }
  }, []);

  // Fetch CPX publisher status
  const fetchCpxStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cpx/status');
      if (res.ok) {
        const status = await res.json();
        setCpxStatus(status);
      }
    } catch (e) {
      console.warn('Could not fetch CPX status:', e);
    }
  }, []);

  // Fetch user data (profile & balance)
  const fetchUserData = useCallback(async (token?: string) => {
    const activeToken = token || getAuthToken();
    if (!activeToken) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setBalances(data.balances);
      } else {
        // Invalid or expired token
        localStorage.removeItem('rr_auth_token');
        setUser(null);
        setBalances(null);
      }
    } catch (e) {
      console.warn('Failed to fetch user session:', e);
    }
  }, []);

  // Fetch surveys from CPX API
  const fetchSurveys = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    setSurveysLoading(true);
    setSurveysError(null);
    try {
      const res = await fetch('/api/surveys', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setSurveysError(data.error || 'Failed to fetch available surveys.');
      } else {
        setSurveys(data.surveys || []);
        if (data.usdtQuote) {
          setUsdtQuote(data.usdtQuote);
        }
      }
    } catch (err: unknown) {
      setSurveysError('Connection to survey server failed.');
    } finally {
      setSurveysLoading(false);
    }
  }, []);

  // Fetch ledger and withdrawals
  const fetchLedgerAndWithdrawals = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const [ledgRes, withRes] = await Promise.all([
        fetch('/api/ledger', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/withdrawals', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (ledgRes.ok) {
        const lData = await ledgRes.json();
        setLedgerEntries(lData.entries || []);
        if (lData.balances) setBalances(lData.balances);
      }

      if (withRes.ok) {
        const wData = await withRes.json();
        setWithdrawals(wData.withdrawals || []);
      }
    } catch (e) {
      console.warn('Failed to fetch ledger data:', e);
    }
  }, []);

  // Refresh all user data
  const handleRefreshAll = useCallback(() => {
    fetchUserData();
    fetchSurveys();
    fetchLedgerAndWithdrawals();
    fetchUsdtQuote();
    fetchCpxStatus();
  }, [fetchUserData, fetchSurveys, fetchLedgerAndWithdrawals, fetchUsdtQuote, fetchCpxStatus]);

  // Initial mount load & autostart query param support
  useEffect(() => {
    fetchUsdtQuote();
    fetchCpxStatus();

    const token = getAuthToken();
    if (token) {
      fetchUserData(token).then(() => {
        setCurrentTab('dashboard');
      });
    }

    // Check autostart param
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && !token) {
      // Simulate quick demo sign in for rapid evaluation
      fetch('/api/auth/google-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'evaluator@rewardriver.com', displayName: 'Preview User' })
      })
        .then(r => r.json())
        .then(data => {
          if (data.token) {
            localStorage.setItem('rr_auth_token', data.token);
            setUser(data.user);
            setBalances(data.balances);
            setCurrentTab('dashboard');
          }
        });
    }
  }, [fetchUsdtQuote, fetchCpxStatus, fetchUserData]);

  // When tab changes, load specific tab data
  useEffect(() => {
    if (user) {
      if (currentTab === 'surveys') fetchSurveys();
      if (['dashboard', 'withdraw', 'transactions', 'earnings'].includes(currentTab)) {
        fetchLedgerAndWithdrawals();
      }
    }
  }, [currentTab, user, fetchSurveys, fetchLedgerAndWithdrawals]);

  // Handle Authentication Success
  const handleAuthSuccess = (token: string, newUser: User, newBalances?: UserBalances) => {
    localStorage.setItem('rr_auth_token', token);
    setUser(newUser);
    if (newBalances) setBalances(newBalances);
    setCurrentTab('dashboard');
    handleRefreshAll();
  };

  // Sign out
  const handleSignOut = () => {
    localStorage.removeItem('rr_auth_token');
    setUser(null);
    setBalances(null);
    setCurrentTab('landing');
  };

  // Verify email trigger
  const handleVerifyEmail = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUser(prev => (prev ? { ...prev, emailVerified: true } : null));
        handleRefreshAll();
      }
    } catch (e) {
      console.warn('Verification failed:', e);
    }
  };

  // Start Survey Flow
  const handleStartSurvey = async (survey: Survey) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/surveys/start/${survey.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(survey.directUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Submit Withdrawal Request in USDT
  const handleSubmitWithdrawal = async (usdtAddress: string, network: UsdtNetwork, amountCents: number) => {
    const token = getAuthToken();
    if (!token) return { success: false, error: 'Not authenticated' };

    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ usdtAddress, network, amountCents })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Withdrawal submission failed.' };
      }

      if (data.balances) setBalances(data.balances);
      fetchLedgerAndWithdrawals();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  // Password Change
  const handlePasswordChange = async (currentPassword: string, newPassword: string) => {
    const token = getAuthToken();
    if (!token) return { success: false, error: 'Not authenticated' };

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    return { success: res.ok, error: data.error };
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Navigation */}
      <Navbar
        user={user}
        balances={balances}
        usdtQuote={usdtQuote}
        currentTab={currentTab}
        onSelectTab={tab => setCurrentTab(tab)}
        onOpenAuth={mode => {
          setAuthInitialMode(mode);
          setAuthModalOpen(true);
        }}
        onSignOut={handleSignOut}
        onOpenLegal={page => setLegalModalPage(page)}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {!user || currentTab === 'landing' ? (
          <LandingPage
            usdtQuote={usdtQuote}
            onGetStarted={() => {
              if (user) setCurrentTab('surveys');
              else {
                setAuthInitialMode('signup');
                setAuthModalOpen(true);
              }
            }}
            onOpenLegal={page => setLegalModalPage(page)}
          />
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <UserDashboard
                user={user}
                balances={balances}
                usdtQuote={usdtQuote}
                recentLedger={ledgerEntries}
                recentWithdrawals={withdrawals}
                onSelectTab={tab => setCurrentTab(tab)}
                onVerifyEmail={handleVerifyEmail}
              />
            )}

            {currentTab === 'surveys' && (
              <SurveysView
                surveys={surveys}
                loading={surveysLoading}
                error={surveysError}
                cpxStatus={cpxStatus}
                usdtQuote={usdtQuote}
                onRefresh={fetchSurveys}
                onStartSurvey={handleStartSurvey}
              />
            )}

            {currentTab === 'withdraw' && (
              <WithdrawalView
                user={user}
                balances={balances}
                usdtQuote={usdtQuote}
                withdrawals={withdrawals}
                onRefreshQuote={fetchUsdtQuote}
                onSubmitWithdrawal={handleSubmitWithdrawal}
                onVerifyEmail={handleVerifyEmail}
              />
            )}

            {(currentTab === 'transactions' || currentTab === 'earnings') && (
              <TransactionsView
                entries={ledgerEntries}
                usdtQuote={usdtQuote}
                onRefresh={fetchLedgerAndWithdrawals}
              />
            )}

            {currentTab === 'settings' && (
              <SettingsView
                user={user}
                onVerifyEmail={handleVerifyEmail}
                onPasswordChange={handlePasswordChange}
              />
            )}

            {currentTab === 'admin' && user.role === 'admin' && (
              <AdminView
                user={user}
                onRefreshAll={handleRefreshAll}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <Footer onOpenLegal={page => setLegalModalPage(page)} />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        onOpenLegal={page => setLegalModalPage(page)}
      />

      {/* Legal & Documentation Modal */}
      <LegalModal
        page={legalModalPage}
        onClose={() => setLegalModalPage(null)}
      />
    </div>
  );
}
