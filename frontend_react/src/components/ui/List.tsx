import React from 'react';
import { cn } from '../../utils/cn';

export interface ListItemProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export interface ListItemMetaProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  avatar?: React.ReactNode;
  className?: string;
}

export interface ListProps {
  children: React.ReactNode;
  className?: string;
  size?: 'small' | 'default' | 'large';
  bordered?: boolean;
  split?: boolean;
}

const ListItem: React.FC<ListItemProps> = ({
  children,
  className,
  onClick
}) => {
  return (
    <li
      className={cn(
        'py-3 first:pt-0 last:pb-0',
        onClick && 'cursor-pointer hover:bg-gray-50 transition-colors px-3 -mx-3 rounded',
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
    </li>
  );
};

const ListItemMeta: React.FC<ListItemMetaProps> = ({
  title,
  description,
  avatar,
  className
}) => {
  return (
    <div className={cn('flex items-start space-x-3', className)}>
      {avatar && (
        <div className="flex-shrink-0">
          {avatar}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {title && (
          <div className="text-sm font-medium text-gray-900 truncate">
            {title}
          </div>
        )}
        {description && (
          <div className="text-sm text-gray-500 mt-1">
            {description}
          </div>
        )}
      </div>
    </div>
  );
};

interface ListComponentType extends React.FC<ListProps> {
  Item: React.FC<ListItemProps> & {
    Meta: React.FC<ListItemMetaProps>;
  };
}

const List = ({
  children,
  className,
  size = 'default',
  bordered = false,
  split = true
}: ListProps) => {
  const sizeClasses = {
    small: 'text-sm',
    default: 'text-base',
    large: 'text-lg'
  };

  return (
    <ul
      className={cn(
        'space-y-0',
        sizeClasses[size],
        bordered && 'border border-gray-200 rounded-lg p-4',
        split && '[&>li:not(:last-child)]:border-b [&>li:not(:last-child)]:border-gray-200',
        className
      )}
    >
      {children}
    </ul>
  );
};

// Create the compound component
const CompoundList = List as ListComponentType;

// Attach sub-components
const ItemWithMeta = ListItem as React.FC<ListItemProps> & {
  Meta: React.FC<ListItemMetaProps>;
};
ItemWithMeta.Meta = ListItemMeta;
CompoundList.Item = ItemWithMeta;

export { CompoundList as List, ListItem, ListItemMeta };