import React from 'react';
import {
  ShieldCheck,
  Lock,
  EyeOff,
  Database,
  Server,
  UserCheck,
  HelpCircle,
  Users,
  FileCheck2,
  Globe
} from 'lucide-react';

interface PrivacyPolicyProps {
  onContactClick?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onContactClick }) => {
  return (
    <article className="space-y-8 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
      {/* Executive Summary Banner */}
      <div className="p-5 rounded-2xl bg-[#079B55]/10 dark:bg-[#079B55]/20 border border-[#079B55]/25 flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-[#079B55] text-white flex items-center justify-center shrink-0 shadow-xs">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold text-[#192F40] dark:text-white text-base sm:text-lg">
              Global Privacy Policy &amp; Data Protection Charter
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold uppercase tracking-wider">
              GDPR &amp; CCPA Compliant
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Effective Date: January 1, 2026 • Last Reviewed &amp; Verified: November 2026 • Version 4.2
          </p>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 pt-1 leading-relaxed">
            Reward River (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is engineered on a strict{' '}
            <strong>Zero-PII External Disclosure</strong> architecture. Your personal email address, full legal name, password hash, and private contact details are never sold, rented, or transmitted in survey launch URLs to third-party market research sponsors.
          </p>
        </div>
      </div>

      {/* Section 1: Zero-PII Opaque Identifier Architecture */}
      <section className="space-y-3">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-[#079B55] shrink-0" />
          <span>1. Pseudonymous External User Identifiers (Zero-PII Survey Routing)</span>
        </h4>
        <p>
          When you participate in consumer market research studies on Reward River (powered by verified partners such as CPX Research), our server generates and transmits a strictly pseudonymous, cryptographically random opaque identifier (for example, your non-reversible account UUID or an opaque token prefixed with <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs text-emerald-700 dark:text-emerald-400">rr_cpx_...</code>).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="font-bold text-xs text-slate-900 dark:text-white mb-1">No Email in URLs</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Your registration email address is never appended to external survey links, iframe parameters, or third-party tracking pixels.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="font-bold text-xs text-slate-900 dark:text-white mb-1">No Real Name or Phone Exposure</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Research exchanges only receive your pseudonymous UUID to validate survey completions and dispatch server-to-server (S2S) reward callbacks.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="font-bold text-xs text-slate-900 dark:text-white mb-1">HMAC / MD5 Signed Links</div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Every survey session is signed server-side using a private cryptographic secret key so your session cannot be spoofed or intercepted.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Information We Collect and Process */}
      <section className="space-y-3">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-[#079B55] shrink-0" />
          <span>2. Categories of Personal &amp; Technical Data We Collect</span>
        </h4>
        <p>
          In accordance with the GDPR principle of data minimization, Reward River collects only the specific data elements required to authenticate your account, maintain your double-entry Points ledger, prevent automated fraud, and settle USDT payouts:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
              A. Account Identity &amp; Authentication Data
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Your display name, email address, optional WhatsApp/phone number for account recovery, and a salted PBKDF2-SHA512 password digest. Plaintext passwords are never stored or visible to any administrator.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
              B. Non-Custodial Payout Wallet Data
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Public destination Tether USD (USDT) wallet addresses on TRON (TRC-20) or Ethereum (ERC-20) submitted by you for withdrawal settlement. We never ask for private keys, seed phrases, or wallet passwords.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
              C. Network &amp; Anti-Fraud Telemetry
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Connection IP address, derived ISO country code, browser User-Agent string, and Cloudflare Turnstile bot-verification tokens used strictly to match regional survey inventory and block VPN/proxy abuse.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
              D. Double-Entry Financial &amp; Survey Ledger
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Immutable transaction records including provider transaction IDs, survey offer IDs, Points credited or reversed, timestamps (Asia/Karachi PKT &amp; UTC), and on-chain blockchain transaction hashes (TxHash).
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Team Membership & Manager Visibility */}
      <section className="space-y-3">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-[#079B55] shrink-0" />
          <span>3. Team Membership &amp; Manager Portal Data Scoping</span>
        </h4>
        <p>
          If you voluntarily join a Team using a Team Invite Code or referral link, you grant explicit consent for the designated Team Manager to view scoped performance metrics necessary for team coaching and leaderboard tracking:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          <li>
            <strong>What Team Managers Can See:</strong> Your display name, email address, date joined, completed survey count, and total Points earned while a member of their team.
          </li>
          <li>
            <strong>What Team Managers Can NEVER See:</strong> Team Managers cannot view your password hash, private security tokens, IP logs, or personal USDT wallet addresses, and cannot initiate withdrawals or modify your account balance.
          </li>
        </ul>
      </section>

      {/* Section 4: Third-Party Research Partners & Infrastructure */}
      <section className="space-y-3">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-[#079B55] shrink-0" />
          <span>4. Third-Party Market Research &amp; Cloud Infrastructure Partners</span>
        </h4>
        <p>
          Reward River integrates with industry-standard infrastructure and research providers under strict data-processing agreements:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600 dark:text-slate-400">
          <li>
            <strong>CPX Research (Make Opinion GmbH, Berlin, Germany):</strong> Provides live market research questionnaires and demographic matching. Any demographic answers (such as age bracket, household income, or consumer preferences) you provide inside the CPX Research survey interface are governed by CPX Research&rsquo;s GDPR-compliant respondent privacy notice.
          </li>
          <li>
            <strong>Supabase Cloud PostgreSQL Database:</strong> Hosts our encrypted relational database, authentication records, and real-time ledger synchronization with Row-Level Security (RLS) and TLS 1.3 encryption in transit and AES-256 encryption at rest.
          </li>
          <li>
            <strong>Public Blockchain Networks (TRON &amp; Ethereum):</strong> Completed USDT payouts are broadcast to public blockchain ledgers where transaction hashes (TxHash), token amounts, and wallet addresses are permanently verifiable on-chain.
          </li>
        </ul>
      </section>

      {/* Section 5: Cookies, LocalStorage & Session Security */}
      <section className="space-y-2">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#079B55] shrink-0" />
          <span>5. Cookies, Browser Storage &amp; Session Security</span>
        </h4>
        <p className="text-xs sm:text-sm">
          We use strictly necessary first-party browser storage (<code className="font-mono text-xs">localStorage</code> and <code className="font-mono text-xs">sessionStorage</code>) to store your encrypted session token (<code className="font-mono text-xs">rr_auth_token</code>), UI theme preference (light/dark mode), and CAPTCHA verification state. When an Administrator uses the &ldquo;View as User&rdquo; support diagnostic tool, the session is strictly read-only, time-limited to 15 minutes, visibly bannered, and recorded in our immutable System Audit Log.
        </p>
      </section>

      {/* Section 6: Data Retention & Your Legal Rights */}
      <section className="space-y-3">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#079B55] shrink-0" />
          <span>6. Data Retention &amp; Your Legal Rights (GDPR, UK-GDPR &amp; CCPA)</span>
        </h4>
        <p className="text-xs sm:text-sm">
          Regardless of your country of residence, Reward River extends full data subject rights to all registered members:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <strong className="text-slate-900 dark:text-white block mb-0.5">Right of Access &amp; Portability</strong>
            You may view your complete survey completion history, point credits, and withdrawal records in real time or request a full machine-readable export.
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <strong className="text-slate-900 dark:text-white block mb-0.5">Right to Erasure (&ldquo;Right to be Forgotten&rdquo;)</strong>
            You may request permanent deletion of your account and personal identifiers at any time via Support, subject only to statutory anti-fraud audit retention.
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <strong className="text-slate-900 dark:text-white block mb-0.5">Right to Rectification</strong>
            You may update your display name, contact phone/WhatsApp number, and security credentials directly inside your Account Settings.
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <strong className="text-slate-900 dark:text-white block mb-0.5">Age Restriction (18+ Only)</strong>
            Reward River does not knowingly collect or process data from individuals under 18 years of age.
          </div>
        </div>
      </section>

      {/* Contact / DPO Footer Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
            <FileCheck2 className="w-4 h-4 text-[#079B55]" />
            <span>Data Protection Officer (DPO) &amp; Privacy Inquiries</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            For data export requests, account erasure, or privacy compliance questions, contact <strong className="text-slate-800 dark:text-slate-200">support@rewardriver.online</strong> or open our Support Desk.
          </p>
        </div>
        {onContactClick && (
          <button
            type="button"
            onClick={onContactClick}
            className="px-4 py-2 text-xs font-extrabold text-white bg-[#079B55] hover:bg-[#047A43] rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
          >
            Contact Privacy &amp; Support
          </button>
        )}
      </div>
    </article>
  );
};
