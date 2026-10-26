import React, { useState } from 'react';
import { Logo } from './Logo';
import { User, UserBalances, UsdtQuote } from '../types';
import { usdCentsToUsdt } from '../utils/usdt';
import {
  LayoutDashboard,
  ClipboardList,
  Coins,
  ArrowUpRight,
  Receipt,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X
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
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  balances,
  currentTab,
  onSelectTab,
  onOpenAuth,
  onSignOut
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const availableCents = balances?.availableCents ?? 0;
  const availablePoints = balances?.availablePoints ?? availableCents * 100;
  const pointsFormatted = availablePoints.toLocaleString('en-US');
  const usdtAmount = usdCentsToUsdt(availableCents).toFixed(2);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'surveys', label: 'Surveys', icon: ClipboardList },
    { id: 'earnings', label: 'Earnings', icon: Coins },
    { id: 'withdraw', label: 'Withdraw', icon: ArrowUpRight },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin', icon: ShieldCheck });
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
        }
      }, 120);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <button
            onClick={() => handleNavClick(user ? 'dashboard' : 'landing')}
            className="text-left focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-lg p-1"
            aria-label="Reward River Home"
          >
            <Logo size="md" showTagline={!user} />
          </button>

          {/* Desktop Navigation */}
          {user ? (
            <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sky-50 text-sky-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          ) : (
            <nav className="hidden md:flex items-center gap-6" aria-label="Public Navigation">
              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('rewards')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Rewards
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('faq')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                FAQ
              </button>
            </nav>
          )}

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Simple $ Balance Button */}
                <button
                  onClick={() => handleNavClick('withdraw')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 hover:border-emerald-300 hover:scale-[1.02] active:scale-[0.98] border border-slate-200 text-slate-700 hover:text-slate-900 text-xs transition-all duration-150 cursor-pointer"
                  title="Available balance — Click to withdraw"
                  aria-label={`Available balance $${usdtAmount}. Click to withdraw.`}
                >
                  <span className="font-bold text-emerald-700 font-mono">${usdtAmount}</span>
                  <span className="text-slate-500 font-medium">Balance</span>
                </button>

                {/* User Profile Pill */}
                <div className="flex items-center gap-2 pl-1">
                  <button
                    onClick={() => handleNavClick('settings')}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 text-slate-700"
                    title={user.email}
                    aria-label="User Settings"
                  >
                    <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs uppercase">
                      {user.displayName?.[0] || user.email[0]}
                    </div>
                    <span className="hidden lg:inline text-xs font-medium text-slate-800 max-w-[120px] truncate">
                      {user.displayName}
                    </span>
                  </button>

                  <button
                    onClick={onSignOut}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenAuth('signin')}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm transition-all"
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            {user && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && user && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2 animate-fadeIn">
          {/* Mobile Balance Display */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 mb-3">
            <span className="text-xs font-medium text-slate-600">Balance</span>
            <span className="text-sm font-bold text-emerald-700 font-mono">${usdtAmount}</span>
          </div>

          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onSignOut();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
