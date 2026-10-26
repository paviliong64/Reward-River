import React, { useState } from 'react';
import { UsdtQuote } from '../types';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Wallet,
  Zap
} from 'lucide-react';

interface LandingPageProps {
  usdtQuote: UsdtQuote | null;
  onGetStarted: () => void;
  onOpenLegal: (page: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How do I earn USDT on Reward River?',
      a: 'You complete market research surveys and instant tasks. Once confirmed, points are credited to your account and can be withdrawn directly as USDT to your wallet.'
    },
    {
      q: 'What is the points to USDT conversion rate?',
      a: '10,000 Points equals $0.40 USDT. Your earnings are always transparently shown in both Points and USDT.'
    },
    {
      q: 'Which crypto networks are supported for payout?',
      a: 'We support TRON (TRC-20) for low flat transfer fees ($1.00 USDT) as well as Ethereum (ERC-20).'
    },
    {
      q: 'Do I need identity verification or documents?',
      a: 'No. Accounts are created instantly with just a username, email, and single password. No KYC documents or private keys required.'
    }
  ];

  return (
    <div className="space-y-16 pb-12">
      {/* Clean, Simple Hero Section */}
      <section className="text-center pt-8 sm:pt-14 max-w-5xl mx-auto px-4">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Real Opinions. Real Value.
        </h1>

        <p className="mt-4 text-base sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
          Share verified opinions, participate in global research studies, and unlock transparent value with seamless digital payouts.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Start Earning Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-sm transition-colors text-center"
          >
            How It Works
          </a>
        </div>

        {/* Simple Trust Points */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-8 text-xs sm:text-sm font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Instant Registration</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>10,000 Pts = $0.40 USDT</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>TRC-20 &amp; ERC-20</span>
          </div>
        </div>
      </section>

      {/* 3 Simple Steps */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 scroll-mt-24">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">How It Works</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Start earning in 3 simple steps</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-xs hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 font-black text-lg flex items-center justify-center mb-4">
              1
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">Create Free Account</h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Sign up in seconds with just a username, email, and password. No email verification or KYC needed.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-xs hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 font-black text-lg flex items-center justify-center mb-4">
              2
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">Complete Surveys &amp; Tasks</h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Answer research surveys and finish quick tasks to accumulate reward points on your balance.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-xs hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 font-black text-lg flex items-center justify-center mb-4">
              3
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">Withdraw USDT</h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Request payout directly to your USDT wallet address via fast TRC-20 or ERC-20 transfer.
            </p>
          </div>
        </div>
      </section>

      {/* Core Platform Highlights & Rewards */}
      <section id="rewards" className="max-w-7xl mx-auto px-4 scroll-mt-24">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">USDT Rewards &amp; Platform Perks</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Guaranteed crypto earnings delivered directly to your wallet</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Instant Access</h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">Start taking surveys immediately after creating an account.</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Direct Crypto Payouts</h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">Tether (USDT) paid directly to your personal crypto wallet.</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Zero Risk</h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">No private keys, seed phrases, or deposit required ever.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Clean FAQs */}
      <section id="faq" className="max-w-5xl mx-auto px-4 scroll-mt-24">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Frequently Asked Questions</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Quick answers to common questions</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs transition-all"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-slate-800 hover:text-sky-600 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA Card */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-xs">
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900">Ready to start earning?</h3>
          <p className="text-xs sm:text-base text-slate-500 mt-2 max-w-lg mx-auto">
            Create your account in seconds and start completing surveys for USDT rewards today.
          </p>
          <button
            onClick={onGetStarted}
            className="mt-6 px-8 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
};
