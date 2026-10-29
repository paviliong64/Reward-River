import React from 'react';

interface LogoProps {
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  inverted?: boolean;
  variant?: 'full' | 'icon-only';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  showTagline = true,
  size = 'md',
  inverted = false,
  variant = 'full'
}) => {
  const iconHeightClasses = {
    sm: 'h-7 sm:h-8',
    md: 'h-8 sm:h-10',
    lg: 'h-10 sm:h-12',
    xl: 'h-12 sm:h-16'
  };

  const titleSizes = {
    sm: 'text-base sm:text-lg',
    md: 'text-lg sm:text-2xl',
    lg: 'text-xl sm:text-3xl',
    xl: 'text-2xl sm:text-4xl'
  };

  const taglineSizes = {
    sm: 'text-[9px]',
    md: 'text-[11px]',
    lg: 'text-[12px]',
    xl: 'text-[14px]'
  };

  const logoImagePath = '/assets/aistudio/Glossy_Green_R_with_Gift_and_River_4c633918.png';

  if (variant === 'icon-only') {
    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
        <img
          src={logoImagePath}
          alt="Reward River Icon"
          className={`${iconHeightClasses[size]} w-auto object-contain drop-shadow-xs`}
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 sm:gap-3 select-none ${className}`}>
      {/* Icon Image */}
      <div className="relative shrink-0 flex items-center">
        <img
          src={logoImagePath}
          alt="Reward River Icon"
          className={`${iconHeightClasses[size]} w-auto object-contain drop-shadow-xs shrink-0`}
        />
      </div>

      {/* Wordmark and Tagline */}
      <div className="flex flex-col justify-center min-w-0">
        <div className={`font-black tracking-tight leading-none ${titleSizes[size]}`}>
          <span className={inverted ? 'text-white' : 'text-[#192F40] dark:text-white'}>Reward</span>
          <span className="text-[#079B55] ml-1">River</span>
        </div>

        {showTagline && (
          <div className={`hidden sm:block font-medium tracking-wide mt-1 leading-none ${taglineSizes[size]} ${inverted ? 'text-slate-300' : 'text-[#52697A] dark:text-slate-300'}`}>
            <span>Earn</span>
            <span className="mx-1 text-[#079B55] font-bold">•</span>
            <span>Complete</span>
            <span className="mx-1 text-[#079B55] font-bold">•</span>
            <span>Get Rewards</span>
          </div>
        )}
      </div>
    </div>
  );
};
