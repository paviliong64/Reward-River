import React, { useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  HelpCircle,
  Lock,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  BookOpen,
  Send,
  Zap,
  Mail,
  Building,
  Globe
} from 'lucide-react';

interface ArticleViewProps {
  page: string;
  onBack: () => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({ page, onBack }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const articleDetails: Record<
    string,
    { title: string; category: string; readTime: string; icon: React.ElementType }
  > = {
    'withdrawal-rules': {
      title: 'Tether (USDT) Withdrawal Rules & Settlement Policies',
      category: 'Payouts & Financial Rules',
      readTime: '4 min read',
      icon: RefreshCw
    },
    'responsible-guidelines': {
      title: 'Responsible Survey Participation Guidelines',
      category: 'Quality & Trust Standards',
      readTime: '5 min read',
      icon: HelpCircle
    },
    contact: {
      title: 'Support Center & Contact Portal',
      category: 'Customer Support',
      readTime: '3 min read',
      icon: Mail
    },
    terms: {
      title: 'Master Terms of Service & User Agreement',
      category: 'Legal & Governance',
      readTime: '6 min read',
      icon: FileText
    },
    privacy: {
      title: 'Privacy Policy & Data Security Protection',
      category: 'Privacy & Security',
      readTime: '4 min read',
      icon: Lock
    }
  };

  const current = articleDetails[page] || {
    title: 'Platform Article',
    category: 'Documentation',
    readTime: '3 min read',
    icon: BookOpen
  };

  const IconComponent = current.icon;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 animate-fade-in-up">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Main Page</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold border border-sky-200/80">
              {current.category}
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {current.readTime}
            </span>
          </div>
        </div>
      </div>

      {/* Main Blog Article Body */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <article className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-10 space-y-8">
          {/* Article Title & Header */}
          <div className="border-b border-slate-100 pb-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
                  Reward River Official Documentation
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                  {current.title}
                </h1>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-mono pt-1">
              Last updated &amp; verified: October 2026 • Official Platform Publication
            </p>
          </div>

          {/* ====================================================================
              ARTICLE 1: WITHDRAWAL RULES
             ==================================================================== */}
          {page === 'withdrawal-rules' && (
            <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200/80 text-sky-950 space-y-1">
                <div className="font-bold text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-sky-600" />
                  <span>Key Policy Summary</span>
                </div>
                <p className="text-xs text-sky-900">
                  Withdrawals on Reward River are settled exclusively in Tether USD (USDT) on TRON (TRC-20) or Ethereum (ERC-20). The minimum request threshold is <strong>$25.00 USDT (250,000 Points)</strong>.
                </p>
              </div>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">1. Why USDT is Our Single Settlement Asset</h2>
                <p>
                  Reward River operates a streamlined digital reward architecture. To ensure ultra-fast, boundaryless payouts without high international bank wire fees, chargeback delays, or geographic restrictions, all points accumulated from market research surveys and instant tasks convert directly into Tether USD (USDT).
                </p>
                <p>
                  USDT is a regulated 1:1 US Dollar-pegged stablecoin, ensuring that $1.00 of completed market research value always equals $1.00 in USDT on-chain.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">2. Blockchain Network Comparison (TRC-20 vs. ERC-20)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                    <div className="font-extrabold text-emerald-900 flex items-center justify-between">
                      <span>TRON Network (TRC-20)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white uppercase">Recommended</span>
                    </div>
                    <ul className="text-xs text-emerald-950 space-y-1 list-disc list-inside">
                      <li>Flat network fee: <strong>$1.00 USDT</strong></li>
                      <li>Average block confirmation: <strong>~3 Seconds</strong></li>
                      <li>Address format: Starts with letter <code className="font-mono font-bold">T...</code></li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-extrabold text-slate-900">Ethereum EVM Network (ERC-20)</div>
                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                      <li>Flat network fee: <strong>$2.50 USDT</strong></li>
                      <li>Average block confirmation: <strong>~12 Seconds</strong></li>
                      <li>Address format: Starts with <code className="font-mono font-bold">0x...</code></li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">3. Minimums, Maximums &amp; Atomic Balance Reservation</h2>
                <ul className="space-y-2 list-disc list-inside">
                  <li><strong>Minimum Threshold:</strong> $25.00 USDT (250,000 Points). Requests below $25.00 cannot be submitted.</li>
                  <li><strong>Maximum Request:</strong> $500.00 USDT (5,000,000 Points) per single withdrawal request.</li>
                  <li><strong>Atomic Holding:</strong> The moment you submit a payout request, your points are moved into <em>reserved status</em>. They remain reserved until our system dispatches the on-chain payout transaction hash (TxHash). If a request is rejected or canceled, reserved points immediately return to your available balance.</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">4. Step-by-Step Withdrawal Execution</h2>
                <ol className="space-y-2 list-decimal list-inside text-slate-700">
                  <li>Accumulate at least 250,000 Points ($25.00 USDT) through verified survey completions.</li>
                  <li>Copy your personal USDT wallet address from Binance, Trust Wallet, MetaMask, OKX, or KuCoin.</li>
                  <li>Select the exact network (TRC-20 or ERC-20) that matches your wallet address.</li>
                  <li>Enter your requested USDT amount and click <strong>Submit USDT Withdrawal Request</strong>.</li>
                  <li>Track live progress and view your transaction hash in your <strong>History &amp; Ledger</strong> tab.</li>
                </ol>
              </section>
            </div>
          )}

          {/* ====================================================================
              ARTICLE 2: RESPONSIBLE GUIDELINES
             ==================================================================== */}
          {page === 'responsible-guidelines' && (
            <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-950 space-y-1">
                <div className="font-bold text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>High Demographics Quality Policy</span>
                </div>
                <p className="text-xs text-emerald-900">
                  Market research sponsors pay for accurate, thoughtful human feedback. Adhering to these guidelines ensures you receive higher survey matching rates and zero account holds.
                </p>
              </div>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">1. How Research Matching Works</h2>
                <p>
                  Global market research panels evaluate consumer sentiments for new products, brands, and media. Each survey contains specific eligibility filters (such as age group, employment field, or household interests). Passing demographic screening questions honestly ensures you are routed to the highest-paying surveys available in your region.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">2. Four Gold Rules for Survey Respondents</h2>
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <h3 className="font-bold text-slate-900">Rule 1: Always Read Questions Fully</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Do not click randomly. Attention checks (e.g. &ldquo;Please select the third option to prove you are reading&rdquo;) are regularly embedded to screen out automated bots.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <h3 className="font-bold text-slate-900">Rule 2: Maintain Consistent Demographics</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Ensure your age, region, and industry profile remain consistent across survey sessions. Contradictory demographic profiles trigger automatic provider quality flags.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <h3 className="font-bold text-slate-900">Rule 3: Avoid Pacing &amp; Speeding Through Surveys</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Each survey has an estimated length of interview (LOI). Finishing a 15-minute survey in under 2 minutes triggers speeding algorithms that invalidate your participation reward.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <h3 className="font-bold text-slate-900">Rule 4: Strictly No VPNs, Proxies or Tor</h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Survey providers cross-reference IP geolocation with respondent locations. VPN or proxy connections automatically block survey inventory and risk permanent account bans.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">3. Understanding Survey Screen-Outs</h2>
                <p>
                  If you start a survey and receive a message saying &ldquo;Quota Full&rdquo; or &ldquo;Not a Match&rdquo;, this means the research sponsor has already collected sufficient responses for your specific demographic segment. Screen-outs are a normal part of online research. When this happens, Reward River immediately routes you to the next available survey in your feed.
                </p>
              </section>
            </div>
          )}

          {/* ====================================================================
              ARTICLE 3: SUPPORT & CONTACT
             ==================================================================== */}
          {page === 'contact' && (
            <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-950 space-y-1">
                <div className="font-bold text-base flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-600" />
                  <span>24/7 Dedicated Platform Desk</span>
                </div>
                <p className="text-xs text-indigo-900">
                  Our support team responds to all account inquiries, missing reward postbacks, and withdrawal tracking questions within 12 hours.
                </p>
              </div>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                    <Mail className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900">Official Support Email</h3>
                  <p className="text-xs text-slate-500">For account issues, survey postback logs, and technical questions:</p>
                  <a
                    href="mailto:support@rewardriver.com"
                    className="text-xs font-mono font-bold text-sky-600 hover:underline block"
                  >
                    support@rewardriver.com
                  </a>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900">Technical Support Partner</h3>
                  <p className="text-xs text-slate-500">Platform hosting, S2S infrastructure, and engineering support:</p>
                  <a
                    href="https://www.injazify.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono font-bold text-emerald-600 hover:underline inline-flex items-center gap-1"
                  >
                    <span>www.injazify.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">Frequently Requested Support Actions</h2>
                <div className="space-y-2">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="font-bold text-slate-900">Missing Survey Points Callback</div>
                    <p className="text-xs text-slate-600 mt-1">
                      Over 99% of completed surveys credit instantly via server-to-server (S2S) callbacks. If a survey completion does not show up within 10 minutes, please send us the Survey Offer ID and completion timestamp.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="font-bold text-slate-900">Tracking Your USDT Withdrawal</div>
                    <p className="text-xs text-slate-600 mt-1">
                      Once processed, your transaction hash (TxHash) will appear in your <strong>History</strong> tab. You can paste this hash into <a href="https://tronscan.org" target="_blank" rel="noreferrer" className="text-sky-600 underline">TRONSCAN</a> (TRC-20) or <a href="https://etherscan.io" target="_blank" rel="noreferrer" className="text-sky-600 underline">Etherscan</a> (ERC-20) to verify on-chain settlement.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ====================================================================
              ARTICLE 4: TERMS OF SERVICE
             ==================================================================== */}
          {page === 'terms' && (
            <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">1. Acceptance of Terms &amp; Agreement</h2>
                <p>
                  By creating an account, accessing the platform, or participating in market research activities on Reward River, you enter into a legally binding agreement governing your platform access, point accumulation, and digital USDT settlements.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">2. Independent Research Marketplace Governance</h2>
                <p>
                  Reward River acts as an independent white-label rewards aggregator connecting registered respondents to verified market research exchanges (including CPX Research and AoyTasks). Survey availability, criteria, and completion validation are determined dynamically by third-party research sponsors.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">3. Reward Points Nature &amp; Conversion</h2>
                <p>
                  Points credited to your account represent internal platform reward credits. Points do not constitute fiat money, bank deposits, or securities until a valid withdrawal request is processed at the official platform points conversion rate.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">4. Zero-Tolerance Fraud Policy</h2>
                <p>
                  Creating multiple accounts, using automated scripts, submitting false demographics, or employing IP masking proxies is strictly prohibited. Any account found violating fraud safeguards will be permanently banned with complete forfeiture of reserved balances.
                </p>
              </section>
            </div>
          )}

          {/* ====================================================================
              ARTICLE 5: PRIVACY POLICY
             ==================================================================== */}
          {page === 'privacy' && (
            <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">1. Minimal Information Collection</h2>
                <p>
                  We adhere to strict data minimization. We only collect the necessary credentials needed to maintain your account: your chosen username, email address, salted password hash (PBKDF2), optional WhatsApp number for onboarding, and public destination USDT wallet addresses.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">2. Opaque External Identifiers</h2>
                <p>
                  To protect your privacy with third-party survey networks, Reward River generates a unique cryptographic opaque identifier (e.g. <code className="font-mono text-slate-900 font-bold">rr_cpx_...</code>). Your real email address, full name, and password are <strong>never shared with survey providers</strong>.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">3. Non-Custodial Architecture</h2>
                <p>
                  Reward River does not store, request, or have access to your personal crypto private keys, wallet seed phrases, or exchange credentials. You retain 100% control of your destination wallet.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900">4. Account Deletion &amp; Data Purge Rights</h2>
                <p>
                  You have the right to request complete account deletion at any time. When an account is deleted, your credentials and associated ledger records are permanently purged from our primary database store.
                </p>
              </section>
            </div>
          )}

          {/* Article Footer & Back Action */}
          <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Reward River App</span>
            </button>

            <span className="text-xs text-slate-400 font-medium">
              © {new Date().getFullYear()} Reward River Documentation • Powered by injazify.com
            </span>
          </div>
        </article>
      </div>
    </div>
  );
};
