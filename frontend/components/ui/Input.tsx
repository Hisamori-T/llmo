import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => {
    const base =
      'w-full h-10 px-[14px] bg-[#FDFBF5] border rounded text-[14px] font-normal text-ink-800 ' +
      'placeholder:text-ink-400 outline-none transition-shadow ' +
      'focus:border-primary-600 focus:shadow-focus ' +
      'disabled:bg-surface-subtle disabled:text-ink-400 disabled:cursor-not-allowed';
    const borderCls = error ? 'border-danger' : 'border-border-strong';

    return (
      <input
        ref={ref}
        className={`${base} ${borderCls} ${className}`.trim()}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
