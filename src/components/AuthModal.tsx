import React, { useState, useEffect } from 'react';
import { User, UserBalances } from '../types';
import { Logo } from './Logo';
import {
  X,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  Sun,
  Moon
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'signin' | 'signup';
  onClose?: () => void;
  onSuccess: (token: string, user: User, balances?: UserBalances) => void;
  onOpenLegal?: (page: string) => void;
  standalone?: boolean;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onSuccess,
  standalone = false,
  theme = 'light',
  onToggleTheme
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  if (!isOpen && !standalone) return null;

  // Execute instant registration
  const executeInstantSignup = async (
    targetUsername: string,
    targetEmail: string,
    targetPassword: string
  ) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUsername.trim() || targetEmail.split('@')[0],
          displayName: targetUsername.trim() || targetEmail.split('@')[0],
          email: targetEmail.trim(),
          password: targetPassword
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Could not create account. Please try again.');
        setLoading(false);
        return;
      }

      onSuccess(data.token, data.user, data.balances);
      onClose?.();
    } catch {
      setError('Unable to reach authentication server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Execute sign in (Username OR Email + Password)
  const executeInstantSignin = async (identifierInput: string, passwordInput: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifierInput.trim(),
          email: identifierInput.trim(),
          password: passwordInput
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Login failed. Please check your credentials and try again.');
        setLoading(false);
        return;
      }

      onSuccess(data.token, data.user, data.balances);
      onClose?.();
    } catch {
      setError('Unable to reach authentication server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (!username.trim() && !email.trim()) {
        setError('Please enter your username and email address.');
        return;
      }
      if (password.length < 4) {
        setError('Password must be at least 4 characters.');
        return;
      }
      await executeInstantSignup(username, email, password);
    } else {
      const loginIdentifier = email.trim() || username.trim();
      if (!loginIdentifier || !password) {
        setError('Please enter your email or username and password.');
        return;
      }
      await executeInstantSignin(loginIdentifier, password);
    }
  };

  return (
    <div
      style={{
        backgroundImage: `url('/assets/aistudio/background__1__0c03fc67.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
      className={
        standalone
          ? 'min-h-screen w-full flex flex-col items-center justify-center p-4 text-slate-900 dark:text-slate-100 transition-colors relative'
          : 'fixed inset-0 z-50 flex flex-col items-center justify-center p-4 text-slate-900 dark:text-slate-100 animate-fadeIn overflow-y-auto transition-colors'
      }
    >
      {/* Soft Backdrop Overlay */}
      <div className="absolute inset-0 bg-slate-950/20 dark:bg-slate-950/50 backdrop-blur-[2px] pointer-events-none" />

      {/* Top-Right Theme Toggle & Optional Close Button */}
      <div className="fixed top-5 right-5 flex items-center gap-2 z-20">
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            data-testid="theme-toggle"
            aria-label="Toggle dark and light theme"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-[#D9EFE3] dark:border-slate-700 text-xs font-extrabold shadow-sm transition-all cursor-pointer backdrop-blur-sm"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-800" />
                <span>Dark</span>
              </>
            )}
          </button>
        )}

        {!standalone && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white dark:bg-slate-900/90 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-[#D9EFE3] dark:border-slate-700 text-xs font-bold shadow-sm transition-all cursor-pointer backdrop-blur-sm"
            aria-label="Close login page"
          >
            <span>Close</span>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Minimal Brand Header */}
      <div className="flex flex-col items-center mb-6 select-none relative z-10">
        <Logo size="lg" showTagline={true} />
      </div>

      {/* Centered Minimal Login Card */}
      <div className="w-full max-w-[400px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-[#D9EFE3] dark:border-slate-800 shadow-2xl p-6 sm:p-8 relative z-10">
        {/* Card Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-[#079B55]/10 dark:bg-[#079B55]/20 border border-[#079B55]/20 flex items-center justify-center text-[#079B55] dark:text-[#4CC65A] shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#192F40] dark:text-white leading-tight">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </h1>
            <p className="text-xs text-[#52697A] dark:text-slate-400 mt-0.5 font-medium">
              {mode === 'signin'
                ? 'Enter your credentials to access surveys'
                : 'Register an account to start earning points'}
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Minimal Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-username" className="block text-xs font-bold text-[#192F40] dark:text-slate-200 mb-1.5">
                Username
              </label>
              <input
                id="auth-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#F0FBF5]/80 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-[#D9EFE3] dark:border-slate-700 focus:border-[#079B55] focus:ring-3 focus:ring-[#079B55]/15 focus:outline-none text-[#192F40] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all font-medium"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-identifier" className="block text-xs font-bold text-[#192F40] dark:text-slate-200 mb-1.5">
              {mode === 'signin' ? 'Email or Username' : 'Email'}
            </label>
            <input
              id="auth-identifier"
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === 'signin' ? 'Email or username' : 'you@example.com'}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[#F0FBF5]/80 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-[#D9EFE3] dark:border-slate-700 focus:border-[#079B55] focus:ring-3 focus:ring-[#079B55]/15 focus:outline-none text-[#192F40] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all font-medium"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-bold text-[#192F40] dark:text-slate-200 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={4}
                className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl bg-[#F0FBF5]/80 dark:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-[#D9EFE3] dark:border-slate-700 focus:border-[#079B55] focus:ring-3 focus:ring-[#079B55]/15 focus:outline-none text-[#192F40] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-[#079B55] hover:bg-[#047A43] active:scale-95 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
              </>
            )}
          </button>
        </form>

        {/* Minimal Mode Switch Footer */}
        <div className="mt-6 pt-4 border-t border-[#D9EFE3] dark:border-slate-800 text-center">
          <p className="text-xs text-[#52697A] dark:text-slate-400 font-medium">
            {mode === 'signin' ? (
              <>
                New user?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('signup');
                  }}
                  className="font-bold text-[#079B55] dark:text-[#4CC65A] hover:underline cursor-pointer"
                >
                  Create Account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('signin');
                  }}
                  className="font-bold text-[#079B55] dark:text-[#4CC65A] hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
