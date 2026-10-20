import React from 'react';

interface LogoProps {
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  inverted?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', showTagline = false, size = 'md', inverted = false }) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* River Wave Symbol */}
      <div className={`relative ${iconSizes[size]} rounded-xl bg-gradient-to-br from-sky-600 via-sky-500 to-cyan-500 p-0.5 shadow-sm flex items-center justify-center shrink-0`}>
        <div className="w-full h-full bg-slate-950/10 rounded-[10px] flex items-center justify-center overflow-hidden">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-5/6 h-5/6 text-white drop-shadow-sm"
          >
            {/* Top river flow wave */}
            <path
              d="M4 11C8 7 13 7 17 11C21 15 26 15 28 11"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />
            {/* Center main river current */}
            <path
              d="M4 16C8 12 13 12 17 16C21 20 26 20 28 16"
              stroke="white"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Lower river wave */}
            <path
              d="M4 21C8 17 13 17 17 21C21 25 26 25 28 21"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
          </svg>
        </div>
      </div>

      <div className="flex flex-col">
        <span className={`font-bold tracking-tight ${inverted ? 'text-white' : 'text-slate-900'} ${textSizes[size]}`}>
          Reward<span className="text-sky-500">River</span>
        </span>
        {showTagline && (
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${inverted ? 'text-slate-400' : 'text-slate-500'}`}>
            Earn Rewards. Flow Forward.
          </span>
        )}
      </div>
    </div>
  );
};
