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
                onClick={() => handleNavClick('landing')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                How It Works
              </button>
              <button
                onClick={() => handleNavClick('landing')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Rewards
              </button>
              <button
                onClick={() => handleNavClick('landing')}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                FAQ
              </button>
            </nav>
          )}

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Balance & USDT Quick-Withdraw Button */}
                <button
                  onClick={() => handleNavClick('withdraw')}
                  className="group flex items-center gap-2.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-full bg-gradient-to-r from-emerald-50 via-teal-50/70 to-white hover:from-emerald-100/70 hover:to-teal-50 border border-emerald-200 hover:border-emerald-400 shadow-xs hover:shadow-md hover:shadow-emerald-500/15 transition-all duration-200 active:scale-95 text-left"
                  title="Your Available USDT Balance — Click to Withdraw"
                  aria-label={`Available balance ${usdtAmount} USDT. Click to withdraw.`}
                >
                  <div className="relative flex items-center justify-center shrink-0">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-xs ring-2 ring-emerald-100 group-hover:ring-emerald-300 transition-all">
                      ₮
                    </div>
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white animate-pulse" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-baseline gap-1 leading-tight">
                      <span className="text-xs font-extrabold text-slate-900 tracking-tight font-mono">
                        {usdtAmount}
                      </span>
                      <span className="text-[10px] font-black text-emerald-600 font-sans tracking-wide">
                        USDT
                      </span>
                    </div>
                    <div className="text-[10px] font-medium text-slate-500 group-hover:text-emerald-700 transition-colors flex items-center gap-1 leading-none mt-0.5">
                      <span className="text-slate-400 font-mono">${(availableCents / 100).toFixed(2)}</span>
                      <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-100/70 px-1 py-0.2 rounded">Withdraw</span>
                    </div>
                  </div>
                  <div className="hidden xs:flex w-5 h-5 rounded-full bg-white/90 group-hover:bg-emerald-600 border border-emerald-100 group-hover:border-emerald-600 items-center justify-center text-emerald-600 group-hover:text-white transition-all shrink-0 ml-0.5 shadow-2xs">
                    <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </button>

                {/* User Profile Pill */}
                <div className="flex items-center gap-2 pl-1">
                  <button
                    onClick={() => handleNavClick('settings')}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-700"
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
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                ₮
              </div>
              <span className="text-xs font-medium text-slate-600">Available Balance</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-slate-900">${(availableCents / 100).toFixed(2)}</span>
              <span className="text-xs text-emerald-700 ml-1.5 font-mono">({usdtAmount} USDT)</span>
            </div>
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
