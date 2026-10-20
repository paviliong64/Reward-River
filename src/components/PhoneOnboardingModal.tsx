import React, { useState } from 'react';
import { MessageSquare, ShieldCheck, Check, ArrowRight, X } from 'lucide-react';
import { User } from '../types';

interface PhoneOnboardingModalProps {
  isOpen: boolean;
  user: User;
  onSave: (phoneWithCode: string, countryCode: string) => Promise<void>;
  onClose: () => void;
}

const COUNTRY_CODES = [
  { code: '+1', flag: '🇺🇸', name: 'United States / Canada' },
  { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+971', flag: '🇦🇪', name: 'United Arab Emirates' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+90', flag: '🇹🇷', name: 'Turkey' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
  { code: '+52', flag: '🇲🇽', name: 'Mexico' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: '+39', flag: '🇮🇹', name: 'Italy' },
  { code: '+34', flag: '🇪🇸', name: 'Spain' },
  { code: '+31', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+84', flag: '🇻🇳', name: 'Vietnam' },
];

export const PhoneOnboardingModal: React.FC<PhoneOnboardingModalProps> = ({
  isOpen,
  user,
  onSave,
  onClose
}) => {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0].code);
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput || phoneInput.trim().length < 6) {
      setError('Please enter a valid phone or WhatsApp number.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const fullNumber = `${selectedCountry}${phoneInput.trim().replace(/^0+/, '')}`;
      await onSave(fullNumber, selectedCountry);
    } catch {
      setError('Failed to save contact information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden relative">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>

          <h3 className="text-xl font-bold tracking-tight">Add Your WhatsApp Number</h3>
          <p className="text-xs text-emerald-100 mt-1">
            Receive instant USDT withdrawal updates & priority security alerts for <strong>{user.displayName || user.email}</strong>.
          </p>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Country & Phone / WhatsApp Number
            </label>
            <div className="flex gap-2">
              <select
                value={selectedCountry}
                onChange={e => setSelectedCountry(e.target.value)}
                className="w-1/3 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {COUNTRY_CODES.map(item => (
                  <option key={item.code} value={item.code}>
                    {item.flag} {item.code} ({item.name.slice(0, 10)}...)
                  </option>
                ))}
              </select>

              <input
                type="tel"
                placeholder="300 1234567"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value.replace(/[^\d]/g, ''))}
                className="w-2/3 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
              <span>Worldwide format. Asked <strong>only once</strong> upon first sign in.</span>
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save WhatsApp Contact & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs transition-colors"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
