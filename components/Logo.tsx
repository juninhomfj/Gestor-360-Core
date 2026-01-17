import React from 'react';
import { User } from '../types';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon';
  lightMode?: boolean;
  planUser?: User;
  className?: string;
}

const Logo: React.FC<LogoProps> = ({
  size = 'md',
  variant = 'full',
  lightMode = false,
  className = ''
}) => {
  const sizes = {
    xs: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl'
  };

  const baseColor = lightMode ? 'text-white' : 'text-slate-900 dark:text-white';

  if (variant === 'icon') {
    return (
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center 
        bg-gradient-to-br from-emerald-600 to-teal-500 text-white font-black ${className}`}
      >
        360
      </div>
    );
  }

  return (
    <div className={`flex flex-col select-none ${className}`}>
      <div className={`flex items-baseline font-extrabold tracking-tight ${sizes[size]}`}>
        <span className={baseColor}>Gestor</span>
        <span className="ml-1 text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
          360
        </span>
      </div>
      <span className="text-[10px] tracking-widest uppercase text-emerald-500 font-semibold ml-0.5">
        Platform
      </span>
    </div>
  );
};

export default Logo;