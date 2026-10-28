import React, { useState } from 'react';
import { UsdtQuote } from '../types';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Wallet,
  Zap,
  Globe2,
  Coins,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface LandingPageProps {
  usdtQuote: UsdtQuote | null;
  onGetStarted: () => void;
  onOpenLegal: (page: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [dailySurveys, setDailySurveys] = useState<number>(3);

  // Live earnings calculator math:
  // Average user reward: ~$1.20 USDT (12,000 Points) per survey
  const avgSurveyRewardUsdt = 1.20;
  const avgSurveyPoints = 12000;
  const estimatedDailyUsdt = (dailySurveys * avgSurveyRewardUsdt).toFixed(2);
  const estimatedMonthlyUsdt = (dailySurveys * avgSurveyRewardUsdt * 30).toFixed(0);
  const estimatedMonthlyPoints = (dailySurveys * avgSurveyPoints * 30).toLocaleString('en-US');

  const faqs = [
    {
      q: 'How do I earn real USDT on Reward River?',
      a: 'You participate in verified market research studies through our direct CPX Research integration and complete Instant Tasks & PTC. Once completed, your earnings are credited instantly to your balance in Points and withdrawable USDT.'
    },
    {
      q: 'What is the Points to USDT exchange rate?',
      a: '10,000 Points equals $0.40 USDT. Your earnings are always transparently shown in both Points and real USDT value, so you always know exactly what your time is worth.'
    },
    {
      q: 'Which crypto networks are supported for withdrawals?',
      a: 'We support TRON (TRC-20) for lightning-fast transfers with a low flat $1.00 fee, as well as Ethereum (ERC-20). You can withdraw to Binance, Trust Wallet, OKX, Bybit, MetaMask, or any standard self-custody wallet.'
    },
    {
      q: 'What is the minimum withdrawal amount?',
      a: 'The minimum withdrawal is just $25.00 USDT (625,000 Points). Once requested, withdrawals are processed and verified on the blockchain with complete TxHash tracking.'
    },
    {
      q: 'Do I need identity verification or KYC documents?',
      a: 'No. Accounts are created in under 30 seconds with just an email, username, and single password. No passport uploads, ID scans, or intrusive verification required.'
    },
    {
      q: 'How does Reward River protect against fraud?',
      a: 'Every completed survey is cryptographically confirmed via Server-to-Server (S2S) MD5 postbacks directly from CPX Research. Our double-entry financial ledger records every single transaction permanently.'
    }
  ];

  const recentActivity = [
    { user: 'Marcus T.', country: '🇺🇸 US', points: '+12,500 Pts', reward: '$1.25 USDT', task: 'CPX Research Survey', time: '1m ago' },
    { user: 'Elena V.', country: '🇩🇪 DE', points: '+24,000 Pts', reward: '$2.40 USDT', task: 'Automotive Study', time: '3m ago' },
    { user: 'Tariq A.', country: '🇦🇪 AE', points: '+500,000 Pts', reward: '$50.00 USDT', task: 'TRC-20 Payout', time: '5m ago' },
    { user: 'Siti N.', country: '🇲🇾 MY', points: '+9,800 Pts', reward: '$0.98 USDT', task: 'Consumer Poll', time: '7m ago' },
    { user: 'Lucas R.', country: '🇧🇷 BR', points: '+250,000 Pts', reward: '$25.00 USDT', task: 'TRC-20 Payout', time: '11m ago' },
  ];

  return (
    <div className="w-full space-y-0 text-slate-800 antialiased overflow-hidden">
      {/* =====================================================================
          1. HERO SECTION (Captivate Audiences / Cultivate Rewards)
          Exact dual-tone radiant magenta/cyan gradient + smiling person visual
         ===================================================================== */}
      <section className="relative w-full min-h-[640px] lg:min-h-[700px] bg-gradient-to-br from-[#D92662] via-[#8E1C65] to-[#0A1628] text-white flex items-center overflow-hidden">
        {/* Atmospheric Radial Glow Layers */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(circle at 85% 30%, rgba(6, 182, 212, 0.5) 0%, transparent 55%),
              radial-gradient(circle at 15% 45%, rgba(244, 63, 94, 0.4) 0%, transparent 50%),
              radial-gradient(circle at 50% 90%, rgba(15, 23, 42, 0.85) 0%, transparent 70%)
            `
          }}
        />

        {/* Ambient Subtle Grid Texture */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Column: Big Bold Typography & High-Contrast CTAs */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-white uppercase tracking-widest shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Next-Gen Consumer Rewards Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white tracking-tight leading-[1.05] uppercase drop-shadow-md">
                Share Opinions <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-200 to-white">
                  Cultivate Rewards
                </span>
              </h1>

              <p className="text-base sm:text-lg lg:text-xl text-white/90 max-w-xl leading-relaxed font-normal drop-shadow-sm">
                Create meaningful consumer connections across every device, media channel, and geography with verified research surveys and instant withdrawable USDT.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="px-8 py-4 bg-[#F7B928] hover:bg-[#e6ab1e] text-slate-950 font-black text-xs uppercase tracking-wider rounded-md shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <span>Start Earning Now</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>

                <a
                  href="#how-it-works"
                  className="px-7 py-4 border border-white/60 hover:border-white text-white hover:bg-white/10 font-bold text-xs uppercase tracking-wider rounded-md transition-all text-center cursor-pointer"
                >
                  How We Do It
                </a>
              </div>

              {/* Trust Indicator Badges */}
              <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-white/80 font-medium">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>CPX Research Official Integration</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-300" />
                  <span>TRC-20 &amp; ERC-20 Fast Pay</span>
                </div>
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-300" />
                  <span>10,000 Pts = $0.40 USDT</span>
                </div>
              </div>
            </div>

            {/* Right Column: Portrait Person with Neon Cyan & Magenta Lighting */}
            <div className="lg:col-span-5 relative flex justify-center items-center">
              {/* Outer Neon Glow Rings */}
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-rose-500/30 to-cyan-500/30 blur-2xl opacity-75" />

              <div className="relative w-full max-w-[440px] aspect-[4/5] rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-slate-950/40">
                {/* Person Portrait with Dual-Tone Lighting Overlay */}
                <img
                  src="/assets/portrait_person.jpg"
                  alt="Reward River Community Respondent"
                  className="w-full h-full object-cover object-center filter contrast-110 saturate-125"
                />

                {/* Cyan & Magenta Neon Duotone Lighting Blend Layer */}
                <div
                  className="absolute inset-0 pointer-events-none mix-blend-color"
                  style={{
                    background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.7) 0%, rgba(6, 182, 212, 0.75) 100%)'
                  }}
                />

                {/* Subtle soft vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                {/* Floating Activity Card on the Image */}
                <div className="absolute bottom-5 left-5 right-5 p-4 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/20 text-white shadow-xl flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                      <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Survey Completed!</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <div className="text-[11px] text-white/70 font-mono">
                        +12,500 Pts credited ($1.25 USDT)
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20">
                    Instant
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =====================================================================
          2. THE 3 SIGNATURE OVERLAP CARDS
          Exactly matching the reference image layout:
          WHO WE HELP | BRANDS | RETAILERS / CRYPTO SETTLEMENT
         ===================================================================== */}
      <section id="who-we-help" className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-14 mb-16">
        <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.08)] border border-slate-200/90 p-8 sm:p-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            
            {/* Column 1: WHO WE HELP */}
            <div className="space-y-3 md:pr-6 pt-6 md:pt-0">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                Who We Help
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Purpose-built software platform to deliver transparent market research earnings for everyday participants, digital creators, and verified respondents worldwide. Complete research without payment bottlenecks or complex KYC hurdles.
              </p>
              <div className="pt-2 text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                <span>Consumer Panels &amp; Earners</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Column 2: BRANDS & RESEARCHERS */}
            <div className="space-y-3 md:px-6 pt-6 md:pt-0">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                Brands &amp; Studies
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Connecting Fortune 500 consumer brands and global market intelligence firms directly to engaged respondents through our exclusive CPX Research and AoyTasks enterprise API network with automated quality scoring.
              </p>
              <div className="pt-2 text-xs font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1.5">
                <span>CPX Research Global Inventory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Column 3: CRYPTO SETTLEMENT */}
            <div className="space-y-3 md:pl-6 pt-6 md:pt-0">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                Crypto Settlement
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Driving quality traffic and survey completions into verifiable, withdrawable USDT. Fast TRON (TRC-20) and Ethereum (ERC-20) blockchain transfers with immutable double-entry ledger tracking and zero hidden deductions.
              </p>
              <div className="pt-2 text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                <span>TRC-20 &amp; ERC-20 Fast Pay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =====================================================================
          3. RECENT ACTIVITY STREAM TICKER
         ===================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              Live Verified Activity
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-slate-600 w-full overflow-x-auto pb-1 md:pb-0">
            {recentActivity.map((act, idx) => (
              <div key={idx} className="flex items-center gap-2 whitespace-nowrap bg-white px-3 py-1.5 rounded-lg border border-slate-200/80 shadow-xs">
                <span className="font-bold text-slate-900">{act.country} {act.user}</span>
                <span className="text-slate-400">•</span>
                <span className="text-emerald-700 font-bold">{act.points}</span>
                <span className="text-slate-500 font-mono">({act.reward})</span>
                <span className="text-slate-400 text-[10px]">{act.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. WHAT WE DO (4 Interactive Pillars)
         ===================================================================== */}
      <section id="what-we-do" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-24">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="text-xs font-black text-rose-600 uppercase tracking-widest">
            What We Do
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase">
            A Multi-Channel Rewards Ecosystem
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Reward River pairs verified market research with automated crypto settlements so you can monetize your time from any desktop or mobile device.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-xs hover:shadow-lg transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <Globe2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              CPX Research Surveys
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Direct access to live, high-conversion research studies from the world's leading brands. Dynamic profiling ensures high acceptance rates.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-xs hover:shadow-lg transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Instant Tasks &amp; PTC
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Quick sponsored partner visits, shortlinks, and micro-verifications. Earn points in 10 to 30 seconds when you want quick flexible rewards.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-xs hover:shadow-lg transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <Wallet className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Direct USDT Payouts
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Withdraw straight to your TRON (TRC-20) or Ethereum (ERC-20) address. Low flat transfer fees ($1.00 USDT) and zero store coupon nonsense.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-white rounded-2xl p-7 border border-slate-200 shadow-xs hover:shadow-lg transition-all space-y-4 group">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Immutable Accounting
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Every point credited is secured with cryptographic double-entry ledger records. Real-time balance updates and transparent transaction IDs.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. INTERACTIVE USDT EARNINGS CALCULATOR
         ===================================================================== */}
      <section className="bg-slate-900 text-white py-16 lg:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-950/40 via-slate-900 to-cyan-950/40 pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-4">
              <div className="text-xs font-black text-amber-400 uppercase tracking-widest">
                Interactive Earnings Calculator
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase leading-tight">
                How Much Can You Earn With Reward River?
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Move the slider to estimate your monthly USDT earnings based on average daily completed studies and instant tasks.
              </p>

              {/* Slider Control */}
              <div className="pt-4 space-y-3 bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-200">Surveys &amp; Tasks Per Day:</span>
                  <span className="text-xl font-mono font-black text-[#F7B928]">{dailySurveys} studies/day</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={dailySurveys}
                  onChange={(e) => setDailySurveys(Number(e.target.value))}
                  className="w-full accent-[#F7B928] cursor-pointer h-2 bg-slate-700 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>1 survey/day</span>
                  <span>6 surveys/day</span>
                  <span>12 surveys/day</span>
                </div>
              </div>
            </div>

            {/* Results Card */}
            <div className="lg:col-span-6">
              <div className="bg-gradient-to-br from-slate-800 to-slate-950 border border-white/10 rounded-2xl p-8 sm:p-10 shadow-2xl space-y-6">
                <div className="grid grid-cols-2 gap-4 pb-6 border-b border-white/10">
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Daily Estimated</span>
                    <div className="text-3xl sm:text-4xl font-black text-white font-mono mt-1">
                      ${estimatedDailyUsdt} <span className="text-sm text-emerald-400 font-normal">USDT</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Monthly Estimated</span>
                    <div className="text-3xl sm:text-4xl font-black text-[#F7B928] font-mono mt-1">
                      ${estimatedMonthlyUsdt} <span className="text-sm text-amber-200 font-normal">USDT</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                  <span>Monthly Points Volume:</span>
                  <span className="font-bold text-white">~{estimatedMonthlyPoints} Pts</span>
                </div>

                <button
                  type="button"
                  onClick={onGetStarted}
                  className="w-full py-4 bg-[#F7B928] hover:bg-[#e6ab1e] text-slate-950 font-black text-xs uppercase tracking-wider rounded-md shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Start Earning This Today</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =====================================================================
          6. HOW IT WORKS (3 Simple Steps)
         ===================================================================== */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
          <div className="text-xs font-black text-rose-600 uppercase tracking-widest">
            How We Do It
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase">
            Start Earning in 3 Frictionless Steps
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            No long waiting queues, zero invasive document uploads, and direct blockchain payouts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#F7B928] text-slate-950 font-black text-xl flex items-center justify-center">
              1
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Instant Free Signup
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Register in under 30 seconds with an email and password. No credit card, no identity documents, and no KYC verification needed.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-600 text-white font-black text-xl flex items-center justify-center">
              2
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Share Your Opinions
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Pick high-paying CPX Research surveys or quick sponsored tasks. Completed tasks credit points instantly to your account ledger.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative space-y-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-600 text-white font-black text-xl flex items-center justify-center">
              3
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Withdraw Real USDT
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Reach the low $25.00 USDT threshold and withdraw directly to your TRON (TRC-20) or Ethereum (ERC-20) wallet with verifiable TxHash.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. WHY REWARD RIVER (Comparison Matrix)
         ===================================================================== */}
      <section id="why-reward-river" className="bg-slate-100/70 py-16 scroll-mt-24 border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-12">
            <div className="text-xs font-black text-rose-600 uppercase tracking-widest">
              Why Reward River
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase">
              Better Than Traditional Survey Sites
            </h2>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
            <div className="grid grid-cols-12 bg-slate-900 text-white p-4 font-bold text-xs uppercase tracking-wider">
              <div className="col-span-5 sm:col-span-6">Features &amp; Payout Terms</div>
              <div className="col-span-4 sm:col-span-3 text-center text-[#F7B928]">Reward River</div>
              <div className="col-span-3 text-center text-slate-400">Old Survey Sites</div>
            </div>

            <div className="divide-y divide-slate-100 text-xs sm:text-sm">
              <div className="grid grid-cols-12 p-4 items-center">
                <div className="col-span-5 sm:col-span-6 font-semibold text-slate-800">Payout Currency</div>
                <div className="col-span-4 sm:col-span-3 text-center font-bold text-emerald-700">Real USDT Crypto</div>
                <div className="col-span-3 text-center text-slate-500">Retail gift cards / Store points</div>
              </div>

              <div className="grid grid-cols-12 p-4 items-center bg-slate-50/50">
                <div className="col-span-5 sm:col-span-6 font-semibold text-slate-800">Minimum Threshold</div>
                <div className="col-span-4 sm:col-span-3 text-center font-bold text-emerald-700">Just $25.00 USDT</div>
                <div className="col-span-3 text-center text-slate-500">$50.00 – $100.00 locks</div>
              </div>

              <div className="grid grid-cols-12 p-4 items-center">
                <div className="col-span-5 sm:col-span-6 font-semibold text-slate-800">KYC &amp; ID Documents</div>
                <div className="col-span-4 sm:col-span-3 text-center font-bold text-emerald-700">Zero ID Required</div>
                <div className="col-span-3 text-center text-slate-500">Passport / Photo ID scans</div>
              </div>

              <div className="grid grid-cols-12 p-4 items-center bg-slate-50/50">
                <div className="col-span-5 sm:col-span-6 font-semibold text-slate-800">Payout Speed</div>
                <div className="col-span-4 sm:col-span-3 text-center font-bold text-emerald-700">Automated Blockchain</div>
                <div className="col-span-3 text-center text-slate-500">14 to 30 business days</div>
              </div>

              <div className="grid grid-cols-12 p-4 items-center">
                <div className="col-span-5 sm:col-span-6 font-semibold text-slate-800">Accounting Transparency</div>
                <div className="col-span-4 sm:col-span-3 text-center font-bold text-emerald-700">Double-Entry Ledger</div>
                <div className="col-span-3 text-center text-slate-500">Opaque balance deductions</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          8. FAQ ACCORDION (Resources)
         ===================================================================== */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 scroll-mt-24">
        <div className="text-center space-y-3 mb-12">
          <div className="text-xs font-black text-rose-600 uppercase tracking-widest">
            Resources &amp; Answers
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 hover:bg-slate-50/80 transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-rose-600 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          9. BOTTOM HIGH-IMPACT CTA BANNER
         ===================================================================== */}
      <section className="relative w-full py-16 lg:py-20 bg-gradient-to-br from-[#D92662] via-[#8E1C65] to-[#0A1628] text-white text-center overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(circle at 80% 20%, rgba(6, 182, 212, 0.4) 0%, transparent 50%),
              radial-gradient(circle at 20% 80%, rgba(244, 63, 94, 0.35) 0%, transparent 50%)
            `
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 space-y-6">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
            Ready to Cultivate Rewards?
          </h2>
          <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto leading-relaxed">
            Join thousands of global members turning verified opinions into instant, withdrawable USDT. Free account creation in under 30 seconds.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onGetStarted}
              className="px-9 py-4 bg-[#F7B928] hover:bg-[#e6ab1e] text-slate-950 font-black text-xs uppercase tracking-wider rounded-md shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Join Free &amp; Start Earning</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
