import React, { useState, useEffect } from 'react';
import { X, FileText, Globe, ExternalLink, ShieldCheck, Scale, Coins, AlertCircle } from 'lucide-react';
import { PrivacyPolicy } from './PrivacyPolicy';
import { TermsOfService } from './TermsOfService';

interface LegalModalProps {
  page: string | null;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ page, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>(page || 'terms');

  useEffect(() => {
    if (page) {
      setActiveTab(page);
    }
  }, [page]);

  if (!page) return null;

  const titles: Record<string, string> = {
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    'withdrawal-rules': 'Tether (USDT) Withdrawal Rules',
    'responsible-guidelines': 'Survey Quality & Participation',
    contact: 'Compliance & Support'
  };

  const tabs = [
    { id: 'privacy', label: 'Privacy Policy', icon: ShieldCheck },
    { id: 'terms', label: 'Terms of Service', icon: Scale },
    { id: 'withdrawal-rules', label: 'Withdrawal Rules', icon: Coins },
    { id: 'responsible-guidelines', label: 'Guidelines', icon: AlertCircle },
    { id: 'contact', label: 'Contact', icon: Globe }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#079B55]/10 dark:bg-[#079B55]/20 flex items-center justify-center text-[#079B55] dark:text-[#4CC65A]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#192F40] dark:text-white leading-tight">
                {titles[activeTab] || 'Platform Documentation'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Reward River Official Legal & Research Compliance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 overflow-x-auto scrollbar-none shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#079B55] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 sm:p-7 overflow-y-auto leading-relaxed space-y-5">
          {activeTab === 'privacy' && (
            <PrivacyPolicy onContactClick={() => setActiveTab('contact')} />
          )}

          {activeTab === 'terms' && (
            <TermsOfService onContactClick={() => setActiveTab('contact')} />
          )}

          {activeTab === 'withdrawal-rules' && (
            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <h3 className="text-sm font-bold text-[#192F40] dark:text-white">1. USDT-Only Payout Policy</h3>
              <p>
                Tether USD (USDT) is the exclusive payout asset supported on Reward River. Every 10,000 Points in your available balance equals $1.00 USDT.
              </p>

              <h3 className="text-sm font-bold text-slate-900 dark:text-white">2. Supported USDT Blockchain Networks</h3>
              <p>
                Payouts are dispatched on either the TRON network (TRC-20, addresses starting with &quot;T&quot;, $1.00 flat fee) or Ethereum/EVM network (ERC-20, addresses starting with &quot;0x&quot;, $2.50 flat fee). Users are strictly responsible for verifying network compatibility before submission.
              </p>

              <h3 className="text-sm font-bold text-slate-900 dark:text-white">3. Minimums &amp; Transfer Fees</h3>
              <p>
                The minimum withdrawal request is $25.00 USDT (250,000 Points at 10,000 Points = $1.00 USD). On-chain transfer fees ($1.00 for TRC-20 or $2.50 for ERC-20) are subtracted from the gross amount to determine the net payout sent to your crypto wallet.
              </p>

              <h3 className="text-sm font-bold text-slate-900 dark:text-white">4. Verification &amp; Settlement</h3>
              <p>
                To maintain fraud protection for research sponsors, withdrawal requests are audited against confirmed server-to-server callback ledgers. Settled payouts display the corresponding immutable on-chain transaction hash (TxHash).
              </p>
            </div>
          )}

          {activeTab === 'responsible-guidelines' && (
            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <h3 className="text-sm font-bold text-[#192F40] dark:text-white">Community &amp; Respondent Quality Standards</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Read Questions Thoroughly:</strong> Speeding through questionnaires or failing embedded attention checks triggers automated quality rejections and sponsor reversals.</li>
                <li><strong>Maintain Consistent Demographics:</strong> Providing honest, consistent demographic answers ensures ongoing access to high-paying corporate studies.</li>
                <li><strong>Zero VPN / Proxy Policy:</strong> Research exchanges automatically block traffic originating from VPNs, proxies, Tor, or data-center IP addresses.</li>
                <li><strong>Ethical Team Conduct:</strong> Team enrollment is 100% free and voluntary. Team Managers and members must never share passwords, private keys, or survey answer scripts.</li>
              </ul>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <h3 className="text-sm font-bold text-[#192F40] dark:text-white">24/7 Member Support &amp; Compliance Desk</h3>
              <p>
                Reward River operates in strict compliance with international market research standards. For account assistance, missing S2S survey callback audits, or USDT withdrawal tracking:
              </p>
              <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 space-y-3 mt-2">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white text-xs">Official Support Email:</div>
                  <div className="font-mono text-xs text-[#079B55] font-bold">support@rewardriver.online</div>
                </div>
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-xs pt-1">
                  <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Corporate &amp; Technical Operations Portal:</span>
                </div>
                <a
                  href="https://www.injazify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#079B55] hover:bg-[#047A43] text-white font-bold text-xs rounded-xl transition-all shadow-xs"
                >
                  <span>www.injazify.com</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Protected by cryptographic postbacks & zero-PII protocols
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#192F40] hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close Document
          </button>
        </div>
      </div>
    </div>
  );
};
