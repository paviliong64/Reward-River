import React from 'react';
import { Logo } from './Logo';

interface FooterProps {
  onOpenLegal: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenLegal }) => {
  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand & Clean Tagline */}
          <div className="flex items-center gap-3">
            <Logo size="sm" inverted={true} showTagline={false} />
            <span className="hidden sm:inline text-slate-700">|</span>
            <span className="text-xs text-slate-400 font-medium tracking-wide">
              Real Opinions. Real Value.
            </span>
          </div>

          {/* Minimal Inline Navigation */}
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400 font-medium">
            <button
              type="button"
              onClick={() => onOpenLegal('withdrawal-rules')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Withdrawal Rules
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('responsible-guidelines')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Guidelines
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('contact')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Support
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('terms')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Terms
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Privacy
            </button>
          </nav>
        </div>

        {/* Bottom Minimal Copyright */}
        <div className="mt-6 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} Reward River. All rights reserved.
          </div>
          <div>
            Made &amp; Supported by{' '}
            <a
              href="https://www.injazify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 font-medium hover:underline transition-colors"
            >
              www.injazify.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
