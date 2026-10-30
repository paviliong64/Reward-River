/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User, UserBalances, UsdtQuote, Survey, Withdrawal, LedgerEntry, CpxConfigStatus } from './types';
import { UsdtNetwork } from './utils/usdt';
import { fetchLiveCpxSurveysBrowser } from './utils/cpxClient';
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
import { supabase } from './supabase';

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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('rr_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore storage errors
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('rr_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Data states
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);
  const [surveysError, setSurveysError] = useState<string | null>(null);
  const [surveyDisplayMode, setSurveyDisplayMode] = useState<'hybrid' | 'points_only'>('hybrid');
  const [pointsPerUsdt, setPointsPerUsdt] = useState<number>(5000);
  const [userSharePercent, setUserSharePercent] = useState<number>(50);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [cpxConfig, setCpxConfig] = useState<{
    appId: string;
    extUserId: string;
    secureHash: string;
    themeColor?: string;
  } | null>(null);

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
  const fetchUserData = useCallback(async (token?: string): Promise<User | null> => {
    const activeToken = token || getAuthToken();
    if (!activeToken) return null;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setBalances(data.balances);
        try {
          localStorage.setItem('rr_auth_user', JSON.stringify(data.user));
        } catch {
          // ignore storage quota errors
        }
        if (data.pointsPerUsdt) setPointsPerUsdt(Number(data.pointsPerUsdt) || 5000);
        if (data.userSharePercent) setUserSharePercent(Number(data.userSharePercent) || 50);
        return data.user;
      }
    } catch (e) {
      console.warn('Failed to fetch user session:', e);
    }

    // Fallback to cached user if backend is cold-starting or temporarily unreachable
    try {
      const cachedRaw = localStorage.getItem('rr_auth_user');
      if (cachedRaw) {
        const cachedUser = JSON.parse(cachedRaw) as User;
        if (cachedUser && cachedUser.id && cachedUser.email) {
          setUser(cachedUser);
          return cachedUser;
        }
      }
    } catch {
      // ignore parse errors
    }

    localStorage.removeItem('rr_auth_token');
    localStorage.removeItem('rr_auth_user');
    setUser(null);
    setBalances(null);
    return null;
  }, []);

  // Fetch surveys from CPX API (with direct live-api.cpx-research.com browser fallback)
  const fetchSurveys = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    setSurveysLoading(true);
    setSurveysError(null);
    const fallbackExtId = user?.externalOpaqueId || (user?.id ? `rr_cpx_${user.id}` : 'rr_cpx_member_1');

    try {
      const res = await fetch('/api/surveys', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (data.balances) {
        setBalances(data.balances);
      }
      if (res.ok && Array.isArray(data.surveys) && data.surveys.length > 0) {
        setSurveys(data.surveys);
        if (data.surveyDisplayMode) {
          setSurveyDisplayMode(data.surveyDisplayMode);
        }
        if (data.pointsPerUsdt) {
          setPointsPerUsdt(Number(data.pointsPerUsdt) || 5000);
        }
        if (data.userSharePercent) {
          setUserSharePercent(Number(data.userSharePercent) || 50);
        }
        if (data.usdtQuote) {
          setUsdtQuote(data.usdtQuote);
        }
        if (data.cpxConfig) {
          setCpxConfig(data.cpxConfig);
        }
        return;
      }

      // Direct live-api.cpx-research.com browser fetch if backend route is unreachable or empty
      const liveBrowser = await fetchLiveCpxSurveysBrowser({
        appId: data?.cpxConfig?.appId || '37699',
        hashKey: '1u8hIFGwUYYORM76NM76PDxenCC50bCZ',
        extUserId: data?.cpxConfig?.extUserId || fallbackExtId,
        userSharePercent,
        pointsPerUsdt,
        limit: 12
      });
      setSurveys(liveBrowser.surveys);
      setCpxConfig({
        appId: liveBrowser.appId,
        extUserId: fallbackExtId,
        secureHash: liveBrowser.secureHash,
        themeColor: '10b981'
      });
    } catch {
      try {
        const liveBrowser = await fetchLiveCpxSurveysBrowser({
          appId: '37699',
          hashKey: '1u8hIFGwUYYORM76NM76PDxenCC50bCZ',
          extUserId: fallbackExtId,
          userSharePercent,
          pointsPerUsdt,
          limit: 12
        });
        setSurveys(liveBrowser.surveys);
        setCpxConfig({
          appId: liveBrowser.appId,
          extUserId: fallbackExtId,
          secureHash: liveBrowser.secureHash,
          themeColor: '10b981'
        });
      } catch {
        setSurveysError('Connection to survey server failed. Please refresh or try again.');
      }
    } finally {
      setSurveysLoading(false);
    }
  }, [user, userSharePercent, pointsPerUsdt]);

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
        if (lData.pointsPerUsdt) setPointsPerUsdt(Number(lData.pointsPerUsdt) || 5000);
        if (lData.userSharePercent) setUserSharePercent(Number(lData.userSharePercent) || 50);
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

  // Listen to Session and Supabase Auth state
  useEffect(() => {
    fetchUsdtQuote();
    fetchCpxStatus();

    const token = getAuthToken();
    const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';

    if (token) {
      fetchUserData(token).then((loadedUser) => {
        if (loadedUser?.role === 'admin') {
          setCurrentTab('admin');
        } else if (pathname === '/admin' || pathname.startsWith('/admin/')) {
          setAuthInitialMode('signin');
          setAuthModalOpen(true);
        } else {
          setCurrentTab((prev) => (prev === 'landing' || prev === 'dashboard' ? 'surveys' : prev));
        }
      });
    } else if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      setAuthInitialMode('signin');
      setAuthModalOpen(true);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && event === 'SIGNED_IN' && !getAuthToken()) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem('rr_auth_token', session.access_token);
            setUser(data.user);
            setBalances(data.balances);
            setCurrentTab(data.user?.role === 'admin' ? 'admin' : 'surveys');
          }
        } catch (e) {
          console.warn('Supabase state sync warning:', e);
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [fetchUsdtQuote, fetchCpxStatus, fetchUserData]);

  // When tab changes or user logs in, load surveys + latest balances/completedSurveysCount
  useEffect(() => {
    if (user) {
      fetchLedgerAndWithdrawals();
      if (currentTab !== 'admin') fetchSurveys();
    }
  }, [currentTab, user, fetchSurveys, fetchLedgerAndWithdrawals]);

  // Real-time auto-sync user Points & Balance: Polling (15s) + Focus + Supabase Realtime
  useEffect(() => {
    if (!user) return;

    // 1. Polling interval (every 15s) while user is logged in
    const interval = setInterval(() => {
      fetchUserData();
      fetchLedgerAndWithdrawals();
    }, 15000);

    // 2. Window focus or tab switch
    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUserData();
        fetchLedgerAndWithdrawals();
      }
    };
    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    // 3. Supabase Realtime Channel: Listen for new rewards inserted for this user
    let channel: any = null;
    try {
      channel = supabase
        .channel(`user-points-sync-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reward_ledger',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchUserData();
            fetchLedgerAndWithdrawals();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[Realtime Sync Note]:', e);
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, fetchUserData, fetchLedgerAndWithdrawals]);

  // Handle Authentication Success
  const handleAuthSuccess = (token: string, newUser: User, newBalances?: UserBalances) => {
    localStorage.setItem('rr_auth_token', token);
    try {
      localStorage.setItem('rr_auth_user', JSON.stringify(newUser));
    } catch {
      // ignore storage errors
    }
    setUser(newUser);
    if (newBalances) {
      setBalances(newBalances);
    } else {
      setBalances({
        availableCents: 0,
        pendingCents: 0,
        totalEarnedCents: 0,
        totalWithdrawnCents: 0,
        reservedWithdrawalCents: 0,
        availablePoints: 0,
        pendingPoints: 0,
        totalEarnedPoints: 0,
        totalWithdrawnPoints: 0,
        completedSurveysCount: 0
      });
    }
    setCurrentTab(newUser.role === 'admin' ? 'admin' : 'surveys');
    handleRefreshAll();
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignored
    }
    localStorage.removeItem('rr_auth_token');
    localStorage.removeItem('rr_auth_user');
    setUser(null);
    setBalances(null);
    setCurrentTab('landing');
  };

  // Verify email trigger
  const handleVerifyEmail = async () => {
    const token = getAuthToken();
    try {
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

  // Submit Withdrawal Request ($25.00 Minimum = 250,000 Points)
  const handleSubmitWithdrawal = async (
    usdtAddress: string,
    network: UsdtNetwork,
    amountCents: number
  ): Promise<{ success: boolean; error?: string }> => {
    const token = getAuthToken();
    if (!token) {
      setAuthInitialMode('signin');
      setAuthModalOpen(true);
      return { success: false, error: 'Please sign in to request a withdrawal.' };
    }

    try {
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
        return { success: false, error: data.error || 'Withdrawal request failed.' };
      }

      if (data.balances) {
        setBalances(data.balances);
      }
      await fetchLedgerAndWithdrawals();
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error submitting withdrawal request.';
      return { success: false, error: msg };
    }
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

  // If user is not authenticated, render the full Homepage Landing Page (or legal article if opened)
  if (!user) {
    if (activeArticle) {
      return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090d16] text-slate-800 dark:text-slate-100 antialiased transition-colors">
          <Navbar
            user={null}
            balances={null}
            usdtQuote={usdtQuote}
            currentTab="landing"
            onSelectTab={() => setActiveArticle(null)}
            onOpenAuth={(mode) => {
              setAuthInitialMode(mode);
              setAuthModalOpen(true);
            }}
            onSignOut={() => {}}
            onOpenLegal={(page) => setActiveArticle(page)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
          <main className="flex-1 w-full">
            <ArticleView page={activeArticle} onBack={() => setActiveArticle(null)} />
          </main>
          <Footer onOpenLegal={(page) => setActiveArticle(page)} />
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 antialiased transition-colors">
        <Navbar
          user={null}
          balances={null}
          usdtQuote={usdtQuote}
          currentTab="landing"
          onSelectTab={() => {}}
          onOpenAuth={(mode) => {
            setAuthInitialMode(mode);
            setAuthModalOpen(true);
          }}
          onSignOut={() => {}}
          onOpenLegal={(page) => setActiveArticle(page)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        <main className="flex-1 w-full">
          <LandingPage
            usdtQuote={usdtQuote}
            onGetStarted={() => {
              setAuthInitialMode('signup');
              setAuthModalOpen(true);
            }}
            onOpenLegal={(page) => setActiveArticle(page)}
          />
        </main>

        <Footer onOpenLegal={(page) => setActiveArticle(page)} />

        {authModalOpen && (
          <AuthModal
            isOpen={authModalOpen}
            standalone={false}
            initialMode={authInitialMode}
            onClose={() => setAuthModalOpen(false)}
            onSuccess={handleAuthSuccess}
            onOpenLegal={(page) => {
              setAuthModalOpen(false);
              setActiveArticle(page);
            }}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090d16] text-slate-800 dark:text-slate-100 antialiased selection:bg-sky-500 selection:text-white transition-colors">
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
        theme={theme}
        onToggleTheme={handleToggleTheme}
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
                usdtQuote={usdtQuote}
                onGetStarted={() => setCurrentTab('surveys')}
                onOpenLegal={(page) => setActiveArticle(page)}
              />
            )}

            {currentTab === 'withdraw' && (
              <WithdrawalView
                user={user}
                balances={balances}
                usdtQuote={usdtQuote}
                withdrawals={withdrawals}
                pointsPerUsdt={pointsPerUsdt}
                userSharePercent={userSharePercent}
                onSubmitWithdrawal={handleSubmitWithdrawal}
                onVerifyEmail={handleVerifyEmail}
                onRefresh={handleRefreshAll}
                onBackToSurveys={() => setCurrentTab('surveys')}
              />
            )}

            {(currentTab === 'surveys' || (currentTab !== 'landing' && currentTab !== 'admin' && currentTab !== 'withdraw')) && (
              <SurveysView
                surveys={surveys}
                loading={surveysLoading}
                error={surveysError}
                cpxStatus={cpxStatus}
                usdtQuote={usdtQuote}
                balances={balances}
                surveyDisplayMode="points_only"
                pointsPerUsdt={pointsPerUsdt}
                userSharePercent={userSharePercent}
                onRefresh={fetchSurveys}
                onStartSurvey={handleStartSurvey}
                onTaskCompleted={handleRefreshAll}
                onOpenWithdraw={() => setCurrentTab('withdraw')}
                user={user}
                cpxConfig={cpxConfig}
              />
            )}

            {currentTab === 'admin' && user?.role === 'admin' && (
              <AdminView
                adminUser={user}
                cpxStatus={cpxStatus}
                onDataChanged={handleRefreshAll}
                onExitAdmin={() => setCurrentTab('surveys')}
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

      {/* Phone & WhatsApp Onboarding Modal */}
      <PhoneOnboardingModal
        isOpen={phoneModalOpen}
        user={user}
        onSave={handleSavePhone}
        onClose={() => {
          sessionStorage.setItem('phone_prompt_dismissed', 'true');
          setPhoneModalOpen(false);
        }}
      />
    </div>
  );
}
