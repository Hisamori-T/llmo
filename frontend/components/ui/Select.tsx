import { SelectHTMLAttributes, forwardRef, ReactNode } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = '', children, ...props }, ref) => {
    const base =
      'w-full h-10 pl-[14px] pr-[38px] bg-[#FDFBF5] border rounded text-[14px] font-normal text-ink-800 ' +
      'outline-none appearance-none cursor-pointer transition-shadow ' +
      'focus:border-primary-600 focus:shadow-focus ' +
      'disabled:bg-surface-subtle disabled:text-ink-400 disabled:cursor-not-allowed';
    const borderCls = error ? 'border-danger' : 'border-border-strong';

    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={`${base} ${borderCls} ${className}`.trim()}
          {...props}
        >
          {children}
        </select>
        <span
          className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-ink-400"
          aria-hidden="true"
        >
          expand_more
        </span>
      </div>
    );
  }
);

Select.displayName = 'Select';
