import React from 'react';

interface RiverLoaderProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RiverLoader: React.FC<RiverLoaderProps> = ({
  label,
  size = 'md',
  className = ''
}) => {
  const barHeights = {
    sm: 'h-4 w-1',
    md: 'h-6 w-1.5',
    lg: 'h-8 w-2'
  };

  const gapSizes = {
    sm: 'gap-1',
    md: 'gap-1.5',
    lg: 'gap-2'
  };

  return (
    <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
      <div className={`flex items-center ${gapSizes[size]}`}>
        <div className={`${barHeights[size]} rounded-full bg-gradient-to-t from-sky-600 to-cyan-400 river-bar-1`} />
        <div className={`${barHeights[size]} rounded-full bg-gradient-to-t from-sky-500 to-cyan-400 river-bar-2`} />
        <div className={`${barHeights[size]} rounded-full bg-gradient-to-t from-sky-500 to-teal-400 river-bar-3`} />
        <div className={`${barHeights[size]} rounded-full bg-gradient-to-t from-sky-600 to-emerald-400 river-bar-4`} />
      </div>
      {label && (
        <p className="mt-3 text-xs font-semibold text-slate-500 animate-pulse-subtle tracking-wide">
          {label}
        </p>
      )}
    </div>
  );
};
