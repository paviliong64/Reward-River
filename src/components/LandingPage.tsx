import React from 'react';
import { UsdtQuote } from '../types';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Gift,
  Users,
  CheckCircle2,
  Sparkles,
  Coins,
  ClipboardList,
  Award,
  Clock
} from 'lucide-react';

interface LandingPageProps {
  usdtQuote?: UsdtQuote | null;
  onGetStarted: () => void;
  onOpenLegal?: (page: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {

  return (
    <div className="w-full bg-white dark:bg-slate-950 text-[#192F40] dark:text-slate-100 font-sans antialiased overflow-hidden">
      {/* =====================================================================
          1. HERO SECTION (Matching Reference Image)
         ===================================================================== */}
      <section id="hero" className="relative w-full bg-[#F0FBF5] dark:bg-slate-950 py-12 lg:py-20 overflow-hidden border-b border-[#D9EFE3] dark:border-slate-800">
        {/* Background Subtle Gradient Blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#4CC65A]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-[#16B9E9]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column Text Content */}
            <div className="lg:col-span-6 space-y-6 text-left">


              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#192F40] dark:text-white tracking-tight leading-[1.1]">
                Turn Your Time Into <br />
                <span className="text-[#079B55] dark:text-[#4CC65A]">Real Rewards</span>
              </h1>

              <p className="text-sm sm:text-lg text-[#52697A] dark:text-slate-300 max-w-xl leading-relaxed font-medium">
                Complete simple tasks, take surveys, and explore offers to earn points. Redeem them for exciting rewards!
              </p>

              {/* Action CTA Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="px-6 py-3.5 sm:px-8 sm:py-4 bg-[#079B55] hover:bg-[#047A43] text-white font-extrabold text-sm rounded-xl shadow-md sm:shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <span>Start Earning</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <a
                  href="#ways-to-earn"
                  className="px-6 py-3.5 sm:px-8 sm:py-4 border-2 border-[#079B55] dark:border-[#4CC65A] text-[#079B55] dark:text-[#4CC65A] hover:bg-[#F0FBF5] dark:hover:bg-slate-900 font-extrabold text-sm rounded-xl transition-all duration-200 text-center cursor-pointer"
                >
                  Ways to Earn
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="pt-2 sm:pt-4 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-[#52697A] dark:text-slate-400 font-semibold">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#079B55]" />
                  <span>100% Free To Join</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#16B9E9]" />
                  <span>Instant Digital Delivery</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span>Verified Points Ratio</span>
                </div>
              </div>
            </div>

            {/* Right Column Illustration (Uploaded Emblem Banner) */}
            <div className="lg:col-span-6 relative flex justify-center lg:justify-end items-center">
              <div className="relative w-full max-w-[680px] lg:max-w-none flex items-center justify-center">
                <img
                  src="/assets/aistudio/Pastel_Green_River_Treasure_Emblem_a138e1ac.png"
                  alt="Reward River Hero Artwork"
                  className="w-full h-auto max-h-[360px] sm:max-h-[600px] lg:max-h-[680px] object-contain drop-shadow-xl transition-transform duration-300 hover:scale-[1.02]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. FEATURE STRIP (Below Hero)
         ===================================================================== */}
      <section className="w-full bg-white dark:bg-slate-900 border-b border-[#D9EFE3] dark:border-slate-800 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#D9EFE3] dark:divide-slate-800">
            {/* Feature 1 */}
            <div className="flex items-center gap-4 pt-4 sm:pt-0 sm:px-4 first:pl-0">
              <div className="w-12 h-12 rounded-2xl bg-[#F0FBF5] dark:bg-slate-800 text-[#079B55] dark:text-[#4CC65A] flex items-center justify-center shrink-0 border border-[#D9EFE3] dark:border-slate-700">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-[#192F40] dark:text-white">Safe &amp; Secure</h4>
                <p className="text-xs text-[#52697A] dark:text-slate-400 mt-0.5">Your data stays protected</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-center gap-4 pt-4 sm:pt-0 sm:px-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F0FBF5] dark:bg-slate-800 text-[#079B55] dark:text-[#4CC65A] flex items-center justify-center shrink-0 border border-[#D9EFE3] dark:border-slate-700">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-[#192F40] dark:text-white">Easy Earning</h4>
                <p className="text-xs text-[#52697A] dark:text-slate-400 mt-0.5">Simple tasks, big rewards</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-center gap-4 pt-4 sm:pt-0 sm:px-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F0FBF5] dark:bg-slate-800 text-[#079B55] dark:text-[#4CC65A] flex items-center justify-center shrink-0 border border-[#D9EFE3] dark:border-slate-700">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-[#192F40] dark:text-white">Multiple Rewards</h4>
                <p className="text-xs text-[#52697A] dark:text-slate-400 mt-0.5">Gift cards, PayPal &amp; more</p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex items-center gap-4 pt-4 sm:pt-0 sm:px-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F0FBF5] dark:bg-slate-800 text-[#079B55] dark:text-[#4CC65A] flex items-center justify-center shrink-0 border border-[#D9EFE3] dark:border-slate-700">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-[#192F40] dark:text-white">Trusted Community</h4>
                <p className="text-xs text-[#52697A] dark:text-slate-400 mt-0.5">Join our growing community</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. HOW IT WORKS SECTION
         ===================================================================== */}
      <section id="how-it-works" className="py-16 sm:py-20 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="space-y-3 max-w-2xl mx-auto">

            <h2 className="text-3xl sm:text-4xl font-black text-[#192F40] dark:text-white tracking-tight">
              How Reward River Works
            </h2>
            <p className="text-sm text-[#52697A] dark:text-slate-400 leading-relaxed">
              Start earning real digital gift cards and cash in three easy steps with zero complicated requirements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="bg-[#F0FBF5] dark:bg-slate-900/60 rounded-3xl p-8 border border-[#D9EFE3] dark:border-slate-800 text-left space-y-4 hover:shadow-lg transition-all duration-300 relative group">
              <div className="w-14 h-14 rounded-2xl bg-[#079B55] text-white flex items-center justify-center font-black text-xl shadow-md group-hover:scale-110 transition-transform">
                01
              </div>
              <h3 className="text-xl font-black text-[#192F40] dark:text-white">Sign Up Free</h3>
              <p className="text-xs text-[#52697A] dark:text-slate-300 leading-relaxed">
                Create your free Reward River account in less than 30 seconds with basic details. No invasive KYC or credit card required.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#F0FBF5] dark:bg-slate-900/60 rounded-3xl p-8 border border-[#D9EFE3] dark:border-slate-800 text-left space-y-4 hover:shadow-lg transition-all duration-300 relative group">
              <div className="w-14 h-14 rounded-2xl bg-[#079B55] text-white flex items-center justify-center font-black text-xl shadow-md group-hover:scale-110 transition-transform">
                02
              </div>
              <h3 className="text-xl font-black text-[#192F40] dark:text-white">Complete Tasks</h3>
              <p className="text-xs text-[#52697A] dark:text-slate-300 leading-relaxed">
                Participate in verified consumer surveys, explore partner offers, daily sponsored check-ins, and online tasks to accumulate Points.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#F0FBF5] dark:bg-slate-900/60 rounded-3xl p-8 border border-[#D9EFE3] dark:border-slate-800 text-left space-y-4 hover:shadow-lg transition-all duration-300 relative group">
              <div className="w-14 h-14 rounded-2xl bg-[#079B55] text-white flex items-center justify-center font-black text-xl shadow-md group-hover:scale-110 transition-transform">
                03
              </div>
              <h3 className="text-xl font-black text-[#192F40] dark:text-white">Redeem Rewards</h3>
              <p className="text-xs text-[#52697A] dark:text-slate-300 leading-relaxed">
                Exchange your accumulated Reward River Points directly for digital gift cards, PayPal cash payouts, or prepaid debit rewards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. WAYS TO EARN SECTION
         ===================================================================== */}
      <section id="ways-to-earn" className="py-16 sm:py-20 bg-[#F0FBF5] dark:bg-slate-900/40 border-y border-[#D9EFE3] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 text-center">
          <div className="space-y-3 max-w-2xl mx-auto">

            <h2 className="text-3xl sm:text-4xl font-black text-[#192F40] dark:text-white tracking-tight">
              Ways to Earn on Reward River
            </h2>
            <p className="text-sm text-[#52697A] dark:text-slate-400 leading-relaxed">
              Choose the activities that fit your routine best and start accumulating points instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Surveys */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-[#D9EFE3] dark:border-slate-800 text-left space-y-4 hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-[#F0FBF5] dark:bg-slate-800 text-[#079B55] dark:text-[#4CC65A] flex items-center justify-center font-bold">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-[#192F40] dark:text-white">Market Surveys</h3>
              <p className="text-xs text-[#52697A] dark:text-slate-300 leading-relaxed">
                Share your valuable consumer opinions on real products and brand studies through verified research partners.
              </p>
              <div className="pt-2 text-xs font-extrabold text-[#079B55] flex items-center gap-1">
                <span>Earn up to 30,000 Pts / survey</span>
              </div>
            </div>

            {/* Card 2: Online Tasks */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-[#D9EFE3] dark:border-slate-800 text-left space-y-4 hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-[#F0FBF5] dark:bg-slate-800 text-[#079B55] dark:text-[#4CC65A] flex items-center justify-center font-bold">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-[#192F40] dark:text-white">Online Tasks</h3>
              <p className="text-xs text-[#52697A] dark:text-slate-300 leading-relaxed">
                Complete quick micro-tasks, sponsored link visits, and daily streak check-ins for guaranteed instant points.
              </p>
              <div className="pt-2 text-xs font-extrabold text-[#079B55] flex items-center gap-1">
                <span>Instant Crediting</span>
              </div>
            </div>

            {/* Card 3: Special Offers */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-[#D9EFE3] dark:border-slate-800 text-left space-y-4 hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-[#F0FBF5] dark:bg-slate-800 text-[#079B55] dark:text-[#4CC65A] flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-[#192F40] dark:text-white">Special Offers</h3>
              <p className="text-xs text-[#52697A] dark:text-slate-300 leading-relaxed">
                Try new mobile apps, free trial services, and exclusive partner promotions with high point payouts.
              </p>
              <div className="pt-2 text-xs font-extrabold text-[#079B55] flex items-center gap-1">
                <span>High Payout Offers</span>
              </div>
            </div>

            {/* Card 4: Reward Activities */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-[#D9EFE3] dark:border-slate-800 text-left space-y-4 hover:shadow-md transition-all duration-200">
              <div className="w-12 h-12 rounded-xl bg-[#F0FBF5] dark:bg-slate-800 text-[#079B55] dark:text-[#4CC65A] flex items-center justify-center font-bold">
                <Gift className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-[#192F40] dark:text-white">Reward Activities</h3>
              <p className="text-xs text-[#52697A] dark:text-slate-300 leading-relaxed">
                Participate in daily bonus events, referral incentives, and seasonal community reward challenges.
              </p>
              <div className="pt-2 text-xs font-extrabold text-[#079B55] flex items-center gap-1">
                <span>Daily Bonus Rewards</span>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* =====================================================================
          6. WHY REWARD RIVER SECTION
         ===================================================================== */}
      <section id="why-reward-river" className="py-16 sm:py-20 bg-[#F0FBF5] dark:bg-slate-900/40 border-y border-[#D9EFE3] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">

            <h2 className="text-3xl sm:text-4xl font-black text-[#192F40] dark:text-white tracking-tight">
              Why Choose Reward River
            </h2>
            <p className="text-sm text-[#52697A] dark:text-slate-400 leading-relaxed">
              Designed with user convenience, rapid redemptions, and high-value opportunities at its core.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-[#D9EFE3] dark:border-slate-800 space-y-3 text-left">
              <div className="w-12 h-12 rounded-2xl bg-[#079B55]/10 text-[#079B55] flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-[#192F40] dark:text-white">Fast Digital Delivery</h3>
              <p className="text-xs text-[#52697A] dark:text-slate-300 leading-relaxed">
                No long waiting periods. Once requested, digital gift codes and cash transfers are delivered directly to your account history.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-[#D9EFE3] dark:border-slate-800 space-y-3 text-left">
              <div className="w-12 h-12 rounded-2xl bg-[#079B55]/10 text-[#079B55] flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-[#192F40] dark:text-white">Verified Market Partners</h3>
              <p className="text-xs text-[#52697A] dark:text-slate-300 leading-relaxed">
                Direct integrations with top consumer research panels like CPX Research ensure 100% genuine survey opportunities.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-[#D9EFE3] dark:border-slate-800 space-y-3 text-left">
              <div className="w-12 h-12 rounded-2xl bg-[#079B55]/10 text-[#079B55] flex items-center justify-center font-bold">
                <Coins className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-[#192F40] dark:text-white">Transparent Points System</h3>
              <p className="text-xs text-[#52697A] dark:text-slate-300 leading-relaxed">
                Instant point crediting with zero hidden fees. Accumulate Reward River Points for all completed surveys and tasks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. CALL TO ACTION SECTION (Full-Width Green Gradient)
         ===================================================================== */}
      <section className="w-full bg-gradient-to-r from-[#047A43] via-[#079B55] to-[#4CC65A] text-white py-16 sm:py-20 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight drop-shadow-sm">
            Ready to Start Earning?
          </h2>
          <p className="text-base sm:text-lg text-white/95 max-w-2xl mx-auto font-medium leading-relaxed">
            Explore new opportunities and discover rewards on Reward River.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onGetStarted}
              className="px-10 py-4 bg-white hover:bg-[#F0FBF5] text-[#047A43] font-black text-sm uppercase tracking-wider rounded-xl shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>


    </div>
  );
};
