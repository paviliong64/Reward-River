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
    md: 'h-9 sm:h-11',
    lg: 'h-11 sm:h-13 md:h-14',
    xl: 'h-12 sm:h-14 md:h-15 lg:h-16'
  };

  const titleSizes = {
    sm: 'text-base sm:text-lg',
    md: 'text-xl sm:text-2xl',
    lg: 'text-xl sm:text-2xl md:text-[26px]',
    xl: 'text-2xl sm:text-[26px] md:text-[28px] lg:text-[30px]'
  };

  const taglineSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px] sm:text-[11px]',
    lg: 'text-[10px] sm:text-[11.5px]',
    xl: 'text-[11px] sm:text-xs'
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
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none shrink-0 ${className}`}>
      {/* Icon Image */}
      <div className="relative shrink-0 flex items-center">
        <img
          src={logoImagePath}
          alt="Reward River Icon"
          className={`${iconHeightClasses[size]} w-auto object-contain drop-shadow-md shrink-0`}
        />
      </div>

      {/* Wordmark and Tagline */}
      <div className="flex flex-col justify-center min-w-0 whitespace-nowrap">
        <div className={`font-black tracking-tight leading-none whitespace-nowrap ${titleSizes[size]}`}>
          <span className={inverted ? 'text-white' : 'text-[#192F40] dark:text-white'}>Reward</span>
          <span className="text-[#079B55] ml-1">River</span>
        </div>

        {showTagline && (
          <div className={`hidden sm:flex items-center font-bold tracking-wide mt-1 leading-none whitespace-nowrap ${taglineSizes[size]} ${inverted ? 'text-slate-300' : 'text-[#52697A] dark:text-slate-300'}`}>
            <span>Earn</span>
            <span className="mx-1 text-[#079B55] font-black">•</span>
            <span>Complete</span>
            <span className="mx-1 text-[#079B55] font-black">•</span>
            <span>Get Rewards</span>
          </div>
        )}
      </div>
    </div>
  );
};
