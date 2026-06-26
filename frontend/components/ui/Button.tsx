import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: string;
  children?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700 px-[18px]',
  secondary: 'bg-[#FDFBF5] text-ink-800 border border-border-strong hover:bg-surface-hover px-[16px]',
  ghost:     'bg-transparent text-primary-600 hover:bg-surface-hover px-[12px]',
  danger:    'bg-danger text-white hover:bg-[#b83d35] px-[18px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', icon, children, className = '', disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-1.5 h-10 rounded text-[14px] font-semibold transition-colors cursor-pointer disabled:bg-[#A9BBD8] disabled:text-white disabled:cursor-not-allowed disabled:border-none';
    const variantCls = variantClasses[variant];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`${base} ${variantCls} ${className}`.trim()}
        {...props}
      >
        {icon && (
          <span className="material-symbols-outlined text-[18px] leading-none">{icon}</span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
