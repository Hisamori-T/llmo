import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-[#FDFBF5] border border-border rounded-lg ${className}`.trim()}
      style={{ boxShadow: '0 1px 2px rgba(20,24,33,.04)' }}
      {...props}
    >
      {children}
    </div>
  );
}
