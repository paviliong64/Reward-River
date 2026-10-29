import React from 'react';
import { Logo } from './Logo';

interface FooterProps {
  onOpenLegal: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenLegal }) => {
  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <footer id="footer" className="bg-[#192F40] text-slate-300 border-t border-slate-800/80 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 pb-5 border-b border-slate-700/50 items-start">
          {/* Column 1: Brand & Description */}
          <div className="md:col-span-6 space-y-2">
            <Logo size="md" inverted={true} showTagline={true} />
            <p className="text-xs text-slate-300/85 max-w-md leading-relaxed">
              Reward River empowers participants to turn everyday time, market surveys, and online activities into real redeemable value.
            </p>
          </div>

          {/* Column 2: Navigation */}
          <div className="md:col-span-3 space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white">Navigation</h4>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('hero')}
                  className="hover:text-[#4CC65A] transition-colors cursor-pointer"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('ways-to-earn')}
                  className="hover:text-[#4CC65A] transition-colors cursor-pointer"
                >
                  Earn Points
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollToSection('why-reward-river')}
                  className="hover:text-[#4CC65A] transition-colors cursor-pointer"
                >
                  About Reward River
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal & Support */}
          <div className="md:col-span-3 space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white">Legal &amp; Policies</h4>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal('privacy')}
                  className="hover:text-[#4CC65A] transition-colors cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal('terms')}
                  className="hover:text-[#4CC65A] transition-colors cursor-pointer"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal('responsible-guidelines')}
                  className="hover:text-[#4CC65A] transition-colors cursor-pointer"
                >
                  Community Guidelines
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenLegal('contact')}
                  className="hover:text-[#4CC65A] transition-colors cursor-pointer"
                >
                  Contact Support
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <div>© 2026 Reward River. All rights reserved.</div>
          <div className="flex items-center gap-1">
            <span>Powered &amp; Supported by</span>
            <a
              href="https://www.injazify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4CC65A] hover:underline font-bold"
            >
              www.injazify.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

