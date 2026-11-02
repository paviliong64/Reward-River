import React from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle,
  Scale,
  Coins,
  Ban,
  Users,
  FileCheck,
  Wallet
} from 'lucide-react';

interface TermsOfServiceProps {
  onContactClick?: () => void;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ onContactClick }) => {
  return (
    <article className="space-y-8 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
      {/* Zero Tolerance Callout Banner */}
      <div className="p-5 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold text-[#192F40] dark:text-white text-base sm:text-lg">
              Master Terms of Service &amp; Anti-Fraud Governance Agreement
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
              Binding User Agreement
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Effective Date: January 1, 2026 • Last Updated: November 2026 • Applies to All Members, Managers &amp; Visitors
          </p>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 pt-1 leading-relaxed">
            Reward River enforces a strict <strong>Zero-Tolerance Anti-Fraud Policy</strong>. The use of VPNs, proxies, Tor, residential IP maskers, automated scripts, emulators, or multiple accounts per household is strictly prohibited and results in immediate permanent account termination and forfeiture of balances.
          </p>
        </div>
      </div>

      {/* Section 1: Acceptance & Eligibility */}
      <section className="space-y-2.5">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#079B55] shrink-0" />
          <span>1. Acceptance of Agreement &amp; Member Eligibility</span>
        </h4>
        <p>
          By registering an account, accessing the Reward River website, or participating in any market research survey or platform activity, you enter into a legally binding contract with Reward River and its technical operator (<a href="https://www.injazify.com" target="_blank" rel="noopener noreferrer" className="text-[#079B55] font-bold hover:underline">injazify.com</a>).
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          <li><strong>Minimum Age Requirement:</strong> You must be at least <strong>18 years of age</strong> (or the legal age of majority in your jurisdiction) to create an account or request a withdrawal.</li>
          <li><strong>Single Account Rule:</strong> Each individual person and residential household is permitted to maintain strictly <strong>one (1) active Reward River account</strong>.</li>
          <li><strong>Accurate Registration Data:</strong> You agree to register with a valid, verifiable email address and accurate profile details.</li>
        </ul>
      </section>

      {/* Section 2: Points Valuation, Crediting & S2S Verification */}
      <section className="space-y-3">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <Coins className="w-4 h-4 text-[#079B55] shrink-0" />
          <span>2. Reward River Points Valuation, Crediting &amp; Reversals</span>
        </h4>
        <p>
          Participants earn internal platform credits designated as <strong>Reward River Points (&ldquo;Pts&rdquo;)</strong> upon verified completion of market research studies and platform tasks:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80">
            <div className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Member Redemption Rate</div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 font-mono">10,000 Pts = $1.00 USDT</div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              Every 10,000 Points accumulated in your available balance equals $1.00 USD in redeemable USDT value.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Minimum Withdrawal</div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 font-mono">250,000 Pts ($25.00)</div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              Withdrawal requests require a minimum available balance of 250,000 Points ($25.00 USDT) up to $500.00 USDT per request.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">S2S Callback Verification</div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 font-mono">HMAC MD5 Verified</div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              Points are credited exclusively upon receipt of an authenticated Server-to-Server (S2S) completion postback from the survey provider.
            </p>
          </div>
        </div>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-1">
          <li><strong>No Fiat Deposit Status:</strong> Points have no cash value outside the Reward River platform, do not accrue interest, cannot be transferred between users, and do not constitute bank deposits or financial securities.</li>
          <li><strong>Sponsor Reversals &amp; Chargebacks:</strong> If a market research partner (e.g., CPX Research) flags a completed survey as fraudulent, sped through, or quality-rejected and sends a reversal postback (<code className="font-mono">status=2</code> or <code className="font-mono">status=3</code>), the corresponding Points are automatically debited from your ledger balance.</li>
        </ul>
      </section>

      {/* Section 3: Prohibited Conduct & Anti-Fraud Rules */}
      <section className="space-y-3">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <Ban className="w-4 h-4 text-rose-500 shrink-0" />
          <span>3. Strictly Prohibited Conduct &amp; Anti-Fraud Safeguards</span>
        </h4>
        <p>
          To protect market research sponsors and preserve high survey payout rates for honest members, engaging in any of the following activities will result in immediate account termination:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
            <span className="font-bold text-xs text-rose-800 dark:text-rose-300 block mb-1">
              1. VPNs, Proxies, Tor &amp; Geolocation Spoofing
            </span>
            <p className="text-xs text-rose-900/80 dark:text-rose-300/80">
              Accessing Reward River or any survey wall through commercial VPNs, data-center IPs, residential proxies, Tor nodes, or remote desktop servers to falsify your country of residence is strictly forbidden.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
            <span className="font-bold text-xs text-rose-800 dark:text-rose-300 block mb-1">
              2. Multi-Accounting &amp; Identity Sharing
            </span>
            <p className="text-xs text-rose-900/80 dark:text-rose-300/80">
              Creating multiple accounts using aliases, disposable emails, or shared devices to complete the same survey campaign more than once will trigger automatic household IP/device suspension.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
            <span className="font-bold text-xs text-rose-800 dark:text-rose-300 block mb-1">
              3. Survey Speeding, Straight-Lining &amp; Gibberish
            </span>
            <p className="text-xs text-rose-900/80 dark:text-rose-300/80">
              Rushing through questionnaires significantly faster than the stated Length of Interview (LOI), selecting identical patterns (&ldquo;straight-lining&rdquo;), or entering random characters in open-ended prompts leads to partner chargebacks.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
            <span className="font-bold text-xs text-rose-800 dark:text-rose-300 block mb-1">
              4. Bots, Scripts &amp; Webhook Tampering
            </span>
            <p className="text-xs text-rose-900/80 dark:text-rose-300/80">
              Using browser automation, headless browsers, auto-clickers, or attempting to forge callback URLs or postback parameters is a criminal violation and results in permanent blacklisting.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: USDT Withdrawals & Blockchain Settlement */}
      <section className="space-y-2.5">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#079B55] shrink-0" />
          <span>4. Tether (USDT) Withdrawal Rules &amp; Blockchain Finality</span>
        </h4>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          <li><strong>Exclusive Settlement Asset:</strong> All redemptions are paid exclusively in Tether USD (USDT) via TRON (TRC-20, $1.00 network fee) or Ethereum (ERC-20, $2.50 network fee).</li>
          <li><strong>Wallet Address Accuracy:</strong> Blockchain transactions are irreversible. You are solely responsible for ensuring your destination wallet address and selected network (TRC-20 vs. ERC-20) are accurate. Reward River cannot recover funds sent to an incorrect address or incompatible network provided by the user.</li>
          <li><strong>Audit &amp; Compliance Review:</strong> All withdrawal requests undergo an automated ledger integrity check (verifying that your stored Points match the sum of confirmed S2S postbacks) before on-chain dispatch.</li>
        </ul>
      </section>

      {/* Section 5: Teams & Manager Portal Governance */}
      <section className="space-y-2.5">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-[#079B55] shrink-0" />
          <span>5. Teams &amp; Manager Portal Governance</span>
        </h4>
        <p className="text-xs sm:text-sm">
          Appointed Team Managers may create teams and invite members via unique Team Codes. Team points reflect verified member survey completions excluding manager personal surveys or administrative adjustments. Team Managers are independent community leaders and are strictly prohibited from requesting passwords, charging fees to members, or promising guaranteed payouts outside official platform rules.
        </p>
      </section>

      {/* Section 6: Account Suspension, Forfeiture & Limitation of Liability */}
      <section className="space-y-2.5">
        <h4 className="text-base font-extrabold text-[#192F40] dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          <span>6. Account Termination, Balance Forfeiture &amp; Limitation of Liability</span>
        </h4>
        <p className="text-xs sm:text-sm">
          Reward River reserves the right to suspend, restrict, or terminate any account that violates these Terms of Service or triggers verified fraud alerts from our research partners. Upon termination for fraud, proxy/VPN usage, or multi-accounting, <strong>all accumulated Points, reserved balances, and pending withdrawal requests are immediately and permanently forfeited</strong>.
        </p>
        <p className="text-xs sm:text-sm">
          The Platform and survey feeds are provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. Survey availability and demographic quotas are determined solely by third-party research sponsors. To the maximum extent permitted by law, Reward River and its operators shall not be liable for indirect, incidental, or consequential damages arising from third-party survey screen-outs, blockchain network congestion, or temporary maintenance windows.
        </p>
      </section>

      {/* Bottom Contact / Appeals Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
            <Scale className="w-4 h-4 text-[#079B55]" />
            <span>Compliance Inquiries &amp; Account Appeals</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Have a question regarding Terms of Service enforcement, survey reversals, or compliance audits? Reach out to our legal and support desk.
          </p>
        </div>
        {onContactClick && (
          <button
            type="button"
            onClick={onContactClick}
            className="px-4 py-2 text-xs font-extrabold text-white bg-[#079B55] hover:bg-[#047A43] rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
          >
            Contact Compliance Support
          </button>
        )}
      </div>
    </article>
  );
};
