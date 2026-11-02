import React, { useState, useEffect } from 'react';
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
  Globe,
  Scale,
  Users,
  MessageSquare,
  Award,
  Ban,
  Coins,
  Copy,
  Check
} from 'lucide-react';
import { PrivacyPolicy } from './PrivacyPolicy';
import { TermsOfService } from './TermsOfService';

interface ArticleViewProps {
  page: string;
  onBack: () => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({ page, onBack }) => {
  const [activePage, setActivePage] = useState<string>(page || 'privacy');
  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportCategory, setSupportCategory] = useState('missing_points');
  const [supportRefId, setSupportRefId] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState<{ ticketId: string; timestamp: string } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    if (page) {
      setActivePage(page);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  const handleSelectPage = (nextPage: string) => {
    setActivePage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopySupportEmail = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('support@rewardriver.online');
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  };

  const handleSubmitSupportTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportEmail.trim() || !supportMessage.trim()) return;
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    setTicketSubmitted({
      ticketId: `RR-SUP-${randomNum}`,
      timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })
    });
  };

  const articleDetails: Record<
    string,
    { title: string; subtitle: string; category: string; readTime: string; icon: React.ElementType }
  > = {
    privacy: {
      title: 'Privacy Policy & Data Protection Charter',
      subtitle: 'Zero-PII Survey Routing, Cryptographic Security, GDPR/CCPA Rights & Data Governance',
      category: 'Privacy & Security',
      readTime: '6 min read',
      icon: Lock
    },
    terms: {
      title: 'Master Terms of Service & User Agreement',
      subtitle: 'Platform Eligibility, Points Valuation (10,000 Pts = $1.00), Anti-Fraud Rules & USDT Settlement',
      category: 'Legal & Governance',
      readTime: '7 min read',
      icon: Scale
    },
    'responsible-guidelines': {
      title: 'Community & Survey Quality Guidelines',
      subtitle: 'Official Standards for High Survey Matching, Respondent Integrity, Team Conduct & Zero Account Holds',
      category: 'Quality & Community Standards',
      readTime: '5 min read',
      icon: ShieldCheck
    },
    contact: {
      title: 'Official Support Center & Compliance Helpdesk',
      subtitle: '24/7 Member Assistance, S2S Postback Audit Requests, USDT Payout Tracking & Direct Inquiry Portal',
      category: 'Customer Support',
      readTime: '4 min read',
      icon: Mail
    },
    'withdrawal-rules': {
      title: 'Tether (USDT) Withdrawal Rules & Settlement Policy',
      subtitle: 'TRC-20 & ERC-20 Network Specifications, $25.00 Minimum Threshold & Atomic Balance Reservation',
      category: 'Payouts & Financial Rules',
      readTime: '4 min read',
      icon: RefreshCw
    }
  };

  const current = articleDetails[activePage] || {
    title: 'Official Platform Policy & Documentation',
    subtitle: 'Verified Legal, Compliance, and Operational Standards for Reward River Members',
    category: 'Documentation',
    readTime: '5 min read',
    icon: BookOpen
  };

  const navTabs = [
    { id: 'privacy', label: 'Privacy Policy', icon: Lock },
    { id: 'terms', label: 'Terms of Service', icon: Scale },
    { id: 'responsible-guidelines', label: 'Community Guidelines', icon: ShieldCheck },
    { id: 'contact', label: 'Contact Support', icon: Mail },
    { id: 'withdrawal-rules', label: 'Withdrawal Rules', icon: Coins }
  ];

  const IconComponent = current.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-800 dark:text-slate-100 pb-16 animate-fade-in-up transition-colors">
      {/* Top Sticky Sub-Header Bar with Policy Switcher */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-20 z-30 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Platform</span>
            </button>

            <span className="sm:hidden px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200/80 dark:border-emerald-800">
              {current.category}
            </span>
          </div>

          {/* Interactive Legal & Policies Navigation Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {navTabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectPage(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#079B55] text-white shadow-xs'
                      : 'bg-slate-100/80 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Legal & Documentation Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-6 sm:p-10 space-y-8">
          {/* Document Header */}
          <div className="border-b border-slate-100 dark:border-slate-800 pb-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#079B55]/10 dark:bg-[#079B55]/20 text-[#079B55] dark:text-[#4CC65A] flex items-center justify-center shrink-0">
                  <IconComponent className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#079B55] dark:text-[#4CC65A]">
                      Reward River Legal &amp; Compliance Center
                    </span>
                    <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <Clock className="w-3 h-3" />
                      {current.readTime}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#192F40] dark:text-white tracking-tight leading-snug mt-0.5">
                    {current.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {current.subtitle}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================================
              PAGE 1: PRIVACY POLICY
             ==================================================================== */}
          {activePage === 'privacy' && (
            <PrivacyPolicy onContactClick={() => handleSelectPage('contact')} />
          )}

          {/* ====================================================================
              PAGE 2: TERMS OF SERVICE
             ==================================================================== */}
          {activePage === 'terms' && (
            <TermsOfService onContactClick={() => handleSelectPage('contact')} />
          )}

          {/* ====================================================================
              PAGE 3: COMMUNITY GUIDELINES (responsible-guidelines)
             ==================================================================== */}
          {activePage === 'responsible-guidelines' && (
            <div className="space-y-8 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {/* Banner */}
              <div className="p-5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/25 flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-[#079B55] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-[#192F40] dark:text-white text-base sm:text-lg">
                    Reward River Community &amp; Survey Quality Guidelines
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Official Respondent Quality Standard • Applies to Surveys, Teams &amp; Community Interactions
                  </p>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 pt-1">
                    Fortune 500 brands, academic institutions, and market research agencies rely on Reward River respondents for genuine human insights. Following these community standards maximizes your survey qualification rate, unlocks higher-paying studies, and protects your account from sponsor reversals.
                  </p>
                </div>
              </div>

              {/* Section 1: The 6 Core Pillars of Respondent Quality */}
              <section className="space-y-3">
                <h2 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#079B55]" />
                  <span>1. Six Gold Standards for Survey Respondents</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center justify-between">
                      <span>1. Read Every Question Carefully</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">Critical</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Market research studies embed quality-control attention checks (e.g., &ldquo;Select &lsquo;Strongly Agree&rsquo; for this row to confirm you are reading&rdquo;). Failing attention checks results in immediate screen-out.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center justify-between">
                      <span>2. Maintain Consistent Demographics</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">Profile Trust</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Always provide your real age, gender, household size, employment industry, and postal region. Contradictory answers across different surveys lower your CPX Research respondent quality score.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center justify-between">
                      <span>3. Respect Survey Pacing (No Speeding)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">Anti-Speeding</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Each survey displays an estimated Length of Interview (LOI), such as ~10 Minutes. Completing a 10-minute study in 90 seconds triggers automated anti-speeding filters and sponsor chargebacks.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center justify-between">
                      <span>4. Provide Thoughtful Open-Ended Answers</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold">Human Review</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      When asked to type your opinion in a text box, write 1–2 clear, relevant sentences in your own words. Never paste AI-generated text, random keyboard mashes (&ldquo;asdfgh&rdquo;), or single-word replies.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center justify-between">
                      <span>5. Genuine Residential Internet Connection</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold">Zero VPN</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Always disable VPNs, proxy extensions, iCloud Private Relay, or ad-blocking DNS filters before launching a survey so that sponsor redirects and S2S completion callbacks register cleanly.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center justify-between">
                      <span>6. Complete Surveys in a Single Session</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold">Best Practice</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Avoid leaving a survey tab idle for long periods, as research sessions expire after 15–20 minutes of inactivity. Wait until you are redirected back to the confirmation screen before closing the tab.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 2: Team & Manager Community Ethics */}
              <section className="space-y-3">
                <h2 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#079B55]" />
                  <span>2. Team Participation &amp; Manager Code of Conduct</span>
                </h2>
                <p>
                  Reward River supports collaborative earning through official Teams led by verified Team Managers. All Team Managers and Team Members must uphold the following ethical standards:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <li><strong>Voluntary Enrollment &amp; Transparency:</strong> Joining a team via a Team Code is 100% free and voluntary. Team Managers may never charge registration fees or demand a share of a member&rsquo;s personal USDT withdrawals.</li>
                  <li><strong>No Coaching to Cheat or Spoof:</strong> Team Managers and members must never share VPN configurations, fake demographic scripts, or survey answer keys. Teams found coordinating fraudulent survey submissions will be dissolved.</li>
                  <li><strong>Strict Credential Privacy:</strong> Neither Team Managers nor Support staff will ever ask for your account password or wallet private keys.</li>
                </ul>
              </section>

              {/* Section 3: Understanding Screen-Outs & Quota Full Notices */}
              <section className="space-y-2.5">
                <h2 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#079B55]" />
                  <span>3. Understanding Survey Screen-Outs &amp; Demographic Quotas</span>
                </h2>
                <p className="text-xs sm:text-sm">
                  Every market research study targets a specific consumer profile (for example, &ldquo;smartphone owners aged 25–44 who purchase streaming subscriptions&rdquo;). If you are redirected early with a <em>&ldquo;Quota Full&rdquo;</em> or <em>&ldquo;Screen-Out&rdquo;</em> message, it simply means the sponsor has either filled your demographic bracket or is looking for a different household profile. Screen-outs do not penalize your account—simply refresh your survey feed to start the next matched study.
                </p>
              </section>
            </div>
          )}

          {/* ====================================================================
              PAGE 4: CONTACT SUPPORT (contact)
             ==================================================================== */}
          {activePage === 'contact' && (
            <div className="space-y-8 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {/* Support Hero Banner */}
              <div className="p-5 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 border border-sky-500/25 flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold text-[#192F40] dark:text-white text-base sm:text-lg">
                      24/7 Member Support &amp; Compliance Operations Desk
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold uppercase tracking-wider">
                      Avg. Response &lt; 6 Hours
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 pt-0.5">
                    Our dedicated support engineers handle account verification, missing survey S2S callback audits, Team Manager applications, and USDT withdrawal tracking 7 days a week.
                  </p>
                </div>
              </div>

              {/* Direct Contact Channels Grid */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Member Support Desk</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      For missing survey Points, account recovery, and USDT withdrawal status inquiries:
                    </p>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                    <a
                      href="mailto:support@rewardriver.online"
                      className="text-xs font-mono font-extrabold text-sky-600 dark:text-sky-400 hover:underline break-all"
                    >
                      support@rewardriver.online
                    </a>
                    <button
                      type="button"
                      onClick={handleCopySupportEmail}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedEmail ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Legal, Privacy &amp; Compliance</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      For GDPR/CCPA data requests, account appeals, and Team Manager compliance:
                    </p>
                  </div>
                  <div className="pt-2">
                    <a
                      href="mailto:support@rewardriver.online"
                      className="text-xs font-mono font-extrabold text-amber-600 dark:text-amber-400 hover:underline block"
                    >
                      support@rewardriver.online
                    </a>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Technical &amp; Corporate Partner</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Platform engineering, enterprise S2S infrastructure, and partnership operations:
                    </p>
                  </div>
                  <div className="pt-2">
                    <a
                      href="https://www.injazify.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>www.injazify.com</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </section>

              {/* Interactive Direct Support Ticket Form + SLA Guide */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#079B55]" />
                    <h3 className="text-base font-extrabold text-[#192F40] dark:text-white">
                      Submit a Direct Support Ticket
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Fill out the form below to generate an official support reference ticket. Including your Survey Offer ID or Withdrawal ID helps our team audit your ledger immediately.
                  </p>

                  {ticketSubmitted ? (
                    <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>Support Ticket Registered ({ticketSubmitted.ticketId})</span>
                      </div>
                      <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90">
                        We have logged your inquiry for <strong>{supportEmail}</strong> at {ticketSubmitted.timestamp} PKT. Our support specialists will review your account ledger and respond via email within 6–12 hours.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setTicketSubmitted(null);
                          setSupportMessage('');
                          setSupportRefId('');
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        Submit Another Inquiry
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitSupportTicket} className="space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Your Display Name
                          </label>
                          <input
                            type="text"
                            required
                            value={supportName}
                            onChange={(e) => setSupportName(e.target.value)}
                            placeholder="e.g. Ali Khan"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#079B55]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Account Email Address
                          </label>
                          <input
                            type="email"
                            required
                            value={supportEmail}
                            onChange={(e) => setSupportEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#079B55]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Inquiry Category
                          </label>
                          <select
                            value={supportCategory}
                            onChange={(e) => setSupportCategory(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#079B55]"
                          >
                            <option value="missing_points">Missing Survey Points / S2S Callback</option>
                            <option value="withdrawal">USDT Withdrawal Status / TxHash</option>
                            <option value="teams_manager">Teams &amp; Manager Portal Inquiry</option>
                            <option value="account_security">Account Verification &amp; Security</option>
                            <option value="privacy_legal">Privacy / GDPR Data Request</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Survey ID / Transaction ID (Optional)
                          </label>
                          <input
                            type="text"
                            value={supportRefId}
                            onChange={(e) => setSupportRefId(e.target.value)}
                            placeholder="e.g. RR #37699 or WTH-..."
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#079B55]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Detailed Description
                        </label>
                        <textarea
                          rows={4}
                          required
                          value={supportMessage}
                          onChange={(e) => setSupportMessage(e.target.value)}
                          placeholder="Please describe your question, completion timestamp, or withdrawal details..."
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#079B55]"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#079B55] hover:bg-[#047A43] text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Official Support Ticket</span>
                      </button>
                    </form>
                  )}
                </div>

                {/* Fast Resolution Checklist */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                      How We Resolve Common Inquiries
                    </h4>
                    <div className="space-y-3 text-xs">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="font-bold text-slate-900 dark:text-white">1. Missing Survey Points</div>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">
                          Over 99% of CPX Research completions credit automatically within seconds via S2S postback. If delayed, provide the Survey Offer ID and our admins will verify the transaction ID directly against the CPX Publisher API.
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="font-bold text-slate-900 dark:text-white">2. USDT Withdrawal Tracking</div>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">
                          Once your withdrawal ($25.00 Min = 250,000 Pts) is approved and dispatched, your on-chain TxHash appears in your Withdrawals tab for instant verification on TRONSCAN or Etherscan.
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                        <div className="font-bold text-slate-900 dark:text-white">3. Team &amp; Manager Support</div>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">
                          Want to apply as a Team Manager or need assistance with your Team Invite Code? Select <em>Teams &amp; Manager Portal Inquiry</em> for priority onboarding.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ====================================================================
              PAGE 5: WITHDRAWAL RULES (withdrawal-rules)
             ==================================================================== */}
          {activePage === 'withdrawal-rules' && (
            <div className="space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <div className="p-5 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 border border-sky-500/25 space-y-1.5">
                <div className="font-extrabold text-base text-[#192F40] dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  <span>Official USDT Settlement &amp; Conversion Policy</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                  Withdrawals on Reward River are settled exclusively in <strong>Tether USD (USDT)</strong> on TRON (TRC-20) or Ethereum (ERC-20). The conversion rate is <strong>10,000 Points = $1.00 USDT</strong>, and the minimum withdrawal threshold is <strong>$25.00 USDT (250,000 Points)</strong>.
                </p>
              </div>

              <section className="space-y-3">
                <h2 className="text-base font-extrabold text-[#192F40] dark:text-white">
                  1. Supported Blockchain Networks (TRC-20 vs. ERC-20)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
                  <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                    <div className="font-extrabold text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
                      <span>TRON Network (TRC-20)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white uppercase">Recommended</span>
                    </div>
                    <ul className="text-xs text-emerald-950 dark:text-emerald-200 space-y-1 list-disc list-inside">
                      <li>Flat network fee: <strong>$1.00 USDT</strong></li>
                      <li>Average block finality: <strong>~3 Seconds</strong></li>
                      <li>Address format: Starts with capital <code className="font-mono font-bold">T...</code> (34 characters)</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="font-extrabold text-slate-900 dark:text-white">Ethereum EVM Network (ERC-20)</div>
                    <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                      <li>Flat network fee: <strong>$2.50 USDT</strong></li>
                      <li>Average block finality: <strong>~12 Seconds</strong></li>
                      <li>Address format: Starts with <code className="font-mono font-bold">0x...</code> (42 characters)</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-extrabold text-[#192F40] dark:text-white">
                  2. Minimums, Maximums &amp; Atomic Balance Reservation
                </h2>
                <ul className="space-y-2 list-disc list-inside text-xs sm:text-sm">
                  <li><strong>Minimum Threshold:</strong> $25.00 USDT (250,000 Points). Requests below 250,000 Points cannot be submitted.</li>
                  <li><strong>Maximum Single Request:</strong> $500.00 USDT (5,000,000 Points) per withdrawal transaction.</li>
                  <li><strong>Atomic Balance Reservation:</strong> When you submit a withdrawal request, the corresponding Points are immediately reserved from your available balance until on-chain settlement is completed and a public TxHash is recorded. If a request is rejected or cancelled, reserved Points automatically return to your available balance.</li>
                </ul>
              </section>
            </div>
          )}

          {/* Document Footer */}
          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#192F40] hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-extrabold transition-all cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Reward River</span>
            </button>

            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              © {new Date().getFullYear()} Reward River Legal &amp; Compliance • Powered &amp; Supported by injazify.com
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
