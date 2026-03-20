import React from 'react';
import { cn } from '../../utils/cn';

export interface TagProps {
  children: React.ReactNode;
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'filled' | 'outlined';
  className?: string;
  onClick?: () => void;
}

const Tag: React.FC<TagProps> = ({
  children,
  color = 'default',
  size = 'md',
  variant = 'filled',
  className,
  onClick
}) => {
  const baseClasses = 'inline-flex items-center font-medium rounded-full transition-colors';
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1.5 text-sm',
    lg: 'px-3 py-2 text-base'
  };

  const colorClasses = {
    filled: {
      default: 'bg-gray-100 text-gray-800',
      primary: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      danger: 'bg-red-100 text-red-800',
      info: 'bg-cyan-100 text-cyan-800'
    },
    outlined: {
      default: 'border border-gray-300 text-gray-700 bg-white',
      primary: 'border border-blue-300 text-blue-700 bg-white',
      success: 'border border-green-300 text-green-700 bg-white',
      warning: 'border border-yellow-300 text-yellow-700 bg-white',
      danger: 'border border-red-300 text-red-700 bg-white',
      info: 'border border-cyan-300 text-cyan-700 bg-white'
    }
  };

  const hoverClasses = onClick ? {
    filled: {
      default: 'hover:bg-gray-200 cursor-pointer',
      primary: 'hover:bg-blue-200 cursor-pointer',
      success: 'hover:bg-green-200 cursor-pointer',
      warning: 'hover:bg-yellow-200 cursor-pointer',
      danger: 'hover:bg-red-200 cursor-pointer',
      info: 'hover:bg-cyan-200 cursor-pointer'
    },
    outlined: {
      default: 'hover:bg-gray-50 cursor-pointer',
      primary: 'hover:bg-blue-50 cursor-pointer',
      success: 'hover:bg-green-50 cursor-pointer',
      warning: 'hover:bg-yellow-50 cursor-pointer',
      danger: 'hover:bg-red-50 cursor-pointer',
      info: 'hover:bg-cyan-50 cursor-pointer'
    }
  } : { filled: {}, outlined: {} };

  return (
    <span
      className={cn(
        baseClasses,
        sizeClasses[size],
        colorClasses[variant][color],
        onClick && hoverClasses[variant][color],
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {children}
    </span>
  );
};

export { Tag };