import React from 'react';
import { cn } from '../../utils/cn';
import { focusVisible } from '../../utils/accessibility';

export interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  icon,
  title,
  description,
  onClick,
  className,
  disabled = false,
  'aria-label': ariaLabel,
}) => {
  const baseStyles = [
    'bg-white rounded-lg border border-gray-200 p-4',
    'flex flex-col items-center text-center space-y-2',
    'transition-all duration-200',
    'min-h-[120px] min-w-[120px]', // Ensure minimum touch target size
    'shadow-sm'
  ];

  const interactiveStyles = onClick && !disabled ? [
    'hover:shadow-md hover:border-gray-300 hover:bg-gray-50',
    'active:scale-95 cursor-pointer',
    focusVisible
  ] : [];

  const disabledStyles = disabled ? [
    'opacity-50 cursor-not-allowed'
  ] : [];

  const handleClick = () => {
    if (onClick && !disabled) {
      onClick();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && onClick && !disabled) {
      event.preventDefault();
      onClick();
    }
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={cn(
        baseStyles,
        interactiveStyles,
        disabledStyles,
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel || `${title}: ${description}`}
      aria-disabled={disabled}
    >
      <div className="text-2xl text-brand-600 flex-shrink-0">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">
          {title}
        </h3>
        <p className="text-xs text-gray-600 leading-tight">
          {description}
        </p>
      </div>
    </Component>
  );
};

export { QuickActionCard };