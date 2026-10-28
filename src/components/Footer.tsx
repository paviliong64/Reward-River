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
    <footer id="footer" className="bg-[#192F40] text-slate-300 border-t border-[#192F40]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 pb-12 border-b border-slate-700/60">
          {/* Column 1: Brand & Description */}
          <div className="md:col-span-5 space-y-4">
            <Logo size="lg" inverted={true} showTagline={true} />
            <p className="text-xs text-slate-300/90 max-w-sm leading-relaxed">
              Reward River is the premier rewards platform empowering participants to turn everyday time, market surveys, and online activities into real redeemable value.
            </p>
            <div className="flex items-center gap-3 pt-2 text-xs text-[#4CC65A]">
              <span className="w-2 h-2 rounded-full bg-[#4CC65A] animate-pulse" />
              <span className="font-semibold">Live Rewards Platform Active</span>
            </div>
          </div>

          {/* Column 2: Navigation */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Navigation</h4>
            <ul className="space-y-2 text-xs text-slate-300">
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
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">Legal &amp; Policies</h4>
            <ul className="space-y-2 text-xs text-slate-300">
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
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
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

