import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle, Scale, Coins, Ban } from 'lucide-react';

interface TermsOfServiceProps {
  onContactClick?: () => void;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ onContactClick }) => {
  return (
    <article className="space-y-6 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
      {/* Zero Tolerance Callout Banner */}
      <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-start gap-3.5">
        <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-extrabold text-[#192F40] dark:text-white text-base">
            Zero-Tolerance Anti-Fraud & VPN / Proxy Policy
          </h3>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
            Reward River enforces strict zero-tolerance rules for fraudulent traffic. The use of <strong>VPNs, proxies, Tor, emulator devices, automated clickers, or multiple accounts</strong> is strictly prohibited. Violators face immediate permanent termination and total forfeiture of all balances.
          </p>
        </div>
      </div>

      {/* Section 1 */}
      <section className="space-y-2">
        <h4 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#079B55]" />
          <span>1. Acceptance & Member Eligibility</span>
        </h4>
        <p>
          By creating an account, browsing Reward River, or engaging with our research partners, you certify that you are at least 18 years of age (or have reached the age of majority in your jurisdiction) and agree to be bound unconditionally by these Terms of Service.
        </p>
      </section>

      {/* Section 2 */}
      <section className="space-y-2">
        <h4 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
          <Ban className="w-4 h-4 text-rose-500" />
          <span>2. Prohibited Conduct & Fraudulent Activities</span>
        </h4>
        <p>
          To protect research data integrity and maintain advertiser trust, the following actions will trigger an automated security freeze and immediate ban:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
            <span className="font-bold text-xs text-rose-800 dark:text-rose-300 block mb-1">
              VPNs & Proxies Prohibited
            </span>
            <p className="text-xs text-rose-900/80 dark:text-rose-300/80">
              Accessing surveys through commercial VPNs, residential proxies, Tor exit nodes, or Apple Private Relay is strictly prohibited and instantly flagged by CPX Research security filters.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
            <span className="font-bold text-xs text-rose-800 dark:text-rose-300 block mb-1">
              One Account Per Individual
            </span>
            <p className="text-xs text-rose-900/80 dark:text-rose-300/80">
              Users are restricted to exactly one active account per individual, household, and IP subnet. Registering multiple accounts to claim repetitive signup bonuses or duplicate tasks results in a permanent network ban.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
            <span className="font-bold text-xs text-rose-800 dark:text-rose-300 block mb-1">
              Speeding & Incoherent Responses
            </span>
            <p className="text-xs text-rose-900/80 dark:text-rose-300/80">
              Rushing through surveys in a fraction of the estimated length of interview (LOI), failing attention check questions, or providing gibberish text answers leads to sponsor chargebacks and account disqualification.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
            <span className="font-bold text-xs text-rose-800 dark:text-rose-300 block mb-1">
              Bots & Automation Tools
            </span>
            <p className="text-xs text-rose-900/80 dark:text-rose-300/80">
              Any attempt to simulate mouse clicks, automate questionnaire submissions, or tamper with postback webhook signatures constitutes criminal fraud and will be reported to regulatory bodies.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3 */}
      <section className="space-y-2">
        <h4 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
          <Coins className="w-4 h-4 text-[#079B55]" />
          <span>3. Points Valuation, Crediting & USDT Payouts</span>
        </h4>
        <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          <li><strong>Official Currency Ratio:</strong> 5,000 Points = $1.00 USD value (matching our CPX Research currency factor).</li>
          <li><strong>Cryptographic S2S Postbacks:</strong> Points are only credited once an authenticated server-to-server callback confirms valid completion. Merely opening or previewing a survey will not award points.</li>
          <li><strong>Reversals & Chargebacks:</strong> If a survey sponsor identifies fraudulent or low-quality responses after crediting, the corresponding points and USD earnings will be debited (status 2 reversal).</li>
          <li><strong>Withdrawal Thresholds:</strong> Minimum withdrawal is $25.00 USDT (125,000 Points). Maximum single withdrawal is $500.00 USDT.</li>
          <li><strong>Blockchain Network Fees:</strong> On-chain transfer fees ($1.00 USDT for TRC-20, $2.50 USDT for ERC-20) are automatically subtracted by the smart-settlement engine to determine net wallet receipts.</li>
        </ul>
      </section>

      {/* Section 4 */}
      <section className="space-y-2">
        <h4 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <span>4. Forfeiture of Balance & Account Termination</span>
        </h4>
        <p className="text-xs">
          Reward River reserves the unilateral right to freeze, suspend, or permanently terminate any account found in violation of these Terms. Upon termination for fraud, proxy abuse, or multi-accounting, <strong>all pending points, reserved balances, and pending withdrawal requests are immediately and irreversibly forfeited</strong>.
        </p>
      </section>

      {/* Section 5 */}
      <section className="space-y-2">
        <h4 className="text-base font-bold text-[#192F40] dark:text-white flex items-center gap-2">
          <Scale className="w-4 h-4 text-[#079B55]" />
          <span>5. Disclaimers & Limitation of Liability</span>
        </h4>
        <p className="text-xs">
          Reward River does not guarantee that surveys will be continuously available for every demographic profile or geographical region. Survey criteria and qualification questions are controlled exclusively by third-party research sponsors. In no event shall Reward River or its operators be liable for indirect, incidental, or consequential damages resulting from platform downtime or blockchain network congestion.
        </p>
      </section>

      {/* Bottom Contact / Inquiries */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <span>Questions regarding terms enforcement or account appeals?</span>
        {onContactClick && (
          <button
            type="button"
            onClick={onContactClick}
            className="text-[#079B55] dark:text-[#4CC65A] font-bold hover:underline cursor-pointer"
          >
            Contact Compliance Support
          </button>
        )}
      </div>
    </article>
  );
};
