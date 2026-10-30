import React, { useState } from 'react';
import { Logo } from './Logo';
import { User, UserBalances, UsdtQuote } from '../types';
import {
  Search,
  ClipboardList,
  Coins,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Gift,
  Zap,
  Wallet
} from 'lucide-react';

interface NavbarProps {
  user: User | null;
  balances: UserBalances | null;
  usdtQuote: UsdtQuote | null;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onSignOut: () => void;
  onOpenLegal: (page: string) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  balances,
  currentTab,
  onSelectTab,
  onOpenAuth,
  onSignOut,
  theme = 'light',
  onToggleTheme
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pointsDeltaBadge, setPointsDeltaBadge] = useState<number | null>(null);
  const prevPointsRef = React.useRef<number | null>(null);

  const availableCents = balances?.availableCents ?? 0;
  const availablePoints = balances?.availablePoints ?? availableCents * 100;
  const pointsFormatted = availablePoints.toLocaleString('en-US');
  const availableUsdFormatted = (availablePoints / 10000).toFixed(2); // 10,000 Points = $1.00 USD

  // Trigger navbar balance pulse animation whenever user's points increase
  React.useEffect(() => {
    if (balances == null) return;
    if (prevPointsRef.current !== null && availablePoints > prevPointsRef.current) {
      const gained = availablePoints - prevPointsRef.current;
      setPointsDeltaBadge(gained);
      const timer = setTimeout(() => setPointsDeltaBadge(null), 4500);
      prevPointsRef.current = availablePoints;
      return () => clearTimeout(timer);
    }
    prevPointsRef.current = availablePoints;
  }, [availablePoints, balances]);

  const navItems: { id: string; label: string; icon: typeof ShieldCheck }[] = [];

  if (user?.role === 'manager' || user?.role === 'admin') {
    navItems.push({ id: 'manager', label: 'Manager Portal', icon: ClipboardList });
  }
  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin Portal', icon: ShieldCheck });
  }

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    setMobileMenuOpen(false);
  };

  const scrollToSection = (sectionId: string) => {
    if (currentTab !== 'landing') {
      onSelectTab('landing');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    setMobileMenuOpen(false);
  };

  const searchSuggestions: { title: string; type: string; points: string }[] = [];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-[#D9EFE3] dark:border-slate-800 shadow-sm transition-colors">
        <div className="w-full max-w-[1800px] mx-auto px-3 sm:px-5 lg:px-6 xl:px-8">
          <div className="flex items-center justify-between gap-3 h-20 sm:h-[84px]">
            {/* Left side: Reward River logo with tagline - fitted cleanly into header box area */}
            <div className="flex items-center shrink-0">
              <button
                onClick={() => scrollToSection('hero')}
                className="text-left focus:outline-none rounded-2xl py-1 pr-2 transition-transform hover:scale-[1.01] cursor-pointer"
                aria-label="Reward River Home"
              >
                <Logo size="xl" showTagline={true} />
              </button>
            </div>

            {/* Center navigation (Single-line, zero wrapping) */}
            <nav className="hidden md:flex items-center gap-3 lg:gap-4 xl:gap-6 shrink-0" aria-label="Header Navigation">
              <button
                type="button"
                onClick={() => scrollToSection('hero')}
                className="text-xs lg:text-sm font-bold text-[#192F40] dark:text-slate-200 hover:text-[#079B55] dark:hover:text-[#4CC65A] transition-colors cursor-pointer whitespace-nowrap px-1.5 py-1"
              >
                Home
              </button>
              {!user && (
                <button
                  type="button"
                  onClick={() => scrollToSection('ways-to-earn')}
                  className="text-xs lg:text-sm font-bold text-[#192F40] dark:text-slate-200 hover:text-[#079B55] dark:hover:text-[#4CC65A] transition-colors cursor-pointer whitespace-nowrap px-1.5 py-1"
                >
                  Earn Points
                </button>
              )}
              <button
                type="button"
                onClick={() => scrollToSection('why-reward-river')}
                className="text-xs lg:text-sm font-bold text-[#192F40] dark:text-slate-200 hover:text-[#079B55] dark:hover:text-[#4CC65A] transition-colors cursor-pointer whitespace-nowrap px-1.5 py-1"
              >
                {user ? (
                  <span>About <span className="hidden 2xl:inline">Reward River</span></span>
                ) : (
                  <span>About Reward River</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('footer')}
                className="text-xs lg:text-sm font-bold text-[#192F40] dark:text-slate-200 hover:text-[#079B55] dark:hover:text-[#4CC65A] transition-colors cursor-pointer whitespace-nowrap px-1.5 py-1"
              >
                Contact
              </button>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`inline-flex items-center gap-1.5 px-1.5 py-1 text-xs lg:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'text-[#079B55] dark:text-[#4CC65A]'
                        : 'text-[#192F40] dark:text-slate-200 hover:text-[#079B55] dark:hover:text-[#4CC65A]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right side: Actions, Theme Toggle, Login & Sign Up */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Theme Toggle Button (Desktop & Tablet) */}
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  data-testid="theme-toggle"
                  aria-label="Toggle dark and light theme"
                  title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                  className="hidden sm:flex p-2 rounded-xl text-[#52697A] dark:text-slate-300 hover:text-[#079B55] hover:bg-[#F0FBF5] dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
                </button>
              )}

              {user ? (
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => handleNavClick('withdraw')}
                      title="Click to open Withdraw page (10,000 Pts = $1.00 USD)"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-[11px] sm:text-xs font-extrabold transition-all duration-300 cursor-pointer shrink-0 whitespace-nowrap ${
                        pointsDeltaBadge
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/40 scale-105 ring-4 ring-emerald-400/30'
                          : 'bg-[#F0FBF5] dark:bg-slate-800 border-[#D9EFE3] dark:border-slate-700 text-[#079B55] dark:text-[#4CC65A] hover:border-[#079B55]'
                      }`}
                    >
                      <Coins className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${pointsDeltaBadge ? 'text-amber-200 animate-bounce' : 'text-[#079B55] dark:text-[#4CC65A]'}`} />
                      <span>{pointsFormatted} Pts</span>
                      <span className={pointsDeltaBadge ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}>•</span>
                      <span className={pointsDeltaBadge ? 'text-white' : 'text-slate-900 dark:text-white'}>${availableUsdFormatted}</span>
                    </button>

                    {pointsDeltaBadge && (
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black shadow-lg whitespace-nowrap animate-bounce pointer-events-none z-50">
                        +{pointsDeltaBadge.toLocaleString('en-US')} Pts Added!
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleNavClick('withdraw')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-[#079B55] hover:bg-[#058246] text-white text-[11px] sm:text-xs font-extrabold shadow-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <Wallet className="w-3.5 h-3.5 shrink-0" />
                    <span>Withdraw</span>
                  </button>

                  <button
                    onClick={() => handleNavClick('surveys')}
                    className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#192F40] dark:text-white text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#079B55] text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {user.displayName?.[0] || user.email[0]}
                    </div>
                    <span className="hidden xl:inline max-w-[110px] truncate">{user.displayName}</span>
                  </button>

                  <button
                    onClick={onSignOut}
                    className="hidden sm:flex p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                  {/* Login button */}
                  <button
                    type="button"
                    onClick={() => onOpenAuth('signin')}
                    className="px-2 py-1 sm:px-5 sm:py-2.5 text-xs font-extrabold text-[#079B55] dark:text-[#4CC65A] border border-[#079B55] sm:border-2 dark:border-[#4CC65A] hover:bg-[#F0FBF5] dark:hover:bg-slate-800 rounded-lg sm:rounded-xl transition-all duration-200 cursor-pointer shrink-0"
                  >
                    Login
                  </button>

                  {/* Sign Up button */}
                  <button
                    type="button"
                    onClick={() => onOpenAuth('signup')}
                    className="px-2.5 py-1 sm:px-6 sm:py-2.5 text-xs font-extrabold text-white bg-[#079B55] hover:bg-[#047A43] rounded-lg sm:rounded-xl shadow-xs sm:shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 cursor-pointer shrink-0"
                  >
                    Sign Up
                  </button>
                </div>
              )}

              {/* Mobile Menu Hamburger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 rounded-xl text-[#192F40] dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#D9EFE3] dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-3 pb-6 space-y-3 animate-fadeIn">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => scrollToSection('hero')}
                className="w-full text-left px-3 py-2 text-sm font-bold text-[#192F40] dark:text-slate-200 hover:bg-[#F0FBF5] dark:hover:bg-slate-800 rounded-lg"
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => (user ? handleNavClick('surveys') : scrollToSection('ways-to-earn'))}
                className="w-full text-left px-3 py-2 text-sm font-bold text-[#192F40] dark:text-slate-200 hover:bg-[#F0FBF5] dark:hover:bg-slate-800 rounded-lg"
              >
                Earn Points (Surveys)
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => handleNavClick('withdraw')}
                  className="w-full text-left px-3 py-2 text-sm font-extrabold text-[#079B55] dark:text-emerald-400 bg-[#F0FBF5] dark:bg-emerald-950/30 rounded-lg flex items-center justify-between"
                >
                  <span>Withdraw Funds ($25 Min)</span>
                  <span>${availableUsdFormatted}</span>
                </button>
              )}
              {(user?.role === 'manager' || user?.role === 'admin') && (
                <button
                  type="button"
                  onClick={() => handleNavClick('manager')}
                  className="w-full text-left px-3 py-2 text-sm font-bold text-[#192F40] dark:text-slate-200 hover:bg-[#F0FBF5] dark:hover:bg-slate-800 rounded-lg"
                >
                  Manager Portal
                </button>
              )}
              {user?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => handleNavClick('admin')}
                  className="w-full text-left px-3 py-2 text-sm font-bold text-[#192F40] dark:text-slate-200 hover:bg-[#F0FBF5] dark:hover:bg-slate-800 rounded-lg"
                >
                  Admin Portal
                </button>
              )}
              <button
                type="button"
                onClick={() => scrollToSection('why-reward-river')}
                className="w-full text-left px-3 py-2 text-sm font-bold text-[#192F40] dark:text-slate-200 hover:bg-[#F0FBF5] dark:hover:bg-slate-800 rounded-lg"
              >
                About Reward River
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('footer')}
                className="w-full text-left px-3 py-2 text-sm font-bold text-[#192F40] dark:text-slate-200 hover:bg-[#F0FBF5] dark:hover:bg-slate-800 rounded-lg"
              >
                Contact
              </button>

              {onToggleTheme && (
                <div className="pt-2 border-t border-[#D9EFE3] dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleTheme();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-[#192F40] dark:text-slate-200 hover:bg-[#F0FBF5] dark:hover:bg-slate-800 rounded-lg"
                  >
                    <span>Appearance</span>
                    <div className="flex items-center gap-1.5 text-xs text-[#079B55]">
                      {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                      <span className="capitalize">{theme} Theme</span>
                    </div>
                  </button>
                </div>
              )}

              {user ? (
                <div className="pt-2 border-t border-[#D9EFE3] dark:border-slate-800 space-y-2">
                  <div className="px-3 py-2 text-xs font-bold text-[#52697A] dark:text-slate-400 flex items-center justify-between">
                    <span>Signed in as <strong className="text-[#192F40] dark:text-white">{user.displayName}</strong></span>
                    <span className="text-[#079B55] font-extrabold">{pointsFormatted} Pts (${availableUsdFormatted})</span>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="pt-3 border-t border-[#D9EFE3] dark:border-slate-800 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth('signin');
                    }}
                    className="py-3 text-xs font-bold text-[#079B55] border-2 border-[#079B55] rounded-xl text-center"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAuth('signup');
                    }}
                    className="py-3 text-xs font-bold text-white bg-[#079B55] rounded-xl text-center shadow-sm"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Quick Search Overlay Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#D9EFE3] dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-4 relative">
            <button
              onClick={() => setSearchOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              title="Close search"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 bg-[#F0FBF5] dark:bg-slate-800 rounded-xl p-3.5 border border-[#D9EFE3] dark:border-slate-700">
              <Search className="w-5 h-5 text-[#079B55] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search surveys, tasks, or gift card rewards..."
                className="w-full bg-transparent text-sm font-medium text-[#192F40] dark:text-white placeholder:text-[#52697A] focus:outline-none"
                autoFocus
              />
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <div className="text-[11px] font-bold text-[#52697A] dark:text-slate-400 uppercase tracking-wider">
                Search Results ({searchSuggestions.length})
              </div>
              {searchSuggestions.length > 0 ? (
                searchSuggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSearchOpen(false);
                      onOpenAuth('signup');
                    }}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-[#F0FBF5] dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#079B55]/10 text-[#079B55] flex items-center justify-center font-bold">
                        {item.type === 'Reward' ? <Gift className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#192F40] dark:text-white">{item.title}</div>
                        <div className="text-[10px] text-[#52697A] dark:text-slate-400">{item.type}</div>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-[#079B55]">{item.points}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 text-center py-6">No matching rewards or tasks found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

