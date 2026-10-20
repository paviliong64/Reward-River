import React, { useState } from 'react';
import { UsdtQuote } from '../types';
import {
  ArrowRight,
  ShieldCheck,
  Globe2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Lock,
  Cpu,
  Info
} from 'lucide-react';

interface LandingPageProps {
  usdtQuote: UsdtQuote | null;
  onGetStarted: () => void;
  onOpenLegal: (page: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ usdtQuote, onGetStarted, onOpenLegal }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How do I earn USDT on Reward River?',
      a: 'You participate in legitimate market research surveys on Reward River. When a research sponsor confirms your completed session, your Reward River balance is automatically credited. Once you reach the minimum balance ($25.00), you can request an on-chain USDT payout directly to your wallet.'
    },
    {
      q: 'Which USDT networks are supported for withdrawals?',
      a: 'We support both TRON (TRC-20) and Ethereum / EVM (ERC-20). TRC-20 is recommended for fastest confirmation and lowest transfer fees ($1.00 flat network fee).'
    },
    {
      q: 'Is USDT stable compared to volatile cryptocurrencies?',
      a: 'Yes. Tether USD (USDT) is pegged 1:1 to the US Dollar, meaning 1 USDT equals $1.00 USD. You do not suffer market price drops while accumulating or holding your survey rewards.'
    },
    {
      q: 'Why do survey rewards and eligibility vary?',
      a: 'Market research studies require specific demographics (such as location, professional experience, or product usage). If your profile does not match what a specific sponsor needs, you may be screened out early so your time is not wasted. Rewards vary depending on the length and complexity of the interview.'
    },
    {
      q: 'Do you ever ask for private keys or wallet seed phrases?',
      a: 'Never. You only enter your public USDT receiving address (starts with T for TRC-20 or 0x for ERC-20). We never request seed phrases, private keys, or wallet passwords.'
    }
  ];

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* Simple Top Banner */}
      <div className="bg-slate-900 text-slate-100 py-2.5 px-4 text-xs font-medium border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-bold">Reward River Surveys & USDT Rewards</span>
          </div>
          <div className="flex items-center gap-4 text-slate-300 text-xs">
            <span>Minimum payout: $25.00 USDT</span>
            <span className="text-emerald-400 font-semibold">TRC-20 & ERC-20 Settlement</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-12 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <Coins className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pure USDT Rewards • Reward River Surveys</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Turn Your Opinions Into{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-sky-600 bg-clip-text text-transparent">
              USDT Rewards
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed font-normal">
            Discover available surveys, share your opinions, and earn rewards when your participation is confirmed. Request withdrawals exclusively in Tether USD (USDT).
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              Start Earning Now
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-base transition-colors"
            >
              How It Works
            </a>
          </div>

          {/* Trust badges */}
          <div className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-medium text-slate-500 max-w-lg mx-auto">
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>No Volatility Risk (1:1 USD)</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>TRC-20 & ERC-20 Networks</span>
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Zero Seed Phrase Request</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Process Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            How Reward River Works
          </h2>
          <p className="mt-2 text-slate-600 text-sm sm:text-base">
            A clean, three-step journey from survey questionnaire to self-custodied USDT.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="relative bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm hover:border-sky-300 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 font-extrabold text-xl flex items-center justify-center mb-6">
              1
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Create your free account</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Register securely with your email. Your profile receives an opaque external identifier used for survey matching without exposing your email address to third parties.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm hover:border-sky-300 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-cyan-100 text-cyan-700 font-extrabold text-xl flex items-center justify-center mb-6">
              2
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Complete eligible surveys</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Browse available research surveys on Reward River. Answer questions honestly. When a research sponsor confirms your participation, your balance is updated immediately.
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm hover:border-sky-300 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 font-extrabold text-xl flex items-center justify-center mb-6">
              3
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Request USDT withdrawals</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Accumulate confirmed earnings and enter your USDT address. Choose TRC-20 for fast $1 fee payouts or ERC-20 for Ethereum custody.
            </p>
          </div>
        </div>
      </section>

      {/* How Surveys Work & Why Rewards Vary */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 rounded-3xl p-8 sm:p-12 text-white">
          <div className="max-w-3xl">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
              Transparency First
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 mb-4">
              Understanding Market Research & Reward Variations
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
              We believe in complete honesty about how online survey marketplaces work. Reward River connects you with verified market research sponsors worldwide.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-slate-800/80 rounded-xl p-5 border border-slate-700/60">
                <div className="flex items-center gap-2.5 text-sky-400 font-semibold text-sm mb-2">
                  <Globe2 className="w-4 h-4" />
                  <span>Demographic Eligibility</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Surveys are targeted by age, region, and lifestyle. If a researcher fills their quota or is studying a different demographic, you will be screened out early.
                </p>
              </div>

              <div className="bg-slate-800/80 rounded-xl p-5 border border-slate-700/60">
                <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-sm mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Quality Verification</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sponsors review response consistency and completion time. Automated responses or rushed answers are flagged by provider algorithms.
                </p>
              </div>

              <div className="bg-slate-800/80 rounded-xl p-5 border border-slate-700/60">
                <div className="flex items-center gap-2.5 text-teal-400 font-semibold text-sm mb-2">
                  <Cpu className="w-4 h-4" />
                  <span>Dollar-for-Dollar Value</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Since USDT is pegged 1:1 to USD, a survey offering $1.50 converts directly to 1.50 USDT with no exchange volatility.
                </p>
              </div>

              <div className="bg-slate-800/80 rounded-xl p-5 border border-slate-700/60">
                <div className="flex items-center gap-2.5 text-cyan-400 font-semibold text-sm mb-2">
                  <Lock className="w-4 h-4" />
                  <span>Server-to-Server Postbacks</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Credits occur through authenticated cryptographic webhooks. Your earnings cannot be manipulated by frontend redirects or browser extensions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Responsible Participation Guidelines Card */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-sky-50/60 border border-sky-100 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-sky-800 font-bold text-sm">
              <Info className="w-4 h-4 text-sky-600" />
              <span>Responsible Participation Guidelines</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Always provide honest, thoughtful feedback. Using VPNs, proxy networks, multiple accounts, or automated scripts violates Reward River participation policies and will lead to account termination and forfeiture of pending rewards.
            </p>
          </div>
          <button
            onClick={() => onOpenLegal('responsible-guidelines')}
            className="shrink-0 text-xs font-semibold text-sky-700 hover:text-sky-900 underline"
          >
            Read Full Guidelines
          </button>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="mt-1 text-slate-600 text-sm">
            Everything you need to know about surveys, accounting, and USDT payouts.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-semibold text-slate-900 text-sm sm:text-base focus:outline-none"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-sky-600 shrink-0 ml-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 p-8 sm:p-12 text-center text-white shadow-lg space-y-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Start Flowing Forward?
          </h2>
          <p className="text-emerald-100 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Create your free account, view currently active surveys, and begin accumulating real USDT rewards today.
          </p>
          <button
            onClick={onGetStarted}
            className="px-8 py-3.5 rounded-xl bg-white text-emerald-800 hover:bg-slate-50 font-bold text-base shadow-sm transition-all inline-flex items-center gap-2"
          >
            Create Your Free Account
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
};
