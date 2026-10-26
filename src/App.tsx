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
import { ArticleView } from './components/ArticleView';
import { PhoneOnboardingModal } from './components/PhoneOnboardingModal';
import { auth, logOutFromFirebase, resendVerification } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [balances, setBalances] = useState<UserBalances | null>(null);
  const [usdtQuote, setUsdtQuote] = useState<UsdtQuote | null>(null);
  const [cpxStatus, setCpxStatus] = useState<CpxConfigStatus | null>(null);

  // Tab navigation: 'landing' (if unauthed), 'dashboard', 'surveys', 'withdraw', 'transactions', 'settings', 'admin'
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signin');
  const [activeArticle, setActiveArticle] = useState<string | null>(null);

  // Data states
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [surveysError, setSurveysError] = useState<string | null>(null);
  const [surveyDisplayMode, setSurveyDisplayMode] = useState<'hybrid' | 'points_only'>('hybrid');
  const [pointsPerUsdt, setPointsPerUsdt] = useState<number>(10000);
  const [userSharePercent, setUserSharePercent] = useState<number>(40);
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
        if (data.pointsPerUsdt) setPointsPerUsdt(Number(data.pointsPerUsdt) || 10000);
        if (data.userSharePercent) setUserSharePercent(Number(data.userSharePercent) || 40);
      } else {
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
        if (data.surveyDisplayMode) {
          setSurveyDisplayMode(data.surveyDisplayMode);
        }
        if (data.pointsPerUsdt) {
          setPointsPerUsdt(Number(data.pointsPerUsdt) || 10000);
        }
        if (data.userSharePercent) {
          setUserSharePercent(Number(data.userSharePercent) || 40);
        }
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
        if (lData.pointsPerUsdt) setPointsPerUsdt(Number(lData.pointsPerUsdt) || 10000);
        if (lData.userSharePercent) setUserSharePercent(Number(lData.userSharePercent) || 40);
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

  // Listen to Firebase Auth state for real persistent account status
  useEffect(() => {
    fetchUsdtQuote();
    fetchCpxStatus();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          const res = await fetch('/api/auth/firebase-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken,
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName || fbUser.email?.split('@')[0],
              emailVerified: fbUser.emailVerified,
              photoURL: fbUser.photoURL || undefined,
              phoneNumber: fbUser.phoneNumber || undefined,
              provider: fbUser.providerData?.[0]?.providerId || 'google.com'
            })
          });

          if (res.ok) {
            const data = await res.json();
            localStorage.setItem('rr_auth_token', data.token);
            setUser(data.user);
            setBalances(data.balances);
            setCurrentTab((prev) => (prev === 'landing' ? 'dashboard' : prev));

            if (data.user && !data.user.whatsappNumber && !data.user.phoneNumber && !data.user.hasPromptedPhone && !sessionStorage.getItem('phone_prompt_dismissed')) {
              setPhoneModalOpen(true);
            }
          }
        } catch (e) {
          console.warn('Firebase state sync warning:', e);
        }
      } else {
        const token = getAuthToken();
        if (token) {
          fetchUserData(token).then(() => {
            setCurrentTab((prev) => (prev === 'landing' ? 'dashboard' : prev));
          });
        }
      }
    });

    return () => unsubscribe();
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
    setCurrentTab(newUser.role === 'admin' ? 'admin' : 'dashboard');
    handleRefreshAll();
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await logOutFromFirebase();
    } catch {
      // Ignored
    }
    localStorage.removeItem('rr_auth_token');
    setUser(null);
    setBalances(null);
    setCurrentTab('landing');
  };

  // Verify email trigger
  const handleVerifyEmail = async () => {
    const token = getAuthToken();
    try {
      await resendVerification();
      if (token) {
        await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      handleRefreshAll();
    } catch (e) {
      console.warn('Verification dispatch failed:', e);
    }
  };

  // Start Survey Flow
  const handleStartSurvey = async (survey: Survey) => {
    const token = getAuthToken();
    if (!token) {
      setAuthInitialMode('signin');
      setAuthModalOpen(true);
      return;
    }

    let targetUrl = survey.directUrl;

    try {
      const res = await fetch('/api/surveys/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          surveyId: survey.id,
          loi: survey.loiMinutes,
          cpi: survey.cpi,
          directUrl: survey.directUrl
        })
      });

      if (res.ok) {
        const text = await res.text();
        if (text) {
          try {
            const data = JSON.parse(text);
            if (data.redirectUrl || data.url) {
              targetUrl = data.redirectUrl || data.url;
            }
          } catch {
            // Use existing valid directUrl
          }
        }
      }
    } catch (err) {
      console.warn('Backend survey start ping failed, falling back to direct launch URL:', err);
    }

    if (targetUrl) {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Submit Withdrawal Request
  const handleSubmitWithdrawal = async (amountCents: number, usdtAddress: string, network: UsdtNetwork) => {
    const token = getAuthToken();
    if (!token) {
      setAuthInitialMode('signin');
      setAuthModalOpen(true);
      return;
    }

    const res = await fetch('/api/withdrawals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ amountCents, usdtAddress, network })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Withdrawal request failed.');
    }

    // Refresh balances and withdrawals
    handleRefreshAll();
  };

  // Password change handler
  const handlePasswordChange = async (currentPass: string, newPass: string) => {
    const token = getAuthToken();
    if (!token) return { success: false, error: 'Authentication required' };
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Password update failed' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network communication failed' };
    }
  };

  // WhatsApp / Phone onboarding save handler
  const handleSavePhone = async (whatsappNumber: string, countryCode: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch('/api/user/phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ whatsappNumber, countryCode })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
        }
      }
    } catch (e) {
      console.warn('Failed to save phone number:', e);
    } finally {
      sessionStorage.setItem('phone_prompt_dismissed', 'true');
      setPhoneModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-sky-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        user={user}
        balances={balances}
        usdtQuote={usdtQuote}
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setActiveArticle(null);
        }}
        onOpenAuth={(mode) => {
          setAuthInitialMode(mode);
          setAuthModalOpen(true);
        }}
        onSignOut={handleSignOut}
        onOpenLegal={(page) => setActiveArticle(page)}
      />

      {/* Main Content Area */}
      <main
        className={
          currentTab === 'admin' && user?.role === 'admin' && !activeArticle
            ? 'flex-1 w-full flex flex-col'
            : activeArticle
            ? 'flex-1 w-full'
            : 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6'
        }
      >
        {activeArticle ? (
          <ArticleView page={activeArticle} onBack={() => setActiveArticle(null)} />
        ) : (
          <div key={currentTab} className="animate-fade-in-up">
            {currentTab === 'landing' && (
              <LandingPage
                onGetStarted={() => {
                  setAuthInitialMode('signup');
                  setAuthModalOpen(true);
                }}
                onOpenLegal={(page) => setActiveArticle(page)}
                usdtQuote={usdtQuote}
              />
            )}

            {(currentTab === 'dashboard' || currentTab === 'earnings') && user && (
              <UserDashboard
                user={user}
                balances={balances}
                usdtQuote={usdtQuote}
                pointsPerUsdt={pointsPerUsdt}
                userSharePercent={userSharePercent}
                surveys={surveys.slice(0, 4)}
                surveysLoading={surveysLoading}
                recentWithdrawals={withdrawals.slice(0, 3)}
                recentLedger={ledgerEntries.slice(0, 5)}
                onNavigateTab={setCurrentTab}
                onStartSurvey={handleStartSurvey}
                onVerifyEmail={handleVerifyEmail}
              />
            )}

            {currentTab === 'surveys' && user && (
              <SurveysView
                surveys={surveys}
                loading={surveysLoading}
                error={surveysError}
                cpxStatus={cpxStatus}
                usdtQuote={usdtQuote}
                surveyDisplayMode={surveyDisplayMode}
                pointsPerUsdt={pointsPerUsdt}
                userSharePercent={userSharePercent}
                onRefresh={fetchSurveys}
                onStartSurvey={handleStartSurvey}
                onTaskCompleted={handleRefreshAll}
              />
            )}

            {currentTab === 'withdraw' && user && (
              <WithdrawalView
                user={user}
                balances={balances}
                usdtQuote={usdtQuote}
                pointsPerUsdt={pointsPerUsdt}
                userSharePercent={userSharePercent}
                withdrawals={withdrawals}
                onRefreshQuote={fetchUsdtQuote}
                onSubmitWithdrawal={async (usdtAddress, network, amountCents) => {
                  try {
                    await handleSubmitWithdrawal(amountCents, usdtAddress, network);
                    return { success: true };
                  } catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : String(err) };
                  }
                }}
                onVerifyEmail={handleVerifyEmail}
              />
            )}

            {currentTab === 'transactions' && user && (
              <TransactionsView
                entries={ledgerEntries}
                usdtQuote={usdtQuote}
                pointsPerUsdt={pointsPerUsdt}
                userSharePercent={userSharePercent}
                onRefresh={fetchLedgerAndWithdrawals}
              />
            )}

            {currentTab === 'settings' && user && (
              <SettingsView
                user={user}
                onVerifyEmail={handleVerifyEmail}
                onPasswordChange={handlePasswordChange}
              />
            )}

            {currentTab === 'admin' && user?.role === 'admin' && (
              <AdminView
                adminUser={user}
                cpxStatus={cpxStatus}
                onDataChanged={handleRefreshAll}
                onExitAdmin={() => setCurrentTab('dashboard')}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer (hidden inside full-screen Admin Console for clean sidebar layout) */}
      {currentTab !== 'admin' && (
        <Footer
          onOpenLegal={(page) => setActiveArticle(page)}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        onOpenLegal={(page) => {
          setAuthModalOpen(false);
          setActiveArticle(page);
        }}
      />

      {/* Phone & WhatsApp Onboarding Modal */}
      {user && (
        <PhoneOnboardingModal
          isOpen={phoneModalOpen}
          user={user}
          onSave={handleSavePhone}
          onClose={() => {
            sessionStorage.setItem('phone_prompt_dismissed', 'true');
            setPhoneModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
