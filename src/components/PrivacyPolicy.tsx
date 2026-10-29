import React from 'react';
import { ShieldCheck, Lock, EyeOff, Database, Server, UserCheck, HelpCircle } from 'lucide-react';

interface PrivacyPolicyProps {
  onContactClick?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onContactClick }) => {
  return (
    <article className="space-y-6 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
      {/* Intro Hero Banner */}
      <div className="p-4 rounded-2xl bg-[#079B55]/10 dark:bg-[#079B55]/20 border border-[#079B55]/20 flex items-start gap-3.5">
        <ShieldCheck className="w-6 h-6 text-[#079B55] dark:text-[#4CC65A] shrink-0 mt-0.5" />
        <div>
          <h3 className="font-extrabold text-[#192F40] dark:text-white text-base">
            Privacy & Research Partner Compliance Policy
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Last Updated: October 2026 • Effective Worldwide • GDPR & CCPA Compliant
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Reward River operates under a strict <strong>Zero-PII Disclosure</strong> architecture. Your personal email, real name, and contact details are never sold, rented, or exposed to third-party market research sponsors or survey offerwalls.
          </p>
        </div>
      </div>

      {/* Section 1 */}
      <section className="space-y-2">
        <h4 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-[#079B55]" />
          <span>1. Pseudonymous External User Identifier (No PII in Survey Links)</span>
        </h4>
        <p>
          When you participate in market research studies or view offerwalls (such as CPX Research or Aoyco), Reward River generates and transmits a strictly pseudonymous, randomly hashed opaque identifier (e.g. your Supabase UUID <code>50ef23d0-7b16...</code> or an encrypted session token).
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <li><strong>No Email Address:</strong> Your email is NEVER appended to survey links, redirect URLs, or iframe source tags.</li>
          <li><strong>No Phone Numbers or Real Names:</strong> Third-party survey networks only receive the opaque string required to verify completions and disburse rewards back via server-to-server cryptographic postbacks.</li>
          <li><strong>HMAC MD5 Security Hash:</strong> Every survey launch URL includes a secure HMAC MD5 cryptographic hash to prevent man-in-the-middle tampering.</li>
        </ul>
      </section>

      {/* Section 2 */}
      <section className="space-y-2">
        <h4 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-[#079B55]" />
          <span>2. Information We Collect and Process</span>
        </h4>
        <p>
          We only collect the absolute minimum technical and account information necessary to maintain your balance, authenticate your sessions, and process USDT payouts:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block mb-1">
              Account Credentials
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Your registration email and salted PBKDF2 password hash. Plaintext passwords are never stored or accessible by our administrators.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block mb-1">
              Cryptographic Wallet Addresses
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Public destination USDT addresses (TRON TRC-20 or Ethereum ERC-20) submitted for automated payouts. We never request private keys or seed phrases.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block mb-1">
              Fraud Detection Telemetry
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              IP address, browser User-Agent, and geolocation country code. Used exclusively to match regional survey quotas and detect illicit VPN/Proxy spoofing.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block mb-1">
              Cryptographic Ledger History
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Immutable records of completed surveys, transaction IDs, points credited, and blockchain settlement TxIDs stored in Supabase PostgreSQL.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3 */}
      <section className="space-y-2">
        <h4 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-[#079B55]" />
          <span>3. Third-Party Research & Offerwall Partners</span>
        </h4>
        <p>
          Reward River partners with globally certified market research exchanges and advertising networks:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <li><strong>CPX Research (Make Opinion GmbH, Germany):</strong> Facilitates verified research questionnaires. When you enter a survey, demographic questions you answer within their portal are governed by CPX Research’s privacy policies.</li>
          <li><strong>Aoyco / AoyTasks:</strong> Provides sponsored tasks and advertising offers under secure tokenized sub-identifiers.</li>
          <li><strong>Blockchain Settlement Networks:</strong> TRON (TRC-20) and Ethereum (ERC-20) public ledgers record completed USDT transaction hashes for public verifiability.</li>
        </ul>
      </section>

      {/* Section 4 */}
      <section className="space-y-2">
        <h4 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#079B55]" />
          <span>4. Cookies & Session Storage</span>
        </h4>
        <p className="text-xs">
          We use strictly necessary browser <code>localStorage</code> and session tokens (JWT) to keep you securely signed in and maintain real-time points synchronization across tabs. We do not deploy intrusive third-party cross-site tracking beacons.
        </p>
      </section>

      {/* Section 5 */}
      <section className="space-y-2">
        <h4 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#079B55]" />
          <span>5. Your Legal Rights (GDPR & CCPA)</span>
        </h4>
        <p className="text-xs">
          You have the absolute legal right to:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <li>Request a complete export of your ledger history, profile, and payout records.</li>
          <li>Request instantaneous and permanent erasure of your user profile and database records from Supabase.</li>
          <li>Opt out of optional profiling questions at any time.</li>
        </ul>
      </section>

      {/* Contact Card */}
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <HelpCircle className="w-4 h-4 text-[#079B55]" />
          <span>Have privacy inquiries or data removal requests?</span>
        </div>
        {onContactClick && (
          <button
            type="button"
            onClick={onContactClick}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#079B55] hover:bg-[#047A43] rounded-lg transition-colors cursor-pointer"
          >
            Contact Legal & Privacy
          </button>
        )}
      </div>
    </article>
  );
};
