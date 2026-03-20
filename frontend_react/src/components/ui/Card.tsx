import React from 'react';
import { cn } from '../../utils/cn';
import { focusVisible } from '../../utils/accessibility';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  as?: 'div' | 'article' | 'section';
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ 
  children, 
  className, 
  padding = 'md',
  shadow = 'sm',
  hover = false,
  as: Component = 'div',
  role,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  onClick,
  ...props
}) => {
  const baseStyles = [
    'bg-white rounded-lg border border-gray-200',
    'transition-all duration-200'
  ];

  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const shadowStyles = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg'
  };

  const hoverStyles = hover ? [
    'hover:shadow-md hover:border-gray-300',
    'cursor-pointer',
    focusVisible
  ] : [];

  return (
    <Component 
      className={cn(
        baseStyles,
        paddingStyles[padding],
        shadowStyles[shadow],
        hoverStyles,
        className
      )}
      role={role}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={hover ? 0 : undefined}
      onClick={onClick}
      {...props}
    >
      {children}
    </Component>
  );
};

// Card sub-components for better composition
const CardHeader: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
  as?: 'div' | 'header';
}> = ({ 
  children, 
  className,
  as: Component = 'div'
}) => (
  <Component className={cn('border-b border-gray-200 pb-3 mb-4', className)}>
    {children}
  </Component>
);

const CardTitle: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}> = ({ 
  children, 
  className,
  level = 3
}) => {
  const Component = `h${level}` as keyof JSX.IntrinsicElements;
  
  return (
    <Component className={cn('text-lg font-semibold text-gray-900', className)}>
      {children}
    </Component>
  );
};

const CardContent: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
  as?: 'div' | 'main';
}> = ({ 
  children, 
  className,
  as: Component = 'div'
}) => (
  <Component className={cn('text-gray-700', className)}>
    {children}
  </Component>
);

const CardFooter: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
  as?: 'div' | 'footer';
}> = ({ 
  children, 
  className,
  as: Component = 'div'
}) => (
  <Component className={cn('border-t border-gray-200 pt-3 mt-4', className)}>
    {children}
  </Component>
);

export { Card, CardHeader, CardTitle, CardContent, CardFooter };